import numpy as np
import pandas as pd
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sklearn.metrics import precision_recall_curve, auc

app = FastAPI(title="Meter Review Production API", version="2.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Production Synthetic Data Engine with Weekly Aggregates & 500 Accounts ---
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
    is_theft = i < 35  # 35 confirmed theft accounts out of 500 (~7% prevalence)
    
    base_usage = np.random.uniform(10.0, 20.0)
    trend = np.sin(np.linspace(0, 6 * np.pi, DAYS)) * 1.5
    noise = np.random.normal(0, 0.8, DAYS)
    
    series = base_usage + trend + noise
    
    if is_theft:
        drop_start = np.random.randint(SPLIT_IDX, DAYS - 100)
        series[drop_start:] *= np.random.uniform(0.25, 0.45)
        
    series = np.clip(series, 0.2, None)
    
    # --- Engineered Feature: Weekly Aggregates (Rolling 7-day mean) ---
    series_series = pd.Series(series)
    weekly_rolling = series_series.rolling(window=7, min_periods=1).mean().values
    
    # Calculate feature drivers using both raw and weekly aggregates
    train_vals = series[:SPLIT_IDX]
    holdout_vals = series[SPLIT_IDX:]
    
    train_mean = float(np.mean(train_vals))
    holdout_mean = float(np.mean(holdout_vals))
    drop_ratio = holdout_mean / train_mean if train_mean > 0 else 1.0
    
    # Weekly aggregate smoothing check for holdout anomaly detection
    holdout_weekly = weekly_rolling[SPLIT_IDX:]
    weekly_drop_ratio = float(np.mean(holdout_weekly) / train_mean) if train_mean > 0 else 1.0
    
    zero_day_count = float(np.mean(holdout_vals < 1.0))
    
    # Heuristic probability score leveraging weekly aggregate smoothing
    raw_score = (1.0 - weekly_drop_ratio) * 0.75 + zero_day_count * 0.25
    noise_factor = np.random.normal(0, 0.04)
    theft_probability = float(np.clip(raw_score + noise_factor, 0.0001, 0.9999))
    
    all_y_true.append(1 if is_theft else 0)
    all_y_scores.append(theft_probability)
    
    time_series = [
        {
            "date": DATE_RANGE[d].strftime("%Y-%m-%d"), 
            "value": round(float(series[d]), 2),
            "weekly_val": round(float(weekly_rolling[d]), 2)
        }
        for d in range(DAYS)
    ]
    
    sparkline = [round(float(series[d]), 2) for d in range(0, DAYS, 30)]

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
        "auc_pr_curve": pr_curve_data
    }

@app.get("/api/suspicious-accounts")
def get_suspicious_accounts():
    sorted_accounts = sorted(accounts_db, key=lambda x: x["theft_probability"], reverse=True)
    return sorted_accounts