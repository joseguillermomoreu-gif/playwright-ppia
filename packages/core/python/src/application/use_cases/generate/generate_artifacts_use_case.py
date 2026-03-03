from __future__ import annotations

from src.application.dto.generate import GenerateArtifactsResponse
from src.application.shared.llm_response_parser import parse_llm_json
from src.domain.model.session import Session
from src.domain.repository.llm_service import LlmService
from src.infrastructure.prompts.artifacts_prompt import (
    ARTIFACTS_SYSTEM_PROMPT,
    build_artifacts_prompt,
)


class GenerateArtifactsUseCase:
    def __init__(self, llm_service: LlmService) -> None:
        self._llm_service = llm_service

    async def execute(self, session: Session) -> GenerateArtifactsResponse:
        prompt = build_artifacts_prompt()
        session.add_message("user", prompt)

        raw_response, _cost = await self._llm_service.generate_with_history(
            messages=session.history,
            system_prompt=ARTIFACTS_SYSTEM_PROMPT,
        )

        session.add_message("assistant", raw_response)
        tokens_used = await self._llm_service.count_tokens(prompt)
        parsed = parse_llm_json(raw_response, context="artifacts")

        return GenerateArtifactsResponse(
            pom_md=str(parsed.get("pom_md", "")),
            gherkin_md=str(parsed.get("gherkin_md", "")),
            cucumber_md=str(parsed.get("cucumber_md", "")),
            tokens_used=tokens_used,
        )
