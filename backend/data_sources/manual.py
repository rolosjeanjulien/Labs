"""Manual data entry adapter (stub — future-ready)."""

from __future__ import annotations

from typing import Any

from . import DataSourceAdapter


class ManualEntryAdapter(DataSourceAdapter):
    id = "manual"
    label = "Manual entries"
    kind = "manual"

    def __init__(self, db) -> None:
        self.db = db

    async def fetch(self) -> list[dict[str, Any]]:
        cursor = self.db.manual_entries.find({}, {"_id": 0})
        return await cursor.to_list(length=None)

    async def status(self) -> dict[str, Any]:
        doc = await self.db.sources.find_one({"id": self.id}, {"_id": 0})
        return doc or {
            "id": self.id,
            "label": self.label,
            "kind": self.kind,
            "status": "idle",
            "last_sync": None,
            "metrics": ["Notes", "Subjective load"],
        }
