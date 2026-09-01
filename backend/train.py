import numpy as np
import pandas as pd
import lightgbm as lgb
from sklearn.metrics import average_precision_score, precision_recall_curve

print("1. Loading 167MB Dataset...")
# Load dataset
df = pd.read_csv("data/data.csv")
print(f"Data Shape: {df.shape}")

# Identify columns
# Standard SGCC format: 'CONS_NO' or 'FLAG' / 'chk' along with date columns
id_col = 'CONS_NO' if 'CONS_NO' in df.columns else df.columns[0]
target_col = 'FLAG' if 'FLAG' in df.columns else df.columns[-1]

date_cols = [c for c in df.columns if c not in [id_col, target_col]]
print(f"Total Date Columns: {len(date_cols)} days")

print("\n2. Handling Missing Values (Forward-Fill per Consumer)...")
# Forward fill missing daily readings across time axis for each customer
df[date_cols] = df[date_cols].ffill(axis=1).fillna(0)

print("\n3. Performing Temporal Split (70% Train / 30% Test)...")
split_idx = int(len(date_cols) * 0.70)
train_dates = date_cols[:split_idx]
test_dates = date_cols[split_idx:]

print(f"Train Window: {len(train_dates)} days | Test Window: {len(test_dates)} days")

print("\n4. Engineering Rolling Features...")
def extract_features(data_df, dates):
    """Extract summary metrics across specified date horizon."""
    matrix = data_df[dates].values
    features = pd.DataFrame(index=data_df.index)
    
    # Statistical measures
    features['mean_kwh'] = np.mean(matrix, axis=1)
    features['std_kwh'] = np.std(matrix, axis=1)
    features['max_kwh'] = np.max(matrix, axis=1)
    features['min_kwh'] = np.min(matrix, axis=1)
    
    # Volatility / Coefficient of Variation
    features['cv_kwh'] = features['std_kwh'] / (features['mean_kwh'] + 1e-5)
    
    # Drop indicators: Compare recent 30 days vs overall period mean
    recent_30 = matrix[:, -30:]
    features['recent_30d_mean'] = np.mean(recent_30, axis=1)
    features['drop_ratio'] = features['recent_30d_mean'] / (features['mean_kwh'] + 1e-5)
    
    # Zero consumption day count
    features['zero_days'] = np.sum(matrix == 0, axis=1)
    
    return features

# Features built on historical window (Train)
X_train = extract_features(df, train_dates)
y_train = df[target_col].values

# Features built on entire horizon for evaluation (Test)
X_test = extract_features(df, test_dates)
y_test = df[target_col].values

print("\n5. Training LightGBM with Class-Weight Balance...")
# Class imbalance scaling
scale_weight = (len(y_train) - sum(y_train)) / sum(y_train)

model = lgb.LGBMClassifier(
    n_estimators=300,
    learning_rate=0.03,
    scale_pos_weight=scale_weight,
    random_state=42
)

model.fit(X_train, y_train)

print("\n6. Evaluating AUC-PR (Precision-Recall AUC)...")
# Predict probabilities (not binary 0/1)
y_probs = model.predict_proba(X_test)[:, 1]

auc_pr = average_precision_score(y_test, y_probs)
print(f"=====================================")
print(f"🔥 TEST AUC-PR SCORE: {auc_pr:.4f}")
print(f"=====================================")

print("\n7. Exporting Ranked Suspicious Accounts...")
# Build results table
results_df = pd.DataFrame({
    'account_id': df[id_col],
    'theft_probability': y_probs,
    'mean_consumption': X_test['mean_kwh'],
    'recent_drop_ratio': X_test['drop_ratio'],
    'zero_day_count': X_test['zero_days'],
    'actual_label': y_test
})

# Sort descending by risk score
results_df = results_df.sort_values(by='theft_probability', ascending=False)

# Save output CSV for FastAPI to consume
results_df.to_csv("ranked_predictions.csv", index=False)
print("Saved top suspicious predictions to 'ranked_predictions.csv' successfully!")


print("\n9. Feature Importance Breakdown...")
importance = pd.DataFrame({
    'Feature': X_train.columns,
    'Importance': model.feature_importances_
}).sort_values(by='Importance', ascending=False)
print(importance.to_string(index=False))