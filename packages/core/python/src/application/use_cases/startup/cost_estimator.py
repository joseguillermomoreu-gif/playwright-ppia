from __future__ import annotations

from dataclasses import dataclass

from src.application.use_cases.startup.token_budgets import (
    AVG_TOKENS_GENERATION,
    AVG_TOKENS_PER_ACTION,
)
from src.domain.model.model_price import ModelPrice


@dataclass
class CostEstimate:
    exploration: float
    generation: float
    total: float


def estimate_cost(
    estimated_actions: int,
    model_fast_price: ModelPrice | None,
    model_strong_price: ModelPrice | None,
) -> CostEstimate:
    """Estimate cost in USD for an exploration + generation session.

    Args:
        estimated_actions: Number of exploration rounds expected.
        model_fast_price: Pricing for the fast model (exploration phase).
            If None, exploration cost is 0.0.
        model_strong_price: Pricing for the strong model (generation phase).
            If None, generation cost is 0.0.

    Returns:
        CostEstimate with exploration, generation and total costs in USD.
    """
    if model_fast_price is not None:
        exploration = (
            estimated_actions
            * AVG_TOKENS_PER_ACTION
            * model_fast_price.input_usd_per_token
        )
    else:
        exploration = 0.0

    if model_strong_price is not None:
        generation = AVG_TOKENS_GENERATION * model_strong_price.input_usd_per_token
    else:
        generation = 0.0

    total = exploration + generation

    return CostEstimate(exploration=exploration, generation=generation, total=total)
