from __future__ import annotations

import logging

from src.application.dto.generate import GenerateTestRequest, GenerateTestResponse
from src.domain.model.session import Session
from src.domain.repository.llm_service import LlmService
from src.infrastructure.prompts.generation_prompt import (
    GENERATION_SYSTEM_PROMPT,
    build_generation_prompt,
)

logger = logging.getLogger(__name__)


class GenerateTestUseCase:
    def __init__(self, llm_service: LlmService) -> None:
        self._llm_service = llm_service

    async def execute(self, session: Session, request: GenerateTestRequest) -> GenerateTestResponse:
        prompt = build_generation_prompt(request.exploration_report, request.failure_report)
        session.add_message("user", prompt)

        raw_response, _cost = await self._llm_service.generate_with_history(
            messages=session.history,
            system_prompt=GENERATION_SYSTEM_PROMPT,
        )

        session.add_message("assistant", raw_response)
        tokens_used = await self._llm_service.count_tokens(prompt)

        code = self._clean_code(raw_response)
        return GenerateTestResponse(code=code, tokens_used=tokens_used)

    @staticmethod
    def _clean_code(raw: str) -> str:
        cleaned = raw.strip()
        if cleaned.startswith("```"):
            lines = cleaned.split("\n")
            cleaned = "\n".join(lines[1:-1])
        return cleaned
