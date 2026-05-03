"""
VeridiumMesh — Isolation Forest Training Script
Trains an anomaly detection model on carbon credit project features.
Outputs: ml/isoforest.joblib, ml/scaler.joblib, data/project_riskscores.csv
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import os

# ── Paths ────────────────────────────────────────────────────────────────────
BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
FEATURES_CSV = os.path.join(BASE_DIR, "../data/features.csv")
SCORES_CSV   = os.path.join(BASE_DIR, "../data/project_riskscores.csv")
MODEL_PATH   = os.path.join(BASE_DIR, "isoforest.joblib")
SCALER_PATH  = os.path.join(BASE_DIR, "scaler.joblib")

FEATURE_COLS = ["R_ratio", "Vintage_Age", "M_flag", "T_flag"]

# ── 1. Load features ─────────────────────────────────────────────────────────
print("Loading features.csv …")
df = pd.read_csv(FEATURES_CSV)
print(f"  {len(df):,} projects × {df.shape[1]} columns")

X = df[FEATURE_COLS].copy()
print(f"  Feature matrix shape: {X.shape}")

# ── 2. Scale features ────────────────────────────────────────────────────────
print("\nFitting StandardScaler …")
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
print("  Scale params (mean):", dict(zip(FEATURE_COLS, scaler.mean_.round(3))))

# ── 3. Train Isolation Forest ────────────────────────────────────────────────
print("\nTraining IsolationForest (contamination=0.05) …")
model = IsolationForest(
    n_estimators=200,       # more trees = more stable scores
    contamination=0.05,     # assume 5% of projects are highly suspicious
    random_state=42,
    n_jobs=-1,              # use all CPU cores
)
model.fit(X_scaled)
print("  Training complete.")

# ── 4. Compute & normalise risk scores ───────────────────────────────────────
print("\nComputing risk scores …")
raw_scores = model.score_samples(X_scaled)  # lower (more negative) = more anomalous

# Flip sign: higher value = more anomalous
flipped = -raw_scores

# Min-Max normalise to [0, 1]
s_min, s_max = flipped.min(), flipped.max()
risk_scores = (flipped - s_min) / (s_max - s_min)

df["RiskScore"] = risk_scores

# ── 5. Print top 15 highest-risk projects ────────────────────────────────────
print("\n" + "─" * 65)
print("TOP 15 HIGHEST-RISK PROJECTS")
print("─" * 65)
top15 = df.sort_values("RiskScore", ascending=False).head(15)
display_cols = ["Project ID"] + [c for c in ["Voluntary Registry", "Type", "Country"] if c in df.columns] + ["R_ratio", "Vintage_Age", "M_flag", "T_flag", "RiskScore"]
display_cols = [c for c in display_cols if c in df.columns]
print(top15[display_cols].to_string(index=False))
print("─" * 65)

# ── 6. Distribution summary ────────────────────────────────────────────────
print("\nRiskScore distribution:")
print(df["RiskScore"].describe().round(4).to_string())
print(f"\nProjects with RiskScore > 0.90: {(df['RiskScore'] > 0.90).sum():,}")
print(f"Projects with RiskScore > 0.80: {(df['RiskScore'] > 0.80).sum():,}")
print(f"Projects with RiskScore > 0.70: {(df['RiskScore'] > 0.70).sum():,}")

# ── 7. Save outputs ───────────────────────────────────────────────────────────
df.sort_values("RiskScore", ascending=False).to_csv(SCORES_CSV, index=False)
print(f"\n✅  Saved risk scores → {SCORES_CSV}")

joblib.dump(model, MODEL_PATH)
print(f"✅  Saved model       → {MODEL_PATH}")

joblib.dump(scaler, SCALER_PATH)
print(f"✅  Saved scaler      → {SCALER_PATH}")

# Save min/max used for normalisation (needed by inference helper)
norm_params = {"score_min": float(s_min), "score_max": float(s_max)}
joblib.dump(norm_params, os.path.join(BASE_DIR, "norm_params.joblib"))
print(f"✅  Saved norm params → ml/norm_params.joblib")
