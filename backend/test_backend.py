import os
import pandas as pd
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)

def test_ranked_predictions_exist():
    """Ensure train.py successfully generated the CSV output."""
    assert os.path.exists("ranked_predictions.csv"), "ranked_predictions.csv is missing!"

def test_csv_columns():
    """Ensure the predictions CSV contains the required columns for the frontend."""
    df = pd.read_csv("ranked_predictions.csv")
    expected_cols = ['account_id', 'theft_probability', 'mean_consumption', 'recent_drop_ratio', 'zero_day_count', 'actual_label']
    for col in expected_cols:
        assert col in df.columns, f"Missing expected column: {col}"

def test_api_metrics():
    """Test the FastAPI metrics endpoint."""
    response = client.get("/api/metrics")
    assert response.status_code == 200
    data = response.json()
    assert "auc_pr" in data
    assert "scanned_meters" in data

def test_api_suspicious_accounts():
    """Test the FastAPI suspicious accounts endpoint returns data."""
    response = client.get("/api/suspicious-accounts")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    assert len(data) > 0, "The suspicious accounts list is empty."
    assert "account_id" in data[0]
    assert "theft_probability" in data[0]