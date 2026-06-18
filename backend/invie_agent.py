"""
Invie — Pluggable AI agent (MVP placeholder).

This module is the SINGLE source of truth for any natural-language interpretation
of an athlete's data. Both the dashboard narrative block and the conversational
chat call into `generate_insight()` and `chat()` here.

# INVIE_AGENT_PLACEHOLDER
# -----------------------------------------------------------------------------
# This implementation is a deterministic rule/template engine. It consumes the
# *same* structured context (readiness, recent biomarkers, recent wearables,
# baselines) that a real LLM-backed agent would consume.
#
# To swap in a real agent later, replace the bodies of `generate_insight()` and
# `chat()` with calls to your hosted LLM service. Do NOT change the function
# signatures or the response shape — the entire front-end depends on this
# contract.
# -----------------------------------------------------------------------------
"""

from __future__ import annotations

from typing import Any, Literal

Verdict = Literal["train_hard", "moderate", "recover"]


# ---------- helpers --------------------------------------------------------- #


def _delta_pct(value: float, baseline_mid: float) -> float:
    if baseline_mid == 0:
        return 0.0
    return round((value - baseline_mid) / baseline_mid * 100.0, 1)


def _band_position(value: float, band: dict[str, float]) -> str:
    """Return 'below' | 'in' | 'above' relative to the personal band."""
    if value < band["low"]:
        return "below"
    if value > band["high"]:
        return "above"
    return "in"


# ---------- readiness ------------------------------------------------------- #


def compute_readiness(context: dict[str, Any]) -> dict[str, Any]:
    """Pure scoring function — returns the structured readiness payload.

    Inputs (all from `context`):
      - latest day metrics (hrv, sleep, training_load_7d, resting_hr)
      - latest biomarker (siga)
      - baselines
    """
    day = context["latest_day"]
    bio = context["latest_biomarker"]
    bl = context["baselines"]

    drivers: list[dict[str, Any]] = []

    def score(value: float, band: dict[str, float], *, lower_is_better: bool = False) -> float:
        # Map band into 0–100. Mid = 70, high = 100, low = 40.
        if lower_is_better:
            value = -value
            band = {"low": -band["high"], "mid": -band["mid"], "high": -band["low"]}
        if value >= band["high"]:
            return 100.0
        if value <= band["low"]:
            return 35.0
        if value >= band["mid"]:
            span = band["high"] - band["mid"] or 1
            return 70 + (value - band["mid"]) / span * 30
        span = band["mid"] - band["low"] or 1
        return 35 + (value - band["low"]) / span * 35

    hrv_score = score(day["hrv_rmssd_ms"], bl["hrv_rmssd_ms"])
    sleep_score = score(day["sleep_hours"], bl["sleep_hours"])
    rhr_score = score(day["resting_hr_bpm"], bl["resting_hr_bpm"], lower_is_better=True)
    load_score = score(
        day["training_load_7d"], bl["training_load_7d"], lower_is_better=True
    )
    siga_score = score(bio["siga_ug_ml"], bl["siga_ug_ml"])

    readiness = round(
        hrv_score * 0.28
        + sleep_score * 0.22
        + rhr_score * 0.15
        + load_score * 0.15
        + siga_score * 0.20
    )

    # build drivers (sorted by magnitude of contribution vs midpoint)
    raw = [
        ("HRV", hrv_score, day["hrv_rmssd_ms"], bl["hrv_rmssd_ms"], "ms"),
        ("Sleep", sleep_score, day["sleep_hours"], bl["sleep_hours"], "h"),
        ("Resting HR", rhr_score, day["resting_hr_bpm"], bl["resting_hr_bpm"], "bpm"),
        ("7d Load", load_score, day["training_load_7d"], bl["training_load_7d"], "TL"),
        ("sIgA", siga_score, bio["siga_ug_ml"], bl["siga_ug_ml"], "µg/mL"),
    ]
    for label, s, v, band, unit in raw:
        drivers.append(
            {
                "label": label,
                "value": v,
                "unit": unit,
                "score": round(s),
                "position": _band_position(v, band),
                "delta_pct": _delta_pct(v, band["mid"]),
            }
        )

    if readiness >= 78:
        verdict: Verdict = "train_hard"
    elif readiness >= 55:
        verdict = "moderate"
    else:
        verdict = "recover"

    return {
        "score": readiness,
        "verdict": verdict,
        "drivers": drivers,
        "confidence": 0.78 if context.get("calibration_complete") else 0.55,
    }


# ---------- narrative ------------------------------------------------------- #


def _narrative(readiness: dict[str, Any], context: dict[str, Any]) -> str:
    drivers = readiness["drivers"]
    siga = next(d for d in drivers if d["label"] == "sIgA")
    hrv = next(d for d in drivers if d["label"] == "HRV")
    load = next(d for d in drivers if d["label"] == "7d Load")
    sleep = next(d for d in drivers if d["label"] == "Sleep")

    parts: list[str] = []

    if readiness["verdict"] == "train_hard":
        parts.append("Your system reads green across the board.")
        if hrv["position"] in ("in", "above"):
            parts.append(
                f"HRV sits at {hrv['value']:.0f} ms, holding inside your personal band."
            )
        parts.append("Quality intensity is on the table today.")
    elif readiness["verdict"] == "moderate":
        parts.append("Mixed signals — train, but trim the edges.")
        if load["position"] == "above":
            parts.append(
                f"Your 7-day load is running {load['delta_pct']:+.0f}% above baseline."
            )
        if sleep["position"] == "below":
            parts.append(
                f"Sleep landed at {sleep['value']:.1f}h, under your usual {sleep['unit']} band."
            )
        if not (load["position"] == "above" or sleep["position"] == "below"):
            parts.append("Hold aerobic, skip the top-end work.")
    else:  # recover
        parts.append("Your body is asking for repair.")
        if siga["position"] == "below":
            parts.append(
                f"sIgA dropped to {siga['value']:.0f} µg/mL — mucosal immunity is dented."
            )
        if hrv["position"] == "below":
            parts.append(
                f"HRV is {hrv['delta_pct']:+.0f}% vs baseline; nervous system isn't there yet."
            )
        parts.append("Easy aerobic or full rest today.")

    return " ".join(parts)


# ---------- public API ------------------------------------------------------ #


def generate_insight(context: dict[str, Any]) -> dict[str, Any]:
    """Single entrypoint used by the Today screen.

    Args:
        context: {
            "latest_day": <day metrics dict>,
            "latest_biomarker": <biomarker dict>,
            "baselines": <baselines dict>,
            "recent_days": [...],
            "recent_biomarkers": [...],
            "calibration_complete": bool,
        }

    Returns:
        {
            "narrative": str,
            "verdict": "train_hard" | "moderate" | "recover",
            "score": int,
            "confidence": float,
            "drivers": [{label, value, unit, score, position, delta_pct}, ...],
        }
    """
    readiness = compute_readiness(context)
    return {
        "narrative": _narrative(readiness, context),
        "verdict": readiness["verdict"],
        "score": readiness["score"],
        "confidence": readiness["confidence"],
        "drivers": readiness["drivers"],
    }


# ---------- chat (Q&A) ------------------------------------------------------ #


_INTENT_KEYWORDS = {
    "readiness_low": ["readiness", "score", "low", "tired", "fatigue", "why"],
    "siga": ["siga", "immune", "immunity", "sick", "illness", "cold"],
    "cortisol": ["cortisol", "stress", "stressed"],
    "testosterone": ["testosterone", "recovery", "anabolic"],
    "creatinine": ["creatinine", "hydration", "kidney"],
    "training": ["train", "training", "workout", "session", "today"],
    "sleep": ["sleep", "rest", "bed"],
    "hrv": ["hrv", "variability", "nervous", "parasympathetic"],
    "baseline": ["baseline", "normal", "range", "band"],
}


def _detect_intent(message: str) -> str:
    m = message.lower()
    best, best_n = "general", 0
    for intent, kws in _INTENT_KEYWORDS.items():
        n = sum(1 for k in kws if k in m)
        if n > best_n:
            best, best_n = intent, n
    return best


def chat(message: str, context: dict[str, Any]) -> dict[str, Any]:
    """Conversational entrypoint used by the Invie screen.

    Returns:
        { "reply": str, "verdict": Verdict, "drivers": [...] }
    """
    readiness = compute_readiness(context)
    drivers = {d["label"]: d for d in readiness["drivers"]}
    bio = context["latest_biomarker"]
    bl = context["baselines"]
    day = context["latest_day"]
    intent = _detect_intent(message)

    if intent == "readiness_low":
        below = [d["label"] for d in readiness["drivers"] if d["position"] == "below"]
        if below:
            reply = (
                f"Readiness sits at {readiness['score']}. The drag is coming from "
                f"{', '.join(below)} — each landed under your personal baseline band today."
            )
        else:
            reply = (
                f"Readiness is {readiness['score']}. No single signal is below baseline; "
                "the score reflects a mild composite drift rather than one weak link."
            )
    elif intent == "siga":
        siga = drivers["sIgA"]
        band = bl["siga_ug_ml"]
        reply = (
            f"Your latest sIgA reading is {bio['siga_ug_ml']:.0f} µg/mL "
            f"(personal band {band['low']:.0f}–{band['high']:.0f}). "
            + (
                "That's below your band — mucosal immunity is suppressed. "
                "Expect a higher illness window over the next 5–7 days."
                if siga["position"] == "below"
                else "Inside your band — immunity is holding."
                if siga["position"] == "in"
                else "Above your band — recovery state looks robust."
            )
        )
    elif intent == "cortisol":
        c = bio["cortisol_nmol_l"]
        band = bl["cortisol_nmol_l"]
        reply = (
            f"Morning cortisol is {c:.0f} nmol/L (band {band['low']:.0f}–{band['high']:.0f}). "
            + (
                "Elevated vs your norm — likely accumulated training stress."
                if c > band["high"]
                else "Inside your usual band."
            )
        )
    elif intent == "training":
        if readiness["verdict"] == "train_hard":
            reply = "Today is a green light — go after a quality session. Intervals or threshold work are appropriate."
        elif readiness["verdict"] == "moderate":
            reply = "Train, but cap intensity. Aerobic Z2 with a few short pickups, not a key session."
        else:
            reply = "Recovery day. Walk, mobility, or skip entirely. Don't try to train through this one."
    elif intent == "sleep":
        s = drivers["Sleep"]
        reply = (
            f"You logged {day['sleep_hours']:.1f}h last night. That's {s['delta_pct']:+.0f}% vs your "
            f"personal sleep baseline of {bl['sleep_hours']['mid']:.1f}h."
        )
    elif intent == "hrv":
        h = drivers["HRV"]
        reply = (
            f"HRV came in at {day['hrv_rmssd_ms']:.0f} ms ({h['delta_pct']:+.0f}% vs band midpoint). "
            f"Personal band: {bl['hrv_rmssd_ms']['low']:.0f}–{bl['hrv_rmssd_ms']['high']:.0f} ms."
        )
    elif intent == "baseline":
        reply = (
            "Every value here is judged against your own historical band, not population norms. "
            "Bands are computed from your first weeks of data and update as more readings come in."
        )
    else:
        reply = (
            f"Right now your readiness is {readiness['score']} — verdict: "
            f"{readiness['verdict'].replace('_', ' ')}. Ask me about a specific signal "
            "(sIgA, HRV, sleep, cortisol) for more detail."
        )

    return {
        "reply": reply,
        "verdict": readiness["verdict"],
        "drivers": readiness["drivers"],
    }
