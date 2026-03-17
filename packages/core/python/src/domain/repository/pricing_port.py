from __future__ import annotations

from abc import ABC, abstractmethod

from src.domain.model.model_price import ModelPrice


class PricingPort(ABC):
    @abstractmethod
    async def fetch_prices(self, model_ids: list[str]) -> list[ModelPrice]:
        """Fetch pricing data for the given model IDs."""
