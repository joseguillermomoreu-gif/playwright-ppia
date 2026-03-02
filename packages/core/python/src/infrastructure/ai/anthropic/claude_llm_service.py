from __future__ import annotations

import asyncio
import logging

from anthropic import APIError, AsyncAnthropic
from anthropic.types import MessageParam, TextBlock

from src.domain.repository.llm_service import LlmService
from src.infrastructure.config.settings import Settings

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (input, output)
_PRICING: dict[str, tuple[float, float]] = {
    "claude-sonnet-4-20250514": (3.00, 15.00),
    "claude-haiku-4-20250414": (0.80, 4.00),
    "claude-3-5-sonnet-20241022": (3.00, 15.00),
    "claude-3-5-haiku-20241022": (0.80, 4.00),
}


class ClaudeLlmService(LlmService):
    def __init__(self, settings: Settings) -> None:
        self._client = AsyncAnthropic(api_key=settings.anthropic_api_key)
        self._model = settings.default_model
        self._max_retries = 3
        self._max_tokens = 4096

    async def generate(self, prompt: str, system_prompt: str = "") -> tuple[str, float]:
        messages: list[dict[str, str]] = [{"role": "user", "content": prompt}]
        return await self.generate_with_history(messages, system_prompt=system_prompt)

    async def generate_with_history(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
    ) -> tuple[str, float]:
        api_messages: list[MessageParam] = [
            {"role": m["role"], "content": m["content"]}  # type: ignore[typeddict-item]
            for m in messages
        ]

        for attempt in range(self._max_retries):
            try:
                response = await self._client.messages.create(
                    model=self._model,
                    max_tokens=self._max_tokens,
                    messages=api_messages,
                    system=system_prompt if system_prompt else "",
                )
                text_blocks = [b for b in response.content if isinstance(b, TextBlock)]
                content = text_blocks[0].text if text_blocks else ""
                cost = self._calculate_cost(
                    response.usage.input_tokens,
                    response.usage.output_tokens,
                )
                return content, cost

            except APIError as e:
                logger.warning("Anthropic API error (attempt %d/%d): %s", attempt + 1, self._max_retries, e)
                if attempt < self._max_retries - 1:
                    await asyncio.sleep(2**attempt)
                else:
                    raise

        return "", 0.0  # unreachable, satisfies mypy

    async def count_tokens(self, text: str) -> int:
        # Approximate: ~4 chars per token
        return len(text) // 4

    async def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        return self._calculate_cost(input_tokens, output_tokens)

    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        input_price, output_price = _PRICING.get(self._model, (3.00, 15.00))
        return (input_tokens * input_price + output_tokens * output_price) / 1_000_000
