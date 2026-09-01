import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sklearn.metrics import precision_recall_curve, auc

app = FastAPI(title="Meter Review Production API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Synthetic Data Engine with Real Timestamps & Feature Attribution ---
np.random.seed(42)
DAYS = 1095  # 3 years
N_ACCOUNTS = 500
SPLIT_IDX = int(DAYS * 0.7)
START_DATE = pd.to_datetime("2023-09-01")
DATE_RANGE = pd.date_range(start=START_DATE, periods=DAYS, freq="D")

accounts_db = []
all_y_true = []
all_y_scores = []

for i in range(N_ACCOUNTS):
    acc_id = f"AC-{np.random.randint(10000, 99999)}"
    is_theft = i < 35 # 5 confirmed theft accounts for simulation
    
    base_usage = np.random.uniform(8.0, 22.0)
    trend = np.sin(np.linspace(0, 6 * np.pi, DAYS)) * 2.0
    noise = np.random.normal(0, 1.2, DAYS)
    
    series = base_usage + trend + noise
    
    # Simulate tampering drop in holdout period for theft accounts
    if is_theft:
        drop_start = np.random.randint(SPLIT_IDX, DAYS - 100)
        series[drop_start:] *= np.random.uniform(0.2, 0.4)
        
    series = np.clip(series, 0.2, None)
    
    # Calculate feature drivers
    train_vals = series[:SPLIT_IDX]
    holdout_vals = series[SPLIT_IDX:]
    
    train_mean = float(np.mean(train_vals))
    holdout_mean = float(np.mean(holdout_vals))
    drop_ratio = holdout_mean / train_mean if train_mean > 0 else 1.0
    
    # Missing / zero reading rate calculation
    zero_day_count = float(np.mean(holdout_vals < 1.0))
    
    # Heuristic model probability score based on engineered features (4 decimals)
    raw_score = (1.0 - drop_ratio) * 0.7 + zero_day_count * 0.3
    theft_probability = float(np.clip(raw_score + np.random.normal(0, 0.05), 0.0001, 0.9999))
    
    all_y_true.append(1 if is_theft else 0)
    all_y_scores.append(theft_probability)
    
    time_series = [
        {"date": DATE_RANGE[d].strftime("%Y-%m-%d"), "value": round(float(series[d]), 2)}
        for d in range(DAYS)
    ]
    
    sparkline = [round(float(series[d]), 2) for d in range(0, DAYS, 30)]  # monthly aggregate points

    accounts_db.append({
        "account_id": acc_id,
        "theft_probability": round(theft_probability, 4),
        "actual_label": 1 if is_theft else 0,
        "mean_consumption": round(train_mean, 4),
        "holdout_mean": round(holdout_mean, 4),
        "recent_drop_ratio": round(drop_ratio, 4),
        "zero_day_count": round(zero_day_count, 4),
        "sparkline": sparkline,
        "time_series": time_series
    })

# Compute PR-Curve and AUC-PR
precision, recall, thresholds = precision_recall_curve(all_y_true, all_y_scores)
auc_pr_val = auc(recall, precision)
baseline_rate = sum(all_y_true) / len(all_y_true)

pr_curve_data = [
    {"recall": round(float(r), 4), "precision": round(float(p), 4)}
    for r, p in zip(recall, precision)
]

@app.get("/api/metrics")
def get_metrics():
    return {
        "auc_pr": round(float(auc_pr_val), 4),
        "baseline_auc_pr": round(float(baseline_rate), 4),
        "scanned_meters": N_ACCOUNTS,
        "flagged_accounts": sum(1 for a in accounts_db if a["theft_probability"] >= 0.5),
        "review_threshold": 0.5000,
        "pr_curve": pr_curve_data
    }

@app.get("/api/suspicious-accounts")
def get_suspicious_accounts():
    # Sort descending by model probability score
    sorted_accounts = sorted(accounts_db, key=lambda x: x["theft_probability"], reverse=True)
    return sorted_accounts