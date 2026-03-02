from __future__ import annotations

from src.application.dto.prepare_input import PrepareInputRequest, PrepareInputResponse
from src.application.shared.llm_response_parser import parse_llm_json
from src.domain.repository.llm_service import LlmService
from src.infrastructure.prompts.prepare_input_prompt import (
    PREPARE_INPUT_SYSTEM_PROMPT,
    build_prepare_input_prompt,
)


class PrepareInputUseCase:
    def __init__(self, llm_service: LlmService) -> None:
        self._llm_service = llm_service

    async def execute(self, request: PrepareInputRequest) -> PrepareInputResponse:
        prompt = build_prepare_input_prompt(request.raw_input)
        raw_response, _cost = await self._llm_service.generate(
            prompt=prompt,
            system_prompt=PREPARE_INPUT_SYSTEM_PROMPT,
        )

        tokens_used = await self._llm_service.count_tokens(request.raw_input)
        parsed = parse_llm_json(raw_response, context="prepare-input")

        return PrepareInputResponse(
            url=str(parsed.get("url", "")),
            objective=str(parsed.get("objective", "")),
            test_name=str(parsed.get("test_name", "")),
            parameters=self._extract_parameters(parsed.get("parameters", {})),
            tokens_used=tokens_used,
        )

    @staticmethod
    def _extract_parameters(raw: object) -> dict[str, str]:
        if isinstance(raw, dict):
            return {str(k): str(v) for k, v in raw.items()}
        return {}
