from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest

from src.infrastructure.pricing.openrouter_pricing_adapter import OpenRouterPricingAdapter


def _make_openrouter_response(entries: list[dict[str, object]]) -> MagicMock:
    mock_response = MagicMock(spec=httpx.Response)
    mock_response.json.return_value = {"data": entries}
    mock_response.raise_for_status = MagicMock()
    return mock_response


_SAMPLE_ENTRIES: list[dict[str, object]] = [
    {
        "id": "openai/gpt-4o-mini",
        "context_length": 128000,
        "pricing": {"prompt": "0.00000015", "completion": "0.0000006"},
    },
    {
        "id": "anthropic/claude-3-haiku",
        "context_length": 200000,
        "pricing": {"prompt": "0.00000025", "completion": "0.00000125"},
    },
    {
        "id": "google/gemini-flash-1.5",
        "context_length": 1000000,
        "pricing": {"prompt": "0.000000075", "completion": "0.0000003"},
    },
]


class TestOpenRouterPricingAdapter:
    @pytest.mark.asyncio
    async def test_fetch_prices_returns_empty_on_network_error(self) -> None:
        adapter = OpenRouterPricingAdapter()

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(side_effect=httpx.ConnectError("connection refused"))
            mock_client_cls.return_value = mock_client

            result = await adapter.fetch_prices(["gpt-4o-mini"])

        assert result == []

    @pytest.mark.asyncio
    async def test_fetch_prices_filters_by_model_id(self) -> None:
        adapter = OpenRouterPricingAdapter()
        mock_response = _make_openrouter_response(_SAMPLE_ENTRIES)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await adapter.fetch_prices(["gpt-4o-mini"])

        assert len(result) == 1
        assert result[0].model_id == "gpt-4o-mini"

    @pytest.mark.asyncio
    async def test_fetch_prices_normalizes_model_id(self) -> None:
        adapter = OpenRouterPricingAdapter()
        mock_response = _make_openrouter_response(_SAMPLE_ENTRIES)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await adapter.fetch_prices(["gpt-4o-mini", "claude-3-haiku"])

        model_ids = {p.model_id for p in result}
        assert "gpt-4o-mini" in model_ids
        assert "claude-3-haiku" in model_ids
        # Original prefixed IDs must NOT appear
        assert "openai/gpt-4o-mini" not in model_ids
        assert "anthropic/claude-3-haiku" not in model_ids

    @pytest.mark.asyncio
    async def test_fetch_prices_maps_pricing_fields(self) -> None:
        adapter = OpenRouterPricingAdapter()
        mock_response = _make_openrouter_response(_SAMPLE_ENTRIES)

        with patch("httpx.AsyncClient") as mock_client_cls:
            mock_client = AsyncMock()
            mock_client.__aenter__ = AsyncMock(return_value=mock_client)
            mock_client.__aexit__ = AsyncMock(return_value=False)
            mock_client.get = AsyncMock(return_value=mock_response)
            mock_client_cls.return_value = mock_client

            result = await adapter.fetch_prices(["gpt-4o-mini"])

        price = result[0]
        assert price.input_usd_per_token == pytest.approx(0.00000015)
        assert price.output_usd_per_token == pytest.approx(0.0000006)
        assert price.context_length == 128000
        assert price.fetched_at != ""
