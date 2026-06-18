"""Labs biomarker device adapter."""

from __future__ import annotations

from typing import Any

from . import DataSourceAdapter


class LabsBiomarkerAdapter(DataSourceAdapter):
    id = "labs_device"
    label = "Labs Biomarker Device"
    kind = "biomarker"

    def __init__(self, db) -> None:
        self.db = db

    async def fetch(self) -> list[dict[str, Any]]:
        cursor = self.db.biomarkers.find({}, {"_id": 0}).sort("day_index", 1)
        rows = await cursor.to_list(length=None)
        readings: list[dict[str, Any]] = []
        for r in rows:
            for metric, unit in (
                ("siga_ug_ml", "µg/mL"),
                ("cortisol_nmol_l", "nmol/L"),
                ("testosterone_pg_ml", "pg/mL"),
                ("creatinine_mg_dl", "mg/dL"),
            ):
                readings.append(
                    {
                        "date": r["date"],
                        "metric": metric,
                        "value": r[metric],
                        "unit": unit,
                        "source": self.id,
                    }
                )
        return readings

    async def status(self) -> dict[str, Any]:
        doc = await self.db.sources.find_one({"id": self.id}, {"_id": 0})
        return doc or {
            "id": self.id,
            "label": self.label,
            "kind": self.kind,
            "status": "disconnected",
            "last_sync": None,
            "metrics": ["sIgA", "Cortisol", "Testosterone", "Creatinine"],
        }
