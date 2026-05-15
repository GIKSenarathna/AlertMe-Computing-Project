"""
AlertMe Predictive Risk Map — ML Microservice
==============================================
Industry-level geospatial risk prediction engine for emergency incident clustering.

Architecture:
  - Reads historical incident data directly from alertme_db (MySQL)
  - Applies DBSCAN (Density-Based Spatial Clustering of Applications with Noise)
    with Haversine distance metric for accurate geographic proximity
  - Scores each cluster using a multi-feature weighted composite formula:
      riskScore = 0.40 * normalizedDensity
                + 0.35 * weightedSeverity       (exponential recency decay)
                + 0.25 * normalizedTimeDecay
  - Detects peak hours, dominant incident types, and 7-day trend direction
  - Exposes GET /ml/risk-clusters?days=N via FastAPI

Run:
  uvicorn main:app --host 0.0.0.0 --port 8000 --reload
"""

import math
import os
from datetime import datetime, timedelta, timezone
from collections import Counter
from typing import List, Optional

import numpy as np
import pandas as pd
import mysql.connector
from sklearn.cluster import DBSCAN
from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(
    title="AlertMe ML Risk Prediction Service",
    description="Geospatial DBSCAN-based emergency incident risk clustering engine",
    version="1.0.0"
)

# Allow dashboard and Spring Boot to call this service
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Database Configuration ──────────────────────────────────────────────────

DB_CONFIG = {
    "host":     os.getenv("DB_HOST",     "127.0.0.1"),
    "port":     int(os.getenv("DB_PORT", "3306")),
    "user":     os.getenv("DB_USER",     "alertme_user"),
    "password": os.getenv("DB_PASSWORD", "alertme123"),
    "database": os.getenv("DB_NAME",     "alertme_db"),
}

# ─── Pydantic Response Model ─────────────────────────────────────────────────

class RiskCluster(BaseModel):
    id:             int
    lat:            float
    lng:            float
    name:           str
    risk:           str          # Low / Medium / High / Critical
    riskScore:      float        # 0.0 – 1.0 composite ML score
    confidence:     int          # 0–100 %
    incidents:      int
    avgSeverity:    float
    peakTime:       str          # "HH:00 - HH:00"
    peakDay:        str          # e.g. "Monday"
    trend:          str          # e.g. "↑ +42% in last 7 days"
    dominantType:   str          # MEDICAL / VEHICLE / FIRE
    action:         List[str]

# ─── Database Loader ─────────────────────────────────────────────────────────

def load_incidents(days: int) -> pd.DataFrame:
    """
    Pull historical incidents from MySQL alertme_db.
    Joins incidents with locations to get GPS coordinates.
    """
    since = datetime.now(timezone.utc) - timedelta(days=days)
    since_str = since.strftime("%Y-%m-%d %H:%M:%S")

    conn = mysql.connector.connect(**DB_CONFIG)
    cursor = conn.cursor(dictionary=True)

    query = """
        SELECT
            i.incident_id,
            i.severity_score,
            i.type,
            i.reported_at,
            i.status,
            l.latitude,
            l.longitude
        FROM incidents i
        JOIN locations l ON i.location_id = l.location_id
        WHERE i.reported_at >= %s
          AND l.latitude IS NOT NULL
          AND l.longitude IS NOT NULL
    """
    cursor.execute(query, (since_str,))
    rows = cursor.fetchall()
    cursor.close()
    conn.close()

    df = pd.DataFrame(rows)
    if df.empty:
        return df

    df["reported_at"] = pd.to_datetime(df["reported_at"], utc=True)
    return df


# ─── Core ML Engine ──────────────────────────────────────────────────────────

def haversine_km(lat1, lon1, lat2, lon2) -> float:
    """Calculate the great-circle distance in kilometers between two GPS points."""
    R = 6371.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlam = math.radians(lon2 - lon1)
    a = math.sin(dphi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(dlam / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def recency_weight(reported_at: datetime, half_life_days: float = 14.0) -> float:
    """
    Exponential decay weighting: incidents from today = weight 1.0,
    incidents from half_life_days ago = weight 0.5.
    λ = ln(2) / half_life_days
    """
    now = datetime.now(timezone.utc)
    days_ago = max((now - reported_at).total_seconds() / 86400.0, 0)
    lam = math.log(2) / half_life_days
    return math.exp(-lam * days_ago)


def run_dbscan(df: pd.DataFrame, eps_km: float = 2.0, min_samples: int = 2) -> np.ndarray:
    """
    Run DBSCAN on geographic coordinates using Haversine distance.
    eps_km: maximum neighborhood radius in kilometers.
    Returns cluster label array (-1 = noise/outlier).
    """
    coords = df[["latitude", "longitude"]].values

    # Convert km epsilon to radians for scikit-learn's BallTree (Haversine)
    eps_rad = eps_km / 6371.0  # Earth radius in km

    db = DBSCAN(
        eps=eps_rad,
        min_samples=min_samples,
        algorithm="ball_tree",
        metric="haversine"
    ).fit(np.radians(coords))

    return db.labels_


def compute_risk_label(score: float) -> str:
    if score >= 0.70: return "Critical"
    if score >= 0.45: return "High"
    if score >= 0.25: return "Medium"
    return "Low"


def recommended_actions(risk: str, dominant_type: str) -> List[str]:
    base = {
        "Critical": [
            f"Pre-position ICU ambulance — high {dominant_type} zone",
            "Increase police patrol frequency by 3×",
            "Activate emergency command centre alert",
        ],
        "High": [
            f"Deploy 2 response units during peak hours ({dominant_type} risk)",
            "Monitor CCTV and traffic feed in this corridor",
            "Brief nearest hospital on potential surge",
        ],
        "Medium": [
            "Standard monitoring protocol",
            f"Alert nearest {dominant_type.lower()} response unit",
        ],
        "Low": [
            "Routine patrol checks only",
        ],
    }
    return base.get(risk, ["Monitor situation"])


def analyze_cluster(group: pd.DataFrame, all_max_count: int, all_max_decay: float) -> dict:
    """
    Compute all ML-derived features for a single DBSCAN cluster.
    """
    now = datetime.now(timezone.utc)
    count = len(group)

    # ── Recency-weighted severity ────────────────────────────────────────────
    weights = group["reported_at"].apply(recency_weight)
    total_weight = weights.sum()
    weighted_severity = (group["severity_score"] * weights).sum() / total_weight if total_weight > 0 else 0
    avg_severity = group["severity_score"].mean()

    # ── Normalised density & decay scores ───────────────────────────────────
    norm_density = count / all_max_count if all_max_count > 0 else 0
    time_decay_score = total_weight / all_max_decay if all_max_decay > 0 else 0

    # ── Composite risk score (weighted multi-feature formula) ────────────────
    risk_score = round(
        0.40 * norm_density +
        0.35 * (weighted_severity / 10.0) +
        0.25 * time_decay_score,
        4
    )
    risk_score = min(risk_score, 1.0)

    # ── Confidence: based on sample size (more incidents = more confident) ──
    confidence = min(int(50 + (count / all_max_count) * 50), 100)

    # ── Peak hour detection ──────────────────────────────────────────────────
    hours = group["reported_at"].dt.hour
    peak_hour = int(hours.mode().iloc[0]) if not hours.empty else 12
    peak_time = f"{peak_hour:02d}:00 – {(peak_hour + 2) % 24:02d}:00"

    # ── Peak day of week ─────────────────────────────────────────────────────
    days_of_week = group["reported_at"].dt.day_name()
    peak_day = days_of_week.mode().iloc[0] if not days_of_week.empty else "Unknown"

    # ── 7-day trend: compare last 7 vs previous 7 days ───────────────────────
    cutoff_7  = now - timedelta(days=7)
    cutoff_14 = now - timedelta(days=14)
    recent_count = len(group[group["reported_at"] >= cutoff_7])
    prev_count   = len(group[(group["reported_at"] >= cutoff_14) & (group["reported_at"] < cutoff_7)])

    if prev_count == 0 and recent_count > 0:
        trend = f"↑ New hotspot detected"
    elif prev_count == 0:
        trend = "Stable"
    else:
        pct = round(((recent_count - prev_count) / prev_count) * 100)
        arrow = "↑" if pct > 0 else ("↓" if pct < 0 else "→")
        trend = f"{arrow} {abs(pct)}% vs previous 7 days"

    # ── Dominant incident type ───────────────────────────────────────────────
    type_counter = Counter(group["type"].dropna())
    dominant_type = type_counter.most_common(1)[0][0] if type_counter else "MIXED"

    # ── Cluster centroid ─────────────────────────────────────────────────────
    lat = round(group["latitude"].mean(), 5)
    lng = round(group["longitude"].mean(), 5)
    name = f"{dominant_type.title()} Hotspot ({lat}°N, {lng}°E)"

    risk_label = compute_risk_label(risk_score)

    return {
        "lat":           lat,
        "lng":           lng,
        "name":          name,
        "risk":          risk_label,
        "riskScore":     risk_score,
        "confidence":    confidence,
        "incidents":     count,
        "avgSeverity":   round(float(avg_severity), 2),
        "peakTime":      peak_time,
        "peakDay":       peak_day,
        "trend":         trend,
        "dominantType":  dominant_type,
        "action":        recommended_actions(risk_label, dominant_type),
    }


# ─── API Endpoint ─────────────────────────────────────────────────────────────

@app.get("/ml/risk-clusters", response_model=List[RiskCluster], tags=["ML Prediction"])
def get_risk_clusters(
    days: int = Query(default=30, ge=1, le=365, description="Number of past days to analyse"),
    eps_km: float = Query(default=2.0, ge=0.5, le=20.0, description="DBSCAN neighbourhood radius in km"),
    min_samples: int = Query(default=2, ge=1, le=10, description="Min incidents to form a cluster core"),
):
    """
    Returns ML-generated geospatial risk clusters using DBSCAN on historical
    incident data. Each cluster is scored using a multi-feature weighted
    composite formula with exponential recency decay.
    """
    df = load_incidents(days)

    if df.empty:
        return []

    # Run DBSCAN spatial clustering
    labels = run_dbscan(df, eps_km=eps_km, min_samples=min_samples)
    df["cluster"] = labels

    # Discard noise points (label = -1); treat each as its own micro-cluster if severity >= 7
    noise = df[df["cluster"] == -1]
    for _, row in noise.iterrows():
        if row["severity_score"] >= 7:
            new_id = df["cluster"].max() + 1
            df.loc[df["incident_id"] == row["incident_id"], "cluster"] = new_id

    clustered = df[df["cluster"] >= 0]
    if clustered.empty:
        return []

    # Normalisation denominators across all clusters
    groups = {cid: g for cid, g in clustered.groupby("cluster")}
    all_max_count = max(len(g) for g in groups.values())
    all_max_decay = max(
        g["reported_at"].apply(recency_weight).sum()
        for g in groups.values()
    )

    results = []
    for idx, (cid, group) in enumerate(groups.items(), start=1):
        cluster_data = analyze_cluster(group, all_max_count, all_max_decay)
        cluster_data["id"] = idx
        results.append(RiskCluster(**cluster_data))

    # Sort by riskScore descending — highest threat first
    results.sort(key=lambda c: c.riskScore, reverse=True)

    return results


@app.get("/health", tags=["System"])
def health():
    return {"status": "online", "service": "AlertMe ML Risk Engine", "version": "1.0.0"}
