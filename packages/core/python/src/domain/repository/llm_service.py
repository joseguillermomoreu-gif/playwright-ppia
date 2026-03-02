from __future__ import annotations

from abc import ABC, abstractmethod


class LlmService(ABC):
    @abstractmethod
    async def generate(self, prompt: str, system_prompt: str = "") -> tuple[str, float]:
        """Generate a response. Returns (response_text, cost)."""

    @abstractmethod
    async def generate_with_history(
        self,
        messages: list[dict[str, str]],
        system_prompt: str = "",
    ) -> tuple[str, float]:
        """Generate with conversation history. Returns (response_text, cost)."""

    @abstractmethod
    async def count_tokens(self, text: str) -> int:
        """Count tokens in a text string."""

    @abstractmethod
    async def estimate_cost(self, input_tokens: int, output_tokens: int) -> float:
        """Estimate cost for a given token count."""
