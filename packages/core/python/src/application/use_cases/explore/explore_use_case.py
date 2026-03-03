from __future__ import annotations

from src.application.dto.explore import ExploreResponse
from src.application.shared.llm_response_parser import parse_llm_json
from src.domain.model.session import Session
from src.domain.repository.llm_service import LlmService
from src.infrastructure.prompts.exploration_prompt import (
    EXPLORATION_SYSTEM_PROMPT,
    build_exploration_prompt,
)


class ExploreUseCase:
    def __init__(self, llm_service: LlmService) -> None:
        self._llm_service = llm_service

    async def execute(
        self,
        session: Session,
        html: str,
        context: dict[str, str],
    ) -> ExploreResponse:
        user_prompt = build_exploration_prompt(html, context)
        session.add_message("user", user_prompt)

        raw_response, _cost = await self._llm_service.generate_with_history(
            messages=session.history,
            system_prompt=EXPLORATION_SYSTEM_PROMPT,
        )

        session.add_message("assistant", raw_response)
        tokens_used = await self._llm_service.count_tokens(user_prompt)
        parsed = parse_llm_json(raw_response, context="explore")

        completed = bool(parsed.get("completed", False))
        if completed:
            session.mark_completed()

        return ExploreResponse(
            action=str(parsed.get("action", "")),
            target=str(parsed.get("target", "")),
            value=self._extract_value(parsed.get("value")),
            completed=completed,
            analysis_summary=str(parsed.get("analysis_summary", "")),
            tokens_used=tokens_used,
        )

    @staticmethod
    def _extract_value(raw: object) -> str | None:
        if raw is None:
            return None
        return str(raw)
