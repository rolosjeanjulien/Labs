"""Apple Health adapter.

In an Expo Go context HealthKit is not available. This adapter is structured
so the same `fetch()` contract is honoured by a future native HealthKit bridge
(or Vital/Terra) — only the body of `fetch()` changes.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from . import DataSourceAdapter


class AppleHealthAdapter(DataSourceAdapter):
    id = "apple_health"
    label = "Apple Health"
    kind = "wearable"

    def __init__(self, db) -> None:
        self.db = db

    async def fetch(self) -> list[dict[str, Any]]:
        """Read normalised daily wearable readings from Mongo.

        Real HealthKit swap-in point: replace this Mongo read with a call to
        the native HealthKit bridge (or middleware like Vital/Terra), keeping
        the same return shape.
        """
        cursor = self.db.daily_metrics.find({}, {"_id": 0}).sort("day_index", 1)
        days = await cursor.to_list(length=None)
        readings: list[dict[str, Any]] = []
        for d in days:
            for metric, unit in (
                ("hrv_rmssd_ms", "ms"),
                ("resting_hr_bpm", "bpm"),
                ("sleep_hours", "h"),
                ("training_load", "TL"),
                ("steps", "count"),
                ("active_energy_kcal", "kcal"),
            ):
                readings.append(
                    {
                        "date": d["date"],
                        "metric": metric,
                        "value": d[metric],
                        "unit": unit,
                        "source": self.id,
                    }
                )
        return readings

    async def status(self) -> dict[str, Any]:
        doc = await self.db.sources.find_one({"id": self.id}, {"_id": 0})
        if doc:
            return doc
        return {
            "id": self.id,
            "label": self.label,
            "kind": self.kind,
            "status": "disconnected",
            "last_sync": None,
            "metrics": ["HRV", "Resting HR", "Sleep", "Training Load", "Steps"],
        }
