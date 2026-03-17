from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

from src.domain.model.model_price import ModelPrice

_SCHEMA_VERSION = 1
_CACHE_FILE = ".ppia/llm-pricing.json"


class PricingStore:
    def __init__(self, project_root: str) -> None:
        self._cache_path = Path(project_root) / _CACHE_FILE

    def read(self) -> dict[str, ModelPrice]:
        """Read cached prices. Returns empty dict if file is missing or corrupted."""
        try:
            raw = self._cache_path.read_text(encoding="utf-8")
            data: dict[str, object] = json.loads(raw)
            models_raw: dict[str, object] = data.get("models", {})  # type: ignore[assignment]
            result: dict[str, ModelPrice] = {}
            for model_id, fields in models_raw.items():
                result[model_id] = ModelPrice.model_validate(fields)
            return result
        except Exception:  # noqa: BLE001
            return {}

    def write(self, prices: list[ModelPrice]) -> None:
        """Atomically write prices to cache file."""
        fetched_at = datetime.now(timezone.utc).date().isoformat()
        models: dict[str, object] = {
            price.model_id: price.model_dump() for price in prices
        }
        payload: dict[str, object] = {
            "schema_version": _SCHEMA_VERSION,
            "fetched_at": fetched_at,
            "models": models,
        }

        self._cache_path.parent.mkdir(parents=True, exist_ok=True)

        tmp_path = self._cache_path.with_suffix(".tmp")
        try:
            tmp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            os.replace(tmp_path, self._cache_path)
        finally:
            if tmp_path.exists():
                tmp_path.unlink()

    def is_fresh(self) -> bool:
        """Return True if the cache was fetched today (UTC)."""
        try:
            raw = self._cache_path.read_text(encoding="utf-8")
            data: dict[str, object] = json.loads(raw)
            fetched_at = str(data.get("fetched_at", ""))
            today = datetime.now(timezone.utc).date().isoformat()
            return fetched_at == today
        except Exception:  # noqa: BLE001
            return False
