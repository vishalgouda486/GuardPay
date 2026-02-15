import requests
import uuid
import time

BASE_URL = "http://127.0.0.1:8000"
USERNAME = "vishal"  # Make sure this user exists in your DB

def run_stress_test(total_requests=10):
    print(f"🚀 Starting Stress Test: Sending {total_requests} transactions...")
    
    for i in range(total_requests):
        # Generate a unique key for each, EXCEPT if we want to test idempotency
        tx_id = str(uuid.uuid4()) 
        
        payload = {
            "sender_username": USERNAME,
            "recipient_upi": "friend@upi",
            "amount": 10.0 + i, # Varying amount
            "idempotency_key": tx_id
        }
        
        try:
            response = requests.post(f"{BASE_URL}/safe-transfer", json=payload)
            data = response.json()
            
            status = data.get("status")
            risk = data.get("risk_score")
            latency = data.get("latency_ms")
            factors = data.get("risk_factors", [])
            
            print(f"[{i+1}] Status: {status} | Risk: {risk} | Latency: {latency}ms")
            if "Velocity Spike" in str(factors):
                print(f"    ⚠️ VELOCITY TRIGGERED AT REQUEST {i+1}")
                
        except Exception as e:
            print(f"❌ Connection Error: {e}")
        
        # Small delay to simulate fast human clicking
        time.sleep(0.5) 

if __name__ == "__main__":
    run_stress_test(15)