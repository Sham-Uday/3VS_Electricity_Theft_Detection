import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import json

app = FastAPI(title="Electricity Theft Detection API")

# Enable CORS so your React frontend (running on a different port) isn't blocked
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def home():
    return {"status": "API is running. Ready for React."}

@app.get("/api/metrics")
def get_metrics():
    """Endpoint for top-level dashboard metrics cards."""
    # Hardcoded based on your latest run for the hackathon demo
    return {
        "auc_pr": 0.1965, 
        "scanned_meters": 42372, 
        "flagged_accounts": 148
    }

@app.get("/api/suspicious-accounts")
def get_suspicious_accounts():
    """Endpoint returning the top 100 ranked suspicious accounts."""
    try:
        df = pd.read_csv("ranked_predictions.csv")
        
        # Clean data for JSON serialization (replace NaNs and Infinity)
        df = df.fillna(0)
        df = df.replace([float('inf'), float('-inf')], 0)
        
        # Return the top 100 highest-risk accounts
        top_100 = df.head(100)
        return top_100.to_dict(orient="records")
    except FileNotFoundError:
        return {"error": "ranked_predictions.csv not found. Run train.py first."}