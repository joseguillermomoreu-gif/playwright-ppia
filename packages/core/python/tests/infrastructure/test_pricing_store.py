from __future__ import annotations

import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

import pytest

from src.domain.model.model_price import ModelPrice
from src.infrastructure.pricing.pricing_store import PricingStore


def _make_prices() -> list[ModelPrice]:
    today = datetime.now(timezone.utc).date().isoformat()
    return [
        ModelPrice(
            model_id="gpt-4o-mini",
            input_usd_per_token=0.00000015,
            output_usd_per_token=0.0000006,
            context_length=128000,
            fetched_at=today,
        ),
        ModelPrice(
            model_id="claude-3-haiku",
            input_usd_per_token=0.00000025,
            output_usd_per_token=0.00000125,
            context_length=200000,
            fetched_at=today,
        ),
    ]


class TestPricingStore:
    def test_write_and_read_roundtrip(self, tmp_path: Path) -> None:
        store = PricingStore(str(tmp_path))
        prices = _make_prices()

        store.write(prices)
        result = store.read()

        assert len(result) == 2
        gpt = result["gpt-4o-mini"]
        assert gpt.model_id == "gpt-4o-mini"
        assert gpt.input_usd_per_token == pytest.approx(0.00000015)
        assert gpt.output_usd_per_token == pytest.approx(0.0000006)
        assert gpt.context_length == 128000

        claude = result["claude-3-haiku"]
        assert claude.model_id == "claude-3-haiku"

    def test_atomic_write_does_not_corrupt_on_partial(self, tmp_path: Path) -> None:
        """After a successful write the .tmp file must not exist."""
        store = PricingStore(str(tmp_path))
        prices = _make_prices()

        store.write(prices)

        tmp_file = tmp_path / ".ppia" / "llm-pricing.tmp"
        assert not tmp_file.exists()

    def test_is_fresh_returns_true_for_today(self, tmp_path: Path) -> None:
        store = PricingStore(str(tmp_path))
        prices = _make_prices()

        store.write(prices)

        assert store.is_fresh() is True

    def test_is_fresh_returns_false_for_yesterday(self, tmp_path: Path) -> None:
        store = PricingStore(str(tmp_path))
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).date().isoformat()

        cache_dir = tmp_path / ".ppia"
        cache_dir.mkdir(parents=True, exist_ok=True)
        cache_file = cache_dir / "llm-pricing.json"
        cache_file.write_text(
            json.dumps(
                {
                    "schema_version": 1,
                    "fetched_at": yesterday,
                    "models": {},
                }
            ),
            encoding="utf-8",
        )

        assert store.is_fresh() is False

    def test_read_returns_empty_if_file_missing(self, tmp_path: Path) -> None:
        store = PricingStore(str(tmp_path))

        result = store.read()

        assert result == {}

    def test_read_returns_empty_if_file_corrupted(self, tmp_path: Path) -> None:
        cache_dir = tmp_path / ".ppia"
        cache_dir.mkdir(parents=True, exist_ok=True)
        (cache_dir / "llm-pricing.json").write_text("not valid json", encoding="utf-8")

        store = PricingStore(str(tmp_path))
        result = store.read()

        assert result == {}
