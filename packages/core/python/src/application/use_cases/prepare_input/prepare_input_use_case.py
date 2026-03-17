from __future__ import annotations

from src.application.dto.prepare_input import PrepareInputRequest, PrepareInputResponse
from src.application.shared.llm_response_parser import parse_llm_json
from src.application.use_cases.startup.cost_estimator import estimate_cost
from src.domain.repository.llm_service import LlmService
from src.infrastructure.pricing.pricing_store import PricingStore
from src.infrastructure.prompts.prepare_input_prompt import (
    PREPARE_INPUT_SYSTEM_PROMPT,
    build_prepare_input_prompt,
)


class PrepareInputUseCase:
    def __init__(
        self,
        llm_service: LlmService,
        pricing_store: PricingStore | None = None,
        model_fast_id: str = "",
        model_strong_id: str = "",
    ) -> None:
        self._llm_service = llm_service
        self._pricing_store = pricing_store
        self._model_fast_id = model_fast_id
        self._model_strong_id = model_strong_id

    async def execute(self, request: PrepareInputRequest) -> PrepareInputResponse:
        prompt = build_prepare_input_prompt(request.raw_input)
        raw_response, _cost = await self._llm_service.generate(
            prompt=prompt,
            system_prompt=PREPARE_INPUT_SYSTEM_PROMPT,
        )

        tokens_used = await self._llm_service.count_tokens(request.raw_input)
        parsed = parse_llm_json(raw_response, context="prepare-input")

        estimated_cost = self._compute_estimated_cost(request)

        return PrepareInputResponse(
            url=str(parsed.get("url", "")),
            objective=str(parsed.get("objective", "")),
            test_name=str(parsed.get("test_name", "")),
            parameters=self._extract_parameters(parsed.get("parameters", {})),
            tokens_used=tokens_used,
            estimated_cost=estimated_cost,
        )

    def _compute_estimated_cost(self, request: PrepareInputRequest) -> float:
        if self._pricing_store is None:
            return 0.0

        prices = self._pricing_store.read()
        if not prices:
            return 0.0

        # Use request.model override when provided, fall back to configured IDs
        fast_key = request.model if request.model else self._model_fast_id
        strong_key = self._model_strong_id

        model_fast_price = prices.get(fast_key) if fast_key else None
        model_strong_price = prices.get(strong_key) if strong_key else None

        # Default estimated_actions to 1 for the prepare_input phase
        estimate = estimate_cost(
            estimated_actions=1,
            model_fast_price=model_fast_price,
            model_strong_price=model_strong_price,
        )
        return estimate.total

    @staticmethod
    def _extract_parameters(raw: object) -> dict[str, str]:
        if isinstance(raw, dict):
            return {str(k): str(v) for k, v in raw.items()}
        return {}
