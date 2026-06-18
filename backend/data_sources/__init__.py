"""
Data source adapters.

Each adapter exposes the same interface so the rest of the app never knows
whether a reading came from Apple Health, the Labs biomarker device, or manual
entry. New sources (Strava, Vital/Terra, manual entry) plug in by subclassing
`DataSourceAdapter` and registering themselves in `registry.py`.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any


class DataSourceAdapter(ABC):
    """Base contract every data source must implement."""

    id: str
    label: str
    kind: str  # "wearable" | "biomarker" | "manual"

    @abstractmethod
    async def fetch(self) -> list[dict[str, Any]]:
        """Return a list of normalised reading dicts.

        Reading shape:
          { "date": ISO8601, "metric": str, "value": float, "unit": str,
            "source": <self.id> }
        """
        ...

    @abstractmethod
    async def status(self) -> dict[str, Any]:
        """Return the connection/sync status for the Vault screen."""
        ...
