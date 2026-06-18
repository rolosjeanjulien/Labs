"""
Deterministic demo dataset generator for the Labs MVP.

Persona: Léa Moreau, trail runner, training for a 100K ultra.
~70 days of physiologically coherent data.

Story arc embedded in the data:
  - Days 0–29  : steady base building (moderate TL, stable biomarkers)
  - Days 30–40 : 11-day high-load block, peaking with a 4h+ long run day 38
  - Days 41–48 : visible sIgA dip (mucosal immunity hit), elevated cortisol
  - Days 49–70 : taper + recovery, biomarkers normalize, readiness climbs

All values are physiologically plausible for a trained female endurance athlete.
"""

import math
import random
from datetime import datetime, timedelta, timezone
from typing import Any

# Reproducible
random.seed(42)

TOTAL_DAYS = 70
TODAY = datetime.now(timezone.utc).replace(hour=7, minute=0, second=0, microsecond=0)
START = TODAY - timedelta(days=TOTAL_DAYS - 1)


def _jit(base: float, sd: float) -> float:
    return base + random.gauss(0, sd)


def _training_load_for_day(d: int) -> float:
    """TRIMP-style score 0–350. Encodes the story arc."""
    # base building
    if d < 30:
        # 6-day cycle: easy easy moderate easy long rest
        cycle = [60, 70, 110, 60, 160, 0][d % 6]
        return max(0, _jit(cycle, 12))
    # high-load block
    if d < 40:
        cycle = [140, 160, 200, 120, 210, 90, 230, 80, 260, 320][d - 30]
        return max(0, _jit(cycle, 18))
    # immediate post-block recovery week (low load)
    if d < 48:
        return max(0, _jit(40, 15))
    # taper / re-build
    cycle = [80, 100, 60, 130, 50, 150, 0][(d - 48) % 7]
    return max(0, _jit(cycle, 12))


def _hrv_for_day(d: int, tl_yesterday: float) -> float:
    """rMSSD ms. Inversely couples to yesterday's training load."""
    base = 68.0
    # high TL yesterday => lower HRV today
    drag = (tl_yesterday / 300.0) * 14.0
    # post-block dip
    if 40 <= d < 50:
        base -= 9
    return max(28, _jit(base - drag, 4.5))


def _resting_hr_for_day(d: int, tl_yesterday: float) -> float:
    base = 48.0
    bump = (tl_yesterday / 300.0) * 6.0
    if 40 <= d < 50:
        base += 3
    return max(40, _jit(base + bump, 1.8))


def _sleep_for_day(d: int) -> float:
    base = 7.6
    if 30 <= d < 40:
        base -= 0.5  # squeezed sleep during high block
    return max(4.5, min(9.5, _jit(base, 0.55)))


def _steps_for_day(d: int, tl: float) -> int:
    base = 9500 + tl * 15
    return int(max(3000, _jit(base, 1100)))


def _active_energy_for_day(tl: float) -> int:
    return int(max(180, _jit(380 + tl * 3.2, 80)))


def _siga_for_day(d: int, cumulative_load: float) -> float:
    """sIgA µg/mL — saliva mucosal immunity. Normal athlete range ~100–300.
    Decline with cumulative load, sharp dip after the high-load block."""
    base = 215.0
    base -= cumulative_load * 0.045
    if 38 <= d <= 47:
        # the dip
        depth = 1.0 - abs(d - 42) / 6.0
        base -= 95 * max(0, depth)
    if 48 <= d < 56:
        # gradual recovery
        base -= 30 * (1 - (d - 48) / 8)
    return max(55, _jit(base, 14))


def _cortisol_for_day(d: int) -> float:
    """Morning cortisol nmol/L. Normal AM range ~250–700."""
    base = 410.0
    if 30 <= d < 45:
        base += 110  # stress block
    return max(180, _jit(base, 35))


def _testosterone_for_day(d: int) -> float:
    """Free testosterone pg/mL. Female athlete range ~1.5–6.0."""
    base = 3.4
    if 35 <= d < 48:
        base -= 0.7
    return max(1.0, _jit(base, 0.25))


def _creatinine_for_day(d: int, tl: float) -> float:
    """Urinary creatinine mg/dL. Hydration / muscle turnover proxy."""
    base = 1.08 + tl * 0.0009
    return max(0.6, _jit(base, 0.08))


def generate_dataset() -> dict[str, Any]:
    days: list[dict[str, Any]] = []
    tl_yesterday = 0.0
    cumulative_load_7d: list[float] = []

    for d in range(TOTAL_DAYS):
        date = START + timedelta(days=d)
        tl = _training_load_for_day(d)
        cumulative_load_7d.append(tl)
        if len(cumulative_load_7d) > 7:
            cumulative_load_7d.pop(0)
        load_7d = sum(cumulative_load_7d)

        hrv = _hrv_for_day(d, tl_yesterday)
        rhr = _resting_hr_for_day(d, tl_yesterday)
        sleep_h = _sleep_for_day(d)
        steps = _steps_for_day(d, tl)
        active_kcal = _active_energy_for_day(tl)

        days.append(
            {
                "date": date.isoformat(),
                "day_index": d,
                "training_load": round(tl, 1),
                "training_load_7d": round(load_7d, 1),
                "hrv_rmssd_ms": round(hrv, 1),
                "resting_hr_bpm": round(rhr, 1),
                "sleep_hours": round(sleep_h, 2),
                "steps": steps,
                "active_energy_kcal": active_kcal,
            }
        )
        tl_yesterday = tl

    # Biomarker readings every 2-3 days
    biomarkers: list[dict[str, Any]] = []
    d = 1
    while d < TOTAL_DAYS:
        date = START + timedelta(days=d)
        # cumulative load up to that day
        cl = sum(x["training_load"] for x in days[max(0, d - 7) : d])
        biomarkers.append(
            {
                "date": date.isoformat(),
                "day_index": d,
                "siga_ug_ml": round(_siga_for_day(d, cl), 1),
                "cortisol_nmol_l": round(_cortisol_for_day(d), 1),
                "testosterone_pg_ml": round(_testosterone_for_day(d), 2),
                "creatinine_mg_dl": round(_creatinine_for_day(d, days[d]["training_load"]), 2),
            }
        )
        d += random.choice([2, 2, 3])

    # Compute baselines using FIRST 28 days (calibration period)
    calibration = days[:28]
    bio_calibration = [b for b in biomarkers if b["day_index"] < 28]

    def _band(values: list[float]) -> dict[str, float]:
        if not values:
            return {"low": 0, "mid": 0, "high": 0}
        sorted_v = sorted(values)
        n = len(sorted_v)
        return {
            "low": round(sorted_v[max(0, int(n * 0.15))], 2),
            "mid": round(sum(sorted_v) / n, 2),
            "high": round(sorted_v[min(n - 1, int(n * 0.85))], 2),
        }

    baselines = {
        "hrv_rmssd_ms": _band([x["hrv_rmssd_ms"] for x in calibration]),
        "resting_hr_bpm": _band([x["resting_hr_bpm"] for x in calibration]),
        "sleep_hours": _band([x["sleep_hours"] for x in calibration]),
        "training_load": _band([x["training_load"] for x in calibration]),
        "training_load_7d": _band([x["training_load_7d"] for x in calibration]),
        "steps": _band([float(x["steps"]) for x in calibration]),
        "siga_ug_ml": _band([x["siga_ug_ml"] for x in bio_calibration]),
        "cortisol_nmol_l": _band([x["cortisol_nmol_l"] for x in bio_calibration]),
        "testosterone_pg_ml": _band([x["testosterone_pg_ml"] for x in bio_calibration]),
        "creatinine_mg_dl": _band([x["creatinine_mg_dl"] for x in bio_calibration]),
    }

    return {
        "athlete": {
            "name": "Léa Moreau",
            "sport": "Trail running",
            "goal": "100K Ultra · September",
            "created_at": START.isoformat(),
            "calibration_complete": True,
        },
        "days": days,
        "biomarkers": biomarkers,
        "baselines": baselines,
        "sources": [
            {
                "id": "apple_health",
                "label": "Apple Health",
                "kind": "wearable",
                "status": "connected",
                "last_sync": (TODAY - timedelta(minutes=14)).isoformat(),
                "metrics": ["HRV", "Resting HR", "Sleep", "Training Load", "Steps"],
            },
            {
                "id": "labs_device",
                "label": "Labs Biomarker Device",
                "kind": "biomarker",
                "status": "connected",
                "last_sync": (TODAY - timedelta(hours=6)).isoformat(),
                "metrics": ["sIgA", "Cortisol", "Testosterone", "Creatinine"],
            },
            {
                "id": "manual",
                "label": "Manual entries",
                "kind": "manual",
                "status": "idle",
                "last_sync": None,
                "metrics": ["Notes", "Subjective load"],
            },
        ],
    }


if __name__ == "__main__":
    import json

    data = generate_dataset()
    print(json.dumps({"days": len(data["days"]), "biomarkers": len(data["biomarkers"])}, indent=2))
    print("Latest day:", data["days"][-1])
    print("Latest biomarker:", data["biomarkers"][-1])
    print("Baselines:", json.dumps(data["baselines"], indent=2))
