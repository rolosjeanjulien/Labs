"""
Labs MVP — FastAPI server.

Architecture:
  - Data layer  : MongoDB collections + adapter pattern (data_sources/)
  - AI layer    : invie_agent.py (rule-based mock with documented swap point)
  - API layer   : this file — exposes the /api/* endpoints consumed by the app
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from invie_agent import chat as invie_chat
from invie_agent import generate_insight
from seed_data import generate_dataset
from data_sources.apple_health import AppleHealthAdapter
from data_sources.biomarkers import LabsBiomarkerAdapter
from data_sources.manual import ManualEntryAdapter

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
logger = logging.getLogger("labs")

mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

apple_health = AppleHealthAdapter(db)
labs_device = LabsBiomarkerAdapter(db)
manual = ManualEntryAdapter(db)

app = FastAPI(title="Labs API")
api = APIRouter(prefix="/api")


# ---------------- Models --------------------------------------------------- #


class OnboardingPayload(BaseModel):
    name: str = Field(..., min_length=1, max_length=80)
    sport: str = Field(..., min_length=1, max_length=80)
    goal: str = Field(..., min_length=1, max_length=140)
    connect_apple_health: bool = True


class InsightRequest(BaseModel):
    # No body required — server pulls the current context for the demo athlete.
    pass


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500)


# ---------------- Seeding -------------------------------------------------- #


async def ensure_seed() -> None:
    """Idempotently seed the demo athlete dataset on startup."""
    existing = await db.athlete.find_one({"_id": "demo"})
    if existing:
        return
    logger.info("Seeding demo dataset…")
    data = generate_dataset()
    await db.athlete.replace_one({"_id": "demo"}, {"_id": "demo", **data["athlete"]}, upsert=True)
    if data["days"]:
        await db.daily_metrics.delete_many({})
        await db.daily_metrics.insert_many([dict(d) for d in data["days"]])
    if data["biomarkers"]:
        await db.biomarkers.delete_many({})
        await db.biomarkers.insert_many([dict(b) for b in data["biomarkers"]])
    await db.baselines.replace_one(
        {"_id": "demo"}, {"_id": "demo", **data["baselines"]}, upsert=True
    )
    await db.sources.delete_many({})
    await db.sources.insert_many([dict(s) for s in data["sources"]])
    logger.info("Seed complete: %d days, %d biomarker readings", len(data["days"]), len(data["biomarkers"]))


@app.on_event("startup")
async def _startup() -> None:
    await ensure_seed()


@app.on_event("shutdown")
async def _shutdown() -> None:
    client.close()


# ---------------- Helpers -------------------------------------------------- #


async def _load_context() -> dict[str, Any]:
    athlete = await db.athlete.find_one({"_id": "demo"}, {"_id": 0})
    if not athlete:
        raise HTTPException(404, "Demo athlete not found")
    baselines = await db.baselines.find_one({"_id": "demo"}, {"_id": 0})
    days = (
        await db.daily_metrics.find({}, {"_id": 0}).sort("day_index", 1).to_list(length=None)
    )
    biomarkers = (
        await db.biomarkers.find({}, {"_id": 0}).sort("day_index", 1).to_list(length=None)
    )
    if not days or not biomarkers:
        raise HTTPException(500, "Dataset missing")
    return {
        "athlete": athlete,
        "latest_day": days[-1],
        "latest_biomarker": biomarkers[-1],
        "recent_days": days[-14:],
        "recent_biomarkers": biomarkers[-8:],
        "baselines": baselines,
        "calibration_complete": athlete.get("calibration_complete", False),
        "all_days": days,
        "all_biomarkers": biomarkers,
    }


# ---------------- Endpoints ------------------------------------------------ #


@api.get("/")
async def root() -> dict[str, str]:
    return {"app": "Labs", "status": "ok"}


@api.post("/onboarding")
async def onboarding(payload: OnboardingPayload) -> dict[str, Any]:
    update = {
        "name": payload.name,
        "sport": payload.sport,
        "goal": payload.goal,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.athlete.update_one({"_id": "demo"}, {"$set": update}, upsert=False)

    if payload.connect_apple_health:
        await db.sources.update_one(
            {"id": "apple_health"},
            {
                "$set": {
                    "status": "connected",
                    "last_sync": datetime.now(timezone.utc).isoformat(),
                }
            },
        )
    return {"ok": True, "athlete": update}


@api.get("/athlete")
async def get_athlete() -> dict[str, Any]:
    athlete = await db.athlete.find_one({"_id": "demo"}, {"_id": 0})
    if not athlete:
        raise HTTPException(404, "Athlete not found")
    baselines = await db.baselines.find_one({"_id": "demo"}, {"_id": 0})
    return {"athlete": athlete, "baselines": baselines}


@api.get("/today")
async def get_today() -> dict[str, Any]:
    ctx = await _load_context()
    insight = generate_insight(ctx)
    day = ctx["latest_day"]
    bio = ctx["latest_biomarker"]
    bl = ctx["baselines"]

    return {
        "date": day["date"],
        "readiness": {
            "score": insight["score"],
            "verdict": insight["verdict"],
            "confidence": insight["confidence"],
            "band": {"low": 55, "mid": 72, "high": 88},
            "history": [
                {"date": d["date"], "value": _readiness_quick(d, b, bl)}
                for d, b in _pair_recent(ctx["all_days"][-21:], ctx["all_biomarkers"])
            ],
        },
        "narrative": insight["narrative"],
        "drivers": insight["drivers"],
        "signals": [
            {
                "key": "hrv",
                "label": "HRV",
                "value": day["hrv_rmssd_ms"],
                "unit": "ms",
                "band": bl["hrv_rmssd_ms"],
                "delta_pct": _pct(day["hrv_rmssd_ms"], bl["hrv_rmssd_ms"]["mid"]),
                "source": "apple_health",
            },
            {
                "key": "sleep",
                "label": "Sleep",
                "value": day["sleep_hours"],
                "unit": "h",
                "band": bl["sleep_hours"],
                "delta_pct": _pct(day["sleep_hours"], bl["sleep_hours"]["mid"]),
                "source": "apple_health",
            },
            {
                "key": "load",
                "label": "7d Load",
                "value": day["training_load_7d"],
                "unit": "TL",
                "band": bl["training_load_7d"],
                "delta_pct": _pct(day["training_load_7d"], bl["training_load_7d"]["mid"]),
                "source": "apple_health",
            },
            {
                "key": "siga",
                "label": "sIgA",
                "value": bio["siga_ug_ml"],
                "unit": "µg/mL",
                "band": bl["siga_ug_ml"],
                "delta_pct": _pct(bio["siga_ug_ml"], bl["siga_ug_ml"]["mid"]),
                "source": "labs_device",
            },
        ],
        "sovereignty": {"region": "France", "owner": "you"},
    }


def _pct(value: float, mid: float) -> float:
    if mid == 0:
        return 0.0
    return round((value - mid) / mid * 100.0, 1)


def _readiness_quick(day: dict, bio: dict, bl: dict) -> int:
    """Fast readiness recompute for the history sparkline."""
    # Simple weighted z-style mapping into 0–100.
    def s(v, band, *, lower=False):
        lo, mid, hi = band["low"], band["mid"], band["high"]
        if lower:
            v, lo, mid, hi = -v, -hi, -mid, -lo
        if v >= hi:
            return 100
        if v <= lo:
            return 35
        if v >= mid:
            return 70 + (v - mid) / (hi - mid) * 30
        return 35 + (v - lo) / (mid - lo) * 35

    val = (
        s(day["hrv_rmssd_ms"], bl["hrv_rmssd_ms"]) * 0.30
        + s(day["sleep_hours"], bl["sleep_hours"]) * 0.22
        + s(day["resting_hr_bpm"], bl["resting_hr_bpm"], lower=True) * 0.15
        + s(day["training_load_7d"], bl["training_load_7d"], lower=True) * 0.15
        + s(bio["siga_ug_ml"], bl["siga_ug_ml"]) * 0.18
    )
    return round(val)


def _pair_recent(days, biomarkers):
    """For each recent day, pair with the most recent biomarker on/before it."""
    out = []
    for d in days:
        b = max(
            (x for x in biomarkers if x["day_index"] <= d["day_index"]),
            key=lambda x: x["day_index"],
            default=biomarkers[0],
        )
        out.append((d, b))
    return out


@api.get("/biomarkers/{metric}")
async def get_biomarker(metric: Literal["siga", "cortisol", "testosterone", "creatinine"]) -> dict[str, Any]:
    field_map = {
        "siga": ("siga_ug_ml", "µg/mL", "sIgA", "Mucosal immunity"),
        "cortisol": ("cortisol_nmol_l", "nmol/L", "Cortisol", "Stress hormone (AM)"),
        "testosterone": ("testosterone_pg_ml", "pg/mL", "Testosterone", "Anabolic recovery"),
        "creatinine": ("creatinine_mg_dl", "mg/dL", "Creatinine", "Muscle / hydration"),
    }
    field, unit, label, subtitle = field_map[metric]
    biomarkers = (
        await db.biomarkers.find({}, {"_id": 0}).sort("day_index", 1).to_list(length=None)
    )
    days = (
        await db.daily_metrics.find({}, {"_id": 0}).sort("day_index", 1).to_list(length=None)
    )
    baselines = await db.baselines.find_one({"_id": "demo"}, {"_id": 0})
    band = baselines[field]

    series = [{"date": b["date"], "day_index": b["day_index"], "value": b[field]} for b in biomarkers]
    training_load = [
        {"date": d["date"], "day_index": d["day_index"], "value": d["training_load"]}
        for d in days
    ]

    latest = series[-1]
    prev = series[-2] if len(series) > 1 else latest
    delta_abs = round(latest["value"] - prev["value"], 2)
    delta_pct = _pct(latest["value"], prev["value"])

    return {
        "metric": metric,
        "label": label,
        "subtitle": subtitle,
        "unit": unit,
        "band": band,
        "series": series,
        "training_load": training_load,
        "latest": latest,
        "delta_abs": delta_abs,
        "delta_pct": delta_pct,
        "position": "below" if latest["value"] < band["low"] else "above" if latest["value"] > band["high"] else "in",
    }


@api.get("/trends")
async def get_trends(range: Literal["2w", "6w", "3m"] = "6w") -> dict[str, Any]:
    days_window = {"2w": 14, "6w": 42, "3m": 90}[range]
    days = (
        await db.daily_metrics.find({}, {"_id": 0}).sort("day_index", 1).to_list(length=None)
    )
    biomarkers = (
        await db.biomarkers.find({}, {"_id": 0}).sort("day_index", 1).to_list(length=None)
    )
    baselines = await db.baselines.find_one({"_id": "demo"}, {"_id": 0})

    days = days[-days_window:]
    min_idx = days[0]["day_index"]
    biomarkers = [b for b in biomarkers if b["day_index"] >= min_idx]

    def series_of(items: list[dict], key: str) -> list[dict[str, Any]]:
        return [{"date": x["date"], "day_index": x["day_index"], "value": x[key]} for x in items]

    return {
        "range": range,
        "metrics": [
            {"key": "hrv", "label": "HRV", "unit": "ms", "band": baselines["hrv_rmssd_ms"],
             "kind": "wearable", "series": series_of(days, "hrv_rmssd_ms")},
            {"key": "sleep", "label": "Sleep", "unit": "h", "band": baselines["sleep_hours"],
             "kind": "wearable", "series": series_of(days, "sleep_hours")},
            {"key": "training_load", "label": "Training Load", "unit": "TL",
             "band": baselines["training_load"], "kind": "wearable",
             "series": series_of(days, "training_load")},
            {"key": "siga", "label": "sIgA", "unit": "µg/mL", "band": baselines["siga_ug_ml"],
             "kind": "biomarker", "series": series_of(biomarkers, "siga_ug_ml")},
            {"key": "cortisol", "label": "Cortisol", "unit": "nmol/L",
             "band": baselines["cortisol_nmol_l"], "kind": "biomarker",
             "series": series_of(biomarkers, "cortisol_nmol_l")},
            {"key": "testosterone", "label": "Testosterone", "unit": "pg/mL",
             "band": baselines["testosterone_pg_ml"], "kind": "biomarker",
             "series": series_of(biomarkers, "testosterone_pg_ml")},
        ],
    }


@api.post("/invie/insight")
async def post_invie_insight(_: InsightRequest = InsightRequest()) -> dict[str, Any]:
    ctx = await _load_context()
    return generate_insight(ctx)


@api.post("/invie/chat")
async def post_invie_chat(req: ChatRequest) -> dict[str, Any]:
    ctx = await _load_context()
    return invie_chat(req.message, ctx)


@api.get("/vault/sources")
async def vault_sources() -> dict[str, Any]:
    statuses = [await a.status() for a in (apple_health, labs_device, manual)]
    athlete = await db.athlete.find_one({"_id": "demo"}, {"_id": 0})
    days = await db.daily_metrics.count_documents({})
    bios = await db.biomarkers.count_documents({})
    return {
        "sovereignty": {
            "region": "France",
            "host": "Sovereign EU cloud",
            "compliance": ["RGPD"],
            "owner": athlete["name"] if athlete else "you",
        },
        "sources": statuses,
        "totals": {"daily_metrics": days, "biomarker_readings": bios},
    }


# Mount router & middleware
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
