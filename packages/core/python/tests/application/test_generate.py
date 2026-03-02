from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from src.application.dto.generate import GenerateTestRequest
from src.application.use_cases.generate.generate_artifacts_use_case import GenerateArtifactsUseCase
from src.application.use_cases.generate.generate_test_use_case import GenerateTestUseCase
from src.domain.model.session import Session


def _mock_llm(response: str) -> AsyncMock:
    service = AsyncMock()
    service.generate_with_history.return_value = (response, 0.01)
    service.count_tokens.return_value = 200
    return service


class TestGenerateTestUseCase:
    @pytest.mark.asyncio
    async def test_generates_test_code(self) -> None:
        code = 'import { test, expect } from "@playwright/test";\ntest("login", async ({ page }) => {});'
        service = _mock_llm(code)
        session = Session()
        use_case = GenerateTestUseCase(service)

        request = GenerateTestRequest(exploration_report={"url": "https://example.com", "actions": ["click login"]})
        result = await use_case.execute(session, request)

        assert "playwright/test" in result.code
        assert result.tokens_used == 200

    @pytest.mark.asyncio
    async def test_cleans_markdown_code_blocks(self) -> None:
        raw = '```typescript\nimport { test } from "@playwright/test";\n```'
        service = _mock_llm(raw)
        session = Session()
        use_case = GenerateTestUseCase(service)

        request = GenerateTestRequest(exploration_report={"url": "https://example.com"})
        result = await use_case.execute(session, request)

        assert not result.code.startswith("```")
        assert "import { test }" in result.code

    @pytest.mark.asyncio
    async def test_with_failure_report(self) -> None:
        service = _mock_llm("fixed test code")
        session = Session()
        use_case = GenerateTestUseCase(service)

        request = GenerateTestRequest(
            exploration_report={"url": "https://example.com"},
            failure_report={"error": "timeout on login button", "line": 15},
        )
        result = await use_case.execute(session, request)

        # Verify the prompt includes failure context
        call_messages = service.generate_with_history.call_args.kwargs["messages"]
        prompt_text = call_messages[0]["content"]
        assert "FAILED" in prompt_text
        assert "timeout on login button" in prompt_text
        assert result.code == "fixed test code"

    @pytest.mark.asyncio
    async def test_accumulates_in_session(self) -> None:
        service = _mock_llm("test code")
        session = Session()
        use_case = GenerateTestUseCase(service)

        request = GenerateTestRequest(exploration_report={"url": "https://example.com"})
        await use_case.execute(session, request)

        assert len(session.history) == 2  # user prompt + assistant response


class TestGenerateArtifactsUseCase:
    @pytest.mark.asyncio
    async def test_generates_artifacts(self) -> None:
        artifacts = {
            "pom_md": "# LoginPage\n- selector: [data-testid=login]",
            "gherkin_md": "Feature: Login\n  Scenario: Valid login",
            "cucumber_md": "Given('user is on login page', ...)",
        }
        service = _mock_llm(json.dumps(artifacts))
        session = Session()
        session.add_message("user", "generate test")
        session.add_message("assistant", "test code here")
        use_case = GenerateArtifactsUseCase(service)

        result = await use_case.execute(session)

        assert "LoginPage" in result.pom_md
        assert "Feature: Login" in result.gherkin_md
        assert "Given" in result.cucumber_md

    @pytest.mark.asyncio
    async def test_continues_session_history(self) -> None:
        service = _mock_llm(json.dumps({"pom_md": "", "gherkin_md": "", "cucumber_md": ""}))
        session = Session()
        session.add_message("user", "prev prompt")
        session.add_message("assistant", "prev response")
        use_case = GenerateArtifactsUseCase(service)

        await use_case.execute(session)

        # 2 previous + 2 new (user + assistant)
        assert len(session.history) == 4
        call_messages = service.generate_with_history.call_args.kwargs["messages"]
        assert len(call_messages) == 4
