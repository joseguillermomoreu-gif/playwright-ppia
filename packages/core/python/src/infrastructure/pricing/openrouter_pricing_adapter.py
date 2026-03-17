from __future__ import annotations

from datetime import datetime, timezone

import httpx

from src.domain.model.model_price import ModelPrice
from src.domain.repository.pricing_port import PricingPort

_OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
_TIMEOUT_SECONDS = 2.0


def _normalize_model_id(openrouter_id: str) -> str:
    """Strip provider prefix from OpenRouter model ID.

    e.g. 'openai/gpt-4o-mini' -> 'gpt-4o-mini'
    """
    if "/" in openrouter_id:
        return openrouter_id.split("/", 1)[1]
    return openrouter_id


class OpenRouterPricingAdapter(PricingPort):
    async def fetch_prices(self, model_ids: list[str]) -> list[ModelPrice]:
        """Fetch prices from OpenRouter for the requested model IDs.

        Returns an empty list on any network or parsing error (silent fallback).
        """
        try:
            async with httpx.AsyncClient(timeout=_TIMEOUT_SECONDS) as client:
                response = await client.get(_OPENROUTER_MODELS_URL)
                response.raise_for_status()
                payload: dict[str, object] = response.json()

            raw_models: list[dict[str, object]] = payload.get("data", [])  # type: ignore[assignment]
            fetched_at = datetime.now(timezone.utc).date().isoformat()

            result: list[ModelPrice] = []
            requested = set(model_ids)

            for entry in raw_models:
                openrouter_id = str(entry.get("id", ""))
                normalized = _normalize_model_id(openrouter_id)

                if normalized not in requested:
                    continue

                pricing: dict[str, object] = entry.get("pricing", {})  # type: ignore[assignment]

                input_usd = float(str(pricing.get("prompt") or "0"))
                output_usd = float(str(pricing.get("completion") or "0"))
                context_length = int(str(entry.get("context_length") or "0"))

                result.append(
                    ModelPrice(
                        model_id=normalized,
                        input_usd_per_token=input_usd,
                        output_usd_per_token=output_usd,
                        context_length=context_length,
                        fetched_at=fetched_at,
                    )
                )

            return result

        except Exception:  # noqa: BLE001
            return []
