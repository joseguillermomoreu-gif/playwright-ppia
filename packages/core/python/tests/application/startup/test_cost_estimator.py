from __future__ import annotations

import pytest

from src.application.use_cases.startup.cost_estimator import CostEstimate, estimate_cost
from src.application.use_cases.startup.token_budgets import (
    AVG_TOKENS_GENERATION,
    AVG_TOKENS_PER_ACTION,
)
from src.domain.model.model_price import ModelPrice


def _make_price(model_id: str, input_usd_per_token: float) -> ModelPrice:
    return ModelPrice(
        model_id=model_id,
        input_usd_per_token=input_usd_per_token,
        output_usd_per_token=input_usd_per_token * 3,
        context_length=128_000,
        fetched_at="2026-03-18",
    )


class TestEstimateCost:
    def test_estimate_cost_with_both_prices(self) -> None:
        fast = _make_price("gpt-4o-mini", 0.00000015)
        strong = _make_price("gpt-4o", 0.0000025)
        actions = 10

        result = estimate_cost(
            estimated_actions=actions,
            model_fast_price=fast,
            model_strong_price=strong,
        )

        expected_exploration = actions * AVG_TOKENS_PER_ACTION * fast.input_usd_per_token
        expected_generation = AVG_TOKENS_GENERATION * strong.input_usd_per_token

        assert isinstance(result, CostEstimate)
        assert abs(result.exploration - expected_exploration) < 1e-8
        assert abs(result.generation - expected_generation) < 1e-8
        assert abs(result.total - (result.exploration + result.generation)) < 1e-8

    def test_estimate_cost_no_fast_price(self) -> None:
        strong = _make_price("gpt-4o", 0.0000025)

        result = estimate_cost(
            estimated_actions=5,
            model_fast_price=None,
            model_strong_price=strong,
        )

        assert result.exploration == 0.0
        assert result.generation > 0.0
        assert abs(result.total - result.generation) < 1e-8

    def test_estimate_cost_no_strong_price(self) -> None:
        fast = _make_price("gpt-4o-mini", 0.00000015)

        result = estimate_cost(
            estimated_actions=5,
            model_fast_price=fast,
            model_strong_price=None,
        )

        assert result.generation == 0.0
        assert result.exploration > 0.0
        assert abs(result.total - result.exploration) < 1e-8

    def test_estimate_cost_zero_actions(self) -> None:
        fast = _make_price("gpt-4o-mini", 0.00000015)
        strong = _make_price("gpt-4o", 0.0000025)

        result = estimate_cost(
            estimated_actions=0,
            model_fast_price=fast,
            model_strong_price=strong,
        )

        assert result.exploration == 0.0
        assert result.generation > 0.0
        assert abs(result.total - result.generation) < 1e-8

    @pytest.mark.parametrize(
        ("actions", "fast_input", "strong_input"),
        [
            (1, 0.000001, 0.000005),
            (20, 0.0000002, 0.000003),
            (100, 0.00000015, 0.0000025),
            (0, 0.000001, 0.000005),
        ],
    )
    def test_total_equals_sum(
        self, actions: int, fast_input: float, strong_input: float
    ) -> None:
        fast = _make_price("fast-model", fast_input)
        strong = _make_price("strong-model", strong_input)

        result = estimate_cost(
            estimated_actions=actions,
            model_fast_price=fast,
            model_strong_price=strong,
        )

        assert abs(result.total - (result.exploration + result.generation)) < 1e-8
