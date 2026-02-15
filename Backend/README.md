# Guard-Pay: AI-Driven Fraud Prevention Engine

Guard-Pay is an advanced transaction security layer designed to detect and block fraudulent activities in real-time using behavioral heuristics and statistical analysis.

### Elite Security Features
* **Behavioral Fingerprinting:** Uses the **3-Sigma Rule** (Standard Deviation) to detect anomalies based on personal spending baselines.
* **Adaptive Velocity Engine:** Dynamically scales transaction limits based on user **Aura (Reputation) Scores**.
* **Compound Risk Analysis:** Flags "Interaction Logic" threats, such as new accounts performing rapid-fire transactions.
* **Tactical Defense:** Implements **Randomized Threshold Jitter** to prevent attackers from reverse-engineering security limits.

### Tech Stack
* **Framework:** FastAPI (Python)
* **Database:** SQLAlchemy with SQLite
* **Security:** Passlib (Bcrypt) for credential hashing
* **Validation:** Pydantic models for data integrity
