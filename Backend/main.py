from fastapi.middleware.cors import CORSMiddleware
from fastapi import FastAPI, HTTPException, Depends
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import secrets
import random
import enum
import time
from sqlalchemy.ext.declarative import declarative_base
from passlib.context import CryptContext
from sqlalchemy import Column, String, Float, Integer, create_engine, func, Enum, DateTime
from sqlalchemy.orm import sessionmaker, Session

# RISK WEIGHTS (0 to 100)
WEIGHT_BLACKLIST = 80
WEIGHT_NEW_ACCOUNT = 30
WEIGHT_LARGE_AMOUNT = 15
RISK_THRESHOLD = 60  # If total risk > 60, we BLOCK

# PHASE 3 SETTINGS
MAX_RISK_CAP = 100               # Ensure risk never exceeds 100%
THRESHOLD_JITTER = 3             # Randomized threshold variation (+/- 3)
WEIGHT_FAILED_ATTEMPT = 10       # Penalty for recently blocked attempts

# VELOCITY SETTINGS
MAX_TRANSACTIONS_PER_WINDOW = 3  # More than 3 tx in 1 min is suspicious
WINDOW_SECONDS = 60              # The "Sliding Window" time (1 minute)
WEIGHT_VELOCITY_SPIKE = 45       # Risk points for hitting the limit

# ANOMALY SETTINGS
WEIGHT_ANOMALY = 25              # Risk points for unusual spending
ANOMALY_THRESHOLD_MULTIPLIER = 3 # If amount > 3x the average, it's an anomaly

# 1. Setup the Database File
DATABASE_URL = "sqlite:///./guard_pay.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class UserDB(Base):
    __tablename__ = "users"
    username = Column(String, primary_key=True, index=True)
    hashed_password = Column(String)
    aura_score = Column(Float, default=100.0) # Starting trust score
    warning_count = Column(Integer, default=0)
    safe_transaction_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    # --- BEHAVIORAL FINGERPRINT FIELDS ---
    avg_tx_amount = Column(Float, default=0.0)
    std_dev_amount = Column(Float, default=0.0)
    total_tx_count = Column(Integer, default=0)
    last_fingerprint_update = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class EscrowDB(Base):
    __tablename__ = "escrow_payments"
    escrow_id = Column(String, primary_key=True, index=True)
    sender_id = Column(String)
    receiver_id = Column(String)
    amount = Column(Float)
    status = Column(String, default="LOCKED")


# 2. Define the Ghost Card Table
class GhostCardDB(Base):
    __tablename__ = "ghost_cards"
    card_id = Column(String, primary_key=True, index=True)
    card_number = Column(String)
    cvv = Column(String)
    label = Column(String)
    amount_limit = Column(Float)
    status = Column(String, default="Active")
    owner = Column(String)

class TransactionState(enum.Enum):
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    BLOCKED = "BLOCKED"
    ESCROW_LOCKED = "ESCROW_LOCKED"
    RELEASED = "RELEASED"
    REFUNDED = "REFUNDED"

class TransactionLogDB(Base):
    __tablename__ = "transaction_logs"
    id = Column(Integer, primary_key=True, index=True)
    idempotency_key = Column(String, unique=True, index=True) 
    username = Column(String)
    recipient = Column(String)
    amount = Column(Float)
    type = Column(String)
    state = Column(Enum(TransactionState), default=TransactionState.PENDING) 
    timestamp = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ScamListDB(Base):
    __tablename__ = "scam_blacklist"
    upi_id = Column(String, primary_key=True, index=True)
    reason = Column(String, default="Reported Fraud")
    added_on = Column(String)


# 3. Create the table in the file
Base.metadata.create_all(bind=engine)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def update_user_fingerprint(username: str, db: Session):
    # 1. Fetch all successful transactions for this user
    history = db.query(TransactionLogDB).filter(
        TransactionLogDB.username == username,
        TransactionLogDB.state == TransactionState.APPROVED
    ).all()

    if not history:
        return

    amounts = [tx.amount for tx in history]
    count = len(amounts)
    
    # 2. Calculate Mean (Average)
    mean = sum(amounts) / count
    
    # 3. Calculate Standard Deviation (Measure of "Typical" variance)
    # Variance is the average of squared differences from the Mean
    variance = sum((x - mean) ** 2 for x in amounts) / count
    std_dev = variance ** 0.5

    # 4. Save back to User Profile
    user = db.query(UserDB).filter(UserDB.username == username).first()
    user.avg_tx_amount = mean
    user.std_dev_amount = std_dev
    user.total_tx_count = count
    user.last_fingerprint_update = datetime.now(timezone.utc)
    db.commit()

# Helper to handle database connections
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

class UserCreate(BaseModel):
    username: str
    password: str

class TransferRequest(BaseModel):
    sender_username: str
    recipient_upi: str
    amount: float
    idempotency_key: str

class CardRequest(BaseModel):
    username: str
    label: str 
    amount_limit: float

class SpendRequest(BaseModel):
    card_id: str
    amount: float

class EscrowRequest(BaseModel):
    sender_id: str
    receiver_id: str
    amount: float

class UserLogin(BaseModel):
    username: str
    password: str

# -----Endpoints-------

@app.post("/signup")
def signup(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(UserDB).filter(UserDB.username == user.username).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    # Hash the password and save
    new_user = UserDB(
        username=user.username,
        hashed_password=pwd_context.hash(user.password)
    )
    db.add(new_user)
    db.commit()
    return {"message": f"User {user.username} created successfully!"}

@app.post("/safe-transfer")
def perform_transfer(request: TransferRequest, db: Session = Depends(get_db)):
    start_time = time.time()  # Start Latency Measurement
    
    # --- 1. IDEMPOTENCY CHECK ---
    duplicate = db.query(TransactionLogDB).filter(
        TransactionLogDB.idempotency_key == request.idempotency_key
    ).first()
    
    if duplicate:
        return {
            "status": "DUPLICATE",
            "message": "Transaction already processed.",
            "original_state": duplicate.state
        }

    # --- 2. FETCH SENDER ---
    sender = db.query(UserDB).filter(UserDB.username == request.sender_username).first()
    if not sender:
        raise HTTPException(status_code=404, detail="User not found")

    # --- COOLING-OFF POLICY (New User Safeguard) ---
    account_creation = sender.created_at.replace(tzinfo=timezone.utc)
    age_hours = (datetime.now(timezone.utc) - account_creation).total_seconds() / 3600
    
    if age_hours < 24 and request.amount > 5000:
        # Calculate when the limit will be lifted for the error message
        lift_time = (account_creation + timedelta(hours=24)).strftime("%Y-%m-%d %H:%M UTC")
        
        return {
            "status": "LIMIT_EXCEEDED",
            "message": f"Security Notice: As a new user, your transaction limit is ₹5,000 for the first 24 hours. This limit will be automatically lifted on {lift_time}.",
            "current_account_age": f"{round(age_hours, 1)}h",
            "policy": "New User Cooling-Off Period"
        }

    def save_final_log(state, log_type, msg_type="PAYMENT"):
        log = TransactionLogDB(
            idempotency_key=request.idempotency_key,
            username=request.sender_username,
            recipient=request.recipient_upi,
            amount=request.amount,
            type=msg_type,
            state=state,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(log)
        db.commit()

    # --- 3. RANDOMIZED DYNAMIC THRESHOLD (Tactical Defense) ---
    one_hour_ago = datetime.now(timezone.utc) - timedelta(hours=1)
    global_scams = db.query(TransactionLogDB).filter(
        TransactionLogDB.state == TransactionState.BLOCKED,
        TransactionLogDB.timestamp >= one_hour_ago
    ).count()
    
    # Base threshold adaptive logic
    base_threshold = max(30, RISK_THRESHOLD - (global_scams * 2))
    # USP: Add Jitter (+/- 3) to prevent reverse-engineering of the block limit
    current_threshold = base_threshold + random.randint(-THRESHOLD_JITTER, THRESHOLD_JITTER)

    # --- 4. RISK SCORING ENGINE ---
    total_risk_score = 0
    risk_factors = []

# ---- Commented out Factor A for the new update of new user logic-----
    # Factor A: True Account Age
    # account_creation = sender.created_at.replace(tzinfo=timezone.utc)
    # age_hours = (datetime.now(timezone.utc) - account_creation).total_seconds() / 3600
    # if age_hours < 24:
    #    total_risk_score += WEIGHT_NEW_ACCOUNT
    #    risk_factors.append(f"New Account Risk ({round(age_hours, 1)}h old) (+{WEIGHT_NEW_ACCOUNT})")

    # Factor B: Aura/Reputation baseline
    if sender.aura_score < 50:
        total_risk_score += 20
        risk_factors.append("Low User Reputation (+20)")

    # Factor C: Blacklist Check
    is_scam = db.query(ScamListDB).filter(ScamListDB.upi_id == request.recipient_upi).first()
    if is_scam:
        total_risk_score += WEIGHT_BLACKLIST
        risk_factors.append(f"Blacklisted Recipient (+{WEIGHT_BLACKLIST})")

    # Factor D: Sliding Window (Approved + Weak Signal: Blocked)
    window_start = datetime.now(timezone.utc) - timedelta(seconds=WINDOW_SECONDS)
    
    approved_count = db.query(TransactionLogDB).filter(
        TransactionLogDB.username == request.sender_username,
        TransactionLogDB.timestamp >= window_start,
        TransactionLogDB.state == TransactionState.APPROVED
    ).count()
    
    blocked_count = db.query(TransactionLogDB).filter(
        TransactionLogDB.username == request.sender_username,
        TransactionLogDB.timestamp >= window_start,
        TransactionLogDB.state == TransactionState.BLOCKED
    ).count()

    if approved_count >= MAX_TRANSACTIONS_PER_WINDOW:
        total_risk_score += WEIGHT_VELOCITY_SPIKE
        risk_factors.append(f"Velocity Spike: {approved_count} successful tx (+{WEIGHT_VELOCITY_SPIKE})")
    
    if blocked_count > 0:
        penalty = blocked_count * WEIGHT_FAILED_ATTEMPT
        total_risk_score += penalty
        risk_factors.append(f"Recent Failed/Blocked Attempts Found (+{penalty})")

    # Factor E: Behavioral Fingerprint (3-Sigma Rule)
    if sender.total_tx_count >= 5:
        behavioral_limit = sender.avg_tx_amount + (3 * sender.std_dev_amount)
        if request.amount > behavioral_limit:
            total_risk_score += WEIGHT_ANOMALY
            risk_factors.append(f"Behavioral Outlier: Exceeds 3-sigma personal limit (+{WEIGHT_ANOMALY})")
    else:
        # Fallback for new profiles
        avg_amount_query = db.query(func.avg(TransactionLogDB.amount)).filter(
            TransactionLogDB.username == request.sender_username,
            TransactionLogDB.state == TransactionState.APPROVED
        ).scalar()
        if avg_amount_query and request.amount > (avg_amount_query * ANOMALY_THRESHOLD_MULTIPLIER):
            total_risk_score += WEIGHT_ANOMALY
            risk_factors.append(f"Anomalous Amount vs Early Avg (+{WEIGHT_ANOMALY})")

    # Factor F: Large Amount (Hard Limit)
    if request.amount > 5000:
        total_risk_score += WEIGHT_LARGE_AMOUNT
        risk_factors.append(f"High Value Transaction (+{WEIGHT_LARGE_AMOUNT})")

# ---- Commented out Factor G for the new update of new user logic-----
    # Factor G: Feature Interaction Logic (Compound Risk)
    # if (age_hours < 24) and (approved_count >= 1):
    #    total_risk_score += 25
    #    risk_factors.append("COMPOUND RISK: New Account + Recent Activity (+25)")

    # --- FACTOR H: Adaptive Velocity (Connecting Long-term Trust to Short-term Limits) ---
    # USP: High-trust users get more freedom; low-trust users get stricter limits
    adaptive_max_tx = MAX_TRANSACTIONS_PER_WINDOW
    
    if sender.aura_score > 90:
        adaptive_max_tx += 2  # Trusting the long-term memory
    elif sender.aura_score < 40:
        adaptive_max_tx = 1   # Stricter memory for low-reputation users

    if approved_count >= adaptive_max_tx:
        total_risk_score += WEIGHT_VELOCITY_SPIKE
        risk_factors.append(f"Adaptive Velocity Trigger: Limit reduced due to low Aura (+{WEIGHT_VELOCITY_SPIKE})")

    # --- 5. RISK NORMALIZATION ---
    # USP: Ensure score stays within 0-100 range for consistency
    final_risk_score = min(MAX_RISK_CAP, total_risk_score)

    # --- 6. DECISION LOGIC ---
    latency_ms = round((time.time() - start_time) * 1000, 2)
    
    if final_risk_score >= current_threshold:
        sender.aura_score = max(0, sender.aura_score - 5.0)
        db.commit()
        save_final_log(TransactionState.BLOCKED, "RISK_ENGINE_BLOCK")
        
        return {
            "status": "DENIED",
            "risk_score": final_risk_score,
            "applied_threshold": current_threshold,
            "risk_factors": risk_factors,
            "latency_ms": latency_ms,
            "message": "Transaction blocked due to high risk profile."
        }

    # --- 7. SUCCESS LOGIC & REWARD ---
    sender.safe_transaction_count += 1
    reward_message = ""
    
    if sender.safe_transaction_count >= 10:
        sender.aura_score = min(100.0, sender.aura_score + 2.0)
        sender.safe_transaction_count = 0 
        sender.warning_count = 0 
        reward_message = " 🎉 Bonus: +2 Aura points earned!"
        
        bonus_log = TransactionLogDB(
            idempotency_key=f"BONUS-{request.idempotency_key}",
            username=request.sender_username,
            recipient="SYSTEM",
            amount=0.0,
            type="REWARD",
            state=TransactionState.APPROVED,
            timestamp=datetime.now(timezone.utc)
        )
        db.add(bonus_log)

    save_final_log(TransactionState.APPROVED, "PAYMENT")

    # Update the user's behavioral fingerprint baseline for the next transaction
    update_user_fingerprint(request.sender_username, db)

    return {
        "status": "SUCCESS", 
        "risk_score": final_risk_score,
        "applied_threshold": current_threshold,
        "risk_factors": risk_factors,
        "latency_ms": latency_ms,
        "message": f"₹{request.amount} sent safely.{reward_message}",
        "current_aura": sender.aura_score
    }

@app.post("/generate-ghost-card")
def generate_card(request: CardRequest, db: Session = Depends(get_db)):
    # Verify the user actually exists before making a card for them
    user = db.query(UserDB).filter(UserDB.username == request.username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please signup first.")

    card_id = f"ghost_{secrets.token_hex(3)}"
    new_card = GhostCardDB(
        card_id=card_id,
        card_number="4" + "".join([str(random.randint(0, 9)) for _ in range(15)]),
        cvv="".join([str(random.randint(0, 9)) for _ in range(3)]),
        label=request.label,
        amount_limit=request.amount_limit,
        status="Active",
        owner=request.username # <--- SAVE THE OWNER HERE
    )
    
    db.add(new_card)
    db.commit()
    db.refresh(new_card)
    
    return {"status": "CREATED", "owner": new_card.owner, "details": new_card}

@app.post("/simulate-merchant-payment")
def pay_with_ghost_card(request: SpendRequest, db: Session = Depends(get_db)):
    # 1. Search the database for the card
    card = db.query(GhostCardDB).filter(GhostCardDB.card_id == request.card_id).first()
    
    if not card:
        raise HTTPException(status_code=404, detail="Ghost Card not found")
    
    if card.status == "Destroyed":
        return {"status": "DECLINED", "reason": "Card already self-destructed."}
    
    if request.amount > card.amount_limit:
        return {"status": "DECLINED", "reason": "Limit exceeded."}
    
    # 2. Update status and save
    card.status = "Destroyed"
    db.commit()
    
    return {"status": "SUCCESS", "message": "Payment done and card destroyed."}

@app.post("/create-escrow-payment")
def create_escrow(request: EscrowRequest, db: Session = Depends(get_db)):
    # Verify the sender exists
    sender = db.query(UserDB).filter(UserDB.username == request.sender_id).first()
    if not sender:
        raise HTTPException(status_code=404, detail="Sender not found")

    escrow_id = f"escrow_{secrets.token_hex(3)}"
    
    new_escrow = EscrowDB(
        escrow_id=escrow_id,
        sender_id=request.sender_id, # <--- SAVE SENDER
        receiver_id=request.receiver_id,
        amount=request.amount,
        status="LOCKED"
    )
    
    db.add(new_escrow)
    db.commit()
    db.refresh(new_escrow)
    
    return {"status": "ESCROW_LOCKED", "escrow_id": escrow_id, "details": new_escrow}

@app.get("/admin/dashboard")
def get_admin_stats(db: Session = Depends(get_db)):
    user_count = db.query(UserDB).count()
    active_cards = db.query(GhostCardDB).filter(GhostCardDB.status == "Active").count()
    destroyed_cards = db.query(GhostCardDB).filter(GhostCardDB.status == "Destroyed").count()
    locked_escrows = db.query(EscrowDB).filter(EscrowDB.status == "LOCKED").count() # New Stat
    
    return {
        "users_registered": user_count,
        "active_ghost_cards": active_cards,
        "destroyed_ghost_cards": destroyed_cards,
        "total_locked_escrows": locked_escrows,
        "fraud_prevention_status": "Anti-Mule Relay Guard Fully Operational"
    }


# --- MOCK DATABASES ---
SCAM_DATABASE = ["scammer@upi", "fake_lottery@upi"]

# Mock user: Received money 3 mins ago (Suspiciously fast if they send now)
USER_ACCOUNT = {
    "balance": 10000,
    "last_deposit_time": datetime.now() - timedelta(minutes=3)
}


@app.get("/")
def status():
    return {"system": "Guard Pay Layered Security Active"}


@app.post("/release-escrow")
def release_funds(escrow_id: str, db: Session = Depends(get_db)):
    # 1. Find the escrow record
    escrow = db.query(EscrowDB).filter(EscrowDB.escrow_id == escrow_id).first()
    
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow record not found")
    
    if escrow.status == "RELEASED":
        return {"error": "Funds already released."}
    
    # 2. Complete the transaction
    escrow.status = "RELEASED"
    
    # 3. AURA RECOVERY: Reward the Sender for a successful, safe deal
    sender = db.query(UserDB).filter(UserDB.username == escrow.sender_id).first()
    if sender:
        # Increase score by 2 points (max 100)
        sender.aura_score = min(100.0, sender.aura_score + 2.0)
        
        # If they behave well, start clearing their warning history
        if sender.warning_count > 0:
            sender.warning_count -= 1
            
    db.commit()
    
    return {
        "status": "SUCCESS",
        "message": f"Payment released to {escrow.receiver_id}. Sender Aura boosted!",
        "new_aura_score": sender.aura_score if sender else "N/A"
    }

@app.get("/check-incoming-escrow/{escrow_id}")
def check_escrow_status(escrow_id: str, db: Session = Depends(get_db)):
    escrow = db.query(EscrowDB).filter(EscrowDB.escrow_id == escrow_id).first()
    
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow record not found")
    
    return {
        "receiver_id": escrow.receiver_id,
        "amount": escrow.amount,
        "status": escrow.status,
        "can_ship_item": True if escrow.status == "LOCKED" else False
    }

@app.post("/penalize-user/{username}")
def penalize_user(username: str, db: Session = Depends(get_db)):
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Drop score by 10 points for suspicious activity
    user.aura_score -= 10.0
    db.commit()
    
    return {
        "message": f"User {username} penalized.",
        "new_aura_score": user.aura_score
    }


@app.post("/login")
def login(user: UserLogin, db: Session = Depends(get_db)):
    # 1. Find user
    db_user = db.query(UserDB).filter(UserDB.username == user.username).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # 2. Verify hashed password
    if not pwd_context.verify(user.password, db_user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid password")
    
    return {
        "status": "Login Successful",
        "username": f"Hello {db_user.username}!",
        "aura_score": db_user.aura_score
    }

@app.get("/my-cards/{username}")
def get_user_cards(username: str, db: Session = Depends(get_db)):
    # 1. Check if the user exists first
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Fetch only the cards belonging to this specific user
    user_cards = db.query(GhostCardDB).filter(GhostCardDB.owner == username).all()
    
    return {
        "username": username,
        "total_cards": len(user_cards),
        "cards": user_cards
    }

@app.get("/user/profile/{username}")
def get_user_profile(username: str, db: Session = Depends(get_db)):
    # 1. Fetch user data
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Count their assets for a quick summary
    card_count = db.query(GhostCardDB).filter(GhostCardDB.owner == username).count()
    incoming_escrow = db.query(EscrowDB).filter(EscrowDB.receiver_id == username).count()
    outgoing_escrow = db.query(EscrowDB).filter(EscrowDB.sender_id == username).count()

    return {
        "username": user.username,
        "trust_rating": {
            "aura_score": user.aura_score,
            "warning_count": user.warning_count,
            "status": "Elite" if user.aura_score > 90 else "Standard" if user.aura_score > 60 else "High Risk",
            "bonus_progress": f"{user.safe_transaction_count}/10"
        },
        "account_summary": {
            "total_ghost_cards": card_count,
            "incoming_escrow_payments": incoming_escrow,
            "outgoing_escrows_payments": outgoing_escrow
        }
    }

@app.get("/my-sent-escrows/{username}")
def get_sent_escrows(username: str, db: Session = Depends(get_db)):
    # 1. Check if user exists
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Fetch payments where this user is the SENDER
    sent_payments = db.query(EscrowDB).filter(EscrowDB.sender_id == username).all()
    
    return {
        "username": username,
        "total_outgoing_payments": len(sent_payments),
        "escrows": sent_payments
    }

@app.post("/request-escrow-refund")
def request_refund(escrow_id: str, username: str, db: Session = Depends(get_db)):
    escrow = db.query(EscrowDB).filter(EscrowDB.escrow_id == escrow_id).first()
    
    if not escrow:
        raise HTTPException(status_code=404, detail="Escrow record not found")
    
    # Security Check: Only the sender can cancel their own payment
    if escrow.sender_id != username:
        raise HTTPException(status_code=403, detail="Permission denied: You are not the sender")
    
    if escrow.status != "LOCKED":
        return {"error": f"Cannot refund. Current status is {escrow.status}"}
    
    # Update status to REFUNDED
    escrow.status = "REFUNDED"
    db.commit()
    
    return {
        "status": "SUCCESS",
        "message": f"₹{escrow.amount} has been refunded to {username}.",
        "new_status": "REFUNDED"
    }

@app.get("/my-incoming-escrows/{username}")
def get_incoming_escrows(username: str, db: Session = Depends(get_db)):
    # 1. Check if user exists
    user = db.query(UserDB).filter(UserDB.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Fetch payments where this user is the RECEIVER
    incoming_payments = db.query(EscrowDB).filter(EscrowDB.receiver_id == username).all()
    
    return {
        "username": username,
        "total_pending_income": len(incoming_payments),
        "escrows": incoming_payments
    }

@app.get("/my-history/{username}")
def get_transaction_history(username: str, db: Session = Depends(get_db)):
    logs = db.query(TransactionLogDB).filter(TransactionLogDB.username == username).all()
    return {"username": username, "history": logs}

@app.post("/admin/block-id")
def block_new_id(upi_id: str, reason: str, db: Session = Depends(get_db)):
    # Check if already blocked
    existing = db.query(ScamListDB).filter(ScamListDB.upi_id == upi_id).first()
    if existing:
        return {"message": "ID already in blacklist"}
    
    new_scam_id = ScamListDB(
        upi_id=upi_id, 
        reason=reason,
        added_on=datetime.now().strftime("%Y-%m-%d")
    )
    db.add(new_scam_id)
    db.commit()
    return {"status": "BLACKLISTED", "id": upi_id}

@app.get("/admin/global-stats")
def get_global_stats(db: Session = Depends(get_db)):
    # 1. Total User Count
    total_users = db.query(UserDB).count()
    
    # 2. Total Scams Prevented (Counting DENIED logs)
    total_scams_blocked = db.query(TransactionLogDB).filter(
        TransactionLogDB.state == "DENIED"
    ).count()
    
    # 3. Total Money Protected (Sum of SUCCESS transactions)
    # Using .scalar() to get the actual number from the Sum function
    total_volume = db.query(func.sum(TransactionLogDB.amount)).filter(
        TransactionLogDB.state == "SUCCESS"
    ).scalar() or 0.0
    
    # 4. Reputation Health (Average Aura Score)
    avg_aura = db.query(func.avg(UserDB.aura_score)).scalar() or 0.0
    
    return {
        "admin_panel": "Guard Pay Command Center",
        "metrics": {
            "total_registered_users": total_users,
            "fraud_attempts_blocked": total_scams_blocked,
            "total_safe_volume_processed": f"₹{total_volume}",
            "system_trust_average": f"{round(avg_aura, 2)}%",
            "active_blacklist_entries": db.query(ScamListDB).count()
        },
        "status": "All Systems Operational"
    }
