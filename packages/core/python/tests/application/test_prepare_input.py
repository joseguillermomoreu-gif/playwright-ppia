from __future__ import annotations

import json
from unittest.mock import AsyncMock

import pytest

from src.application.dto.prepare_input import PrepareInputRequest
from src.application.use_cases.prepare_input.prepare_input_use_case import PrepareInputUseCase


def _mock_llm_service(response_json: dict[str, object]) -> AsyncMock:
    service = AsyncMock()
    service.generate.return_value = (json.dumps(response_json), 0.001)
    service.count_tokens.return_value = 42
    return service


class TestPrepareInputUseCase:
    @pytest.mark.asyncio
    async def test_parses_login_input(self) -> None:
        llm_response = {
            "url": "https://example.com/login",
            "objective": "Validate login as admin user",
            "test_name": "validate_login_as_admin",
            "parameters": {"username": "admin", "role": "admin"},
        }
        service = _mock_llm_service(llm_response)
        use_case = PrepareInputUseCase(service)

        request = PrepareInputRequest(raw_input="Validar login como admin en https://example.com/login")
        result = await use_case.execute(request)

        assert result.url == "https://example.com/login"
        assert result.objective == "Validate login as admin user"
        assert result.test_name == "validate_login_as_admin"
        assert result.parameters == {"username": "admin", "role": "admin"}
        assert result.tokens_used == 42

    @pytest.mark.asyncio
    async def test_handles_markdown_wrapped_json(self) -> None:
        raw_json = {
            "url": "https://example.com",
            "objective": "Test homepage",
            "test_name": "test_homepage",
            "parameters": {},
        }
        service = AsyncMock()
        service.generate.return_value = (f"```json\n{json.dumps(raw_json)}\n```", 0.001)
        service.count_tokens.return_value = 10
        use_case = PrepareInputUseCase(service)

        request = PrepareInputRequest(raw_input="Test homepage at https://example.com")
        result = await use_case.execute(request)

        assert result.url == "https://example.com"
        assert result.test_name == "test_homepage"

    @pytest.mark.asyncio
    async def test_handles_invalid_json(self) -> None:
        service = AsyncMock()
        service.generate.return_value = ("not valid json", 0.001)
        service.count_tokens.return_value = 5
        use_case = PrepareInputUseCase(service)

        request = PrepareInputRequest(raw_input="some input")
        result = await use_case.execute(request)

        assert result.url == ""
        assert result.objective == ""
        assert result.test_name == ""
        assert result.parameters == {}

    @pytest.mark.asyncio
    async def test_calls_llm_with_system_prompt(self) -> None:
        service = _mock_llm_service({"url": "", "objective": "", "test_name": "", "parameters": {}})
        use_case = PrepareInputUseCase(service)

        request = PrepareInputRequest(raw_input="any input")
        await use_case.execute(request)

        service.generate.assert_called_once()
        call_kwargs = service.generate.call_args
        assert "system_prompt" in call_kwargs.kwargs or len(call_kwargs.args) > 1
