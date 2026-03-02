from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from anthropic.types import TextBlock

from src.domain.repository.llm_service import LlmService
from src.infrastructure.ai.anthropic.claude_llm_service import ClaudeLlmService
from src.infrastructure.ai.openai.openai_llm_service import OpenAiLlmService
from src.infrastructure.config.dependency_injection import Container
from src.infrastructure.config.settings import Settings


def _make_settings(model: str = "gpt-4o") -> Settings:
    return Settings(
        openai_api_key="test-openai-key",
        anthropic_api_key="test-anthropic-key",
        default_model=model,
    )


class TestOpenAiLlmService:
    def test_implements_port(self) -> None:
        service = OpenAiLlmService(_make_settings())
        assert isinstance(service, LlmService)

    @pytest.mark.asyncio
    async def test_generate(self) -> None:
        service = OpenAiLlmService(_make_settings())
        mock_response = MagicMock()
        mock_response.choices = [MagicMock()]
        mock_response.choices[0].message.content = "Generated test"
        mock_response.usage.prompt_tokens = 100
        mock_response.usage.completion_tokens = 50

        with patch.object(service._client.chat.completions, "create", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_response
            result, cost = await service.generate("Write a test")
            assert result == "Generated test"
            assert cost > 0


class TestClaudeLlmService:
    def test_implements_port(self) -> None:
        service = ClaudeLlmService(_make_settings(model="claude-sonnet-4-20250514"))
        assert isinstance(service, LlmService)

    @pytest.mark.asyncio
    async def test_generate(self) -> None:
        service = ClaudeLlmService(_make_settings(model="claude-sonnet-4-20250514"))
        mock_response = MagicMock()
        text_block = TextBlock(type="text", text="Generated test")
        mock_response.content = [text_block]
        mock_response.usage.input_tokens = 100
        mock_response.usage.output_tokens = 50

        with patch.object(service._client.messages, "create", new_callable=AsyncMock) as mock_create:
            mock_create.return_value = mock_response
            result, cost = await service.generate("Write a test")
            assert result == "Generated test"
            assert cost > 0


class TestContainerAutoSelection:
    def test_selects_openai_for_gpt(self) -> None:
        container = Container(settings=_make_settings("gpt-4o"))
        service = container.get_llm_service()
        assert isinstance(service, OpenAiLlmService)

    def test_selects_claude_for_claude(self) -> None:
        container = Container(settings=_make_settings("claude-sonnet-4-20250514"))
        service = container.get_llm_service()
        assert isinstance(service, ClaudeLlmService)

    def test_caches_service(self) -> None:
        container = Container(settings=_make_settings())
        service1 = container.get_llm_service()
        service2 = container.get_llm_service()
        assert service1 is service2
