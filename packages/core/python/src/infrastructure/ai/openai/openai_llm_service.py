from __future__ import annotations

import asyncio
import logging

from openai import APIError, AsyncOpenAI

from src.domain.repository.llm_service import LlmService
from src.infrastructure.config.settings import Settings

logger = logging.getLogger(__name__)

# Pricing per 1M tokens (input, output)
_PRICING: dict[str, tuple[float, float]] = {
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gpt-4-turbo": (10.00, 30.00),
    "gpt-3.5-turbo": (0.50, 1.50),
}


class OpenAiLlmService(LlmService):
    def __init__(self, settings: Settings) -> None:
        self._client = AsyncOpenAI(api_key=settings.openai_api_key)
        self._model = settings.default_model
        self._max_retries = 3

    async def generate(self, prompt: str, system_prompt: str = "") -> tuple[str, float]:
        messages: list[dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        return await self.generate_with_history(messages)

    async def generate_with_history(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
    ) -> tuple[str, float]:
        if system_prompt:
            messages = [{"role": "system", "content": system_prompt}, *messages]

        for attempt in range(self._max_retries):
            try:
                response = await self._client.chat.completions.create(
                    model=self._model,
                    messages=messages,  # type: ignore[arg-type]
                )
                content = response.choices[0].message.content or ""
                cost = self._calculate_cost(
                    response.usage.prompt_tokens if response.usage else 0,
                    response.usage.completion_tokens if response.usage else 0,
                )
                return content, cost

            except APIError as e:
                logger.warning("OpenAI API error (attempt %d/%d): %s", attempt + 1, self._max_retries, e)
                if attempt < self._max_retries - 1:
                    await asyncio.sleep(2**attempt)
                else:
                    raise

        return "", 0.0  # unreachable, satisfies mypy

    async def count_tokens(self, text: str) -> int:
        # Approximate: ~4 chars per token for English
        return len(text) // 4

    async def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        return self._calculate_cost(input_tokens, output_tokens)

    def _calculate_cost(self, input_tokens: int, output_tokens: int) -> float:
        input_price, output_price = _PRICING.get(self._model, (2.50, 10.00))
        return (input_tokens * input_price + output_tokens * output_price) / 1_000_000
