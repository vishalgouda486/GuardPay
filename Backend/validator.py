import requests
import uuid
import time

BASE_URL = "http://127.0.0.1:8000"

def simulate_user(username, behavior_type):
    print(f"\n--- Testing User: {username} ({behavior_type}) ---")
    results = {"success": 0, "blocked": 0}
    
    # 1. First, create the user if they don't exist (Signup)
    requests.post(f"{BASE_URL}/signup", json={"username": username, "password": "123"})

    # 2. Simulate 10 transactions
    for i in range(10):
        # Legit behavior = small amounts, slow
        # Fraud behavior = large amounts, fast, or scam recipients
        amount = 50 if behavior_type == "LEGIT" else (500 + i * 1000)
        recipient = "friend@upi" if behavior_type == "LEGIT" else "scammer@upi"
        
        payload = {
            "sender_username": username,
            "recipient_upi": recipient,
            "amount": amount,
            "idempotency_key": str(uuid.uuid4())
        }
        
        resp = requests.post(f"{BASE_URL}/safe-transfer", json=payload).json()
        
        status = resp.get("status")
        if status == "SUCCESS": results["success"] += 1
        else: results["blocked"] += 1
        
        print(f"Tx {i+1}: {status} | Risk: {resp.get('risk_score')} | Latency: {resp.get('latency_ms')}ms")
        
        # Fraudsters move faster
        time.sleep(1.0 if behavior_type == "LEGIT" else 0.2)

    return results

if __name__ == "__main__":
    legit = simulate_user("good_user", "LEGIT")
    fraud = simulate_user("hacker_007", "FRAUD")
    
    print("\n" + "="*30)
    print(f"FINAL REPORT")
    print(f"Legit User: {legit['success']} Success, {legit['blocked']} False Positives")
    print(f"Fraud User: {fraud['blocked']} Detected, {fraud['success']} Bypassed")
    print("="*30)