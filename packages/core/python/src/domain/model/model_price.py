from __future__ import annotations

from pydantic import BaseModel


class ModelPrice(BaseModel):
    model_id: str
    input_usd_per_token: float
    output_usd_per_token: float
    context_length: int
    fetched_at: str  # ISO date UTC
