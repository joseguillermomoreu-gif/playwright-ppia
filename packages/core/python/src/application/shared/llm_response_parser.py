from __future__ import annotations

import json
import logging

logger = logging.getLogger(__name__)


def parse_llm_json(raw: str, context: str = "LLM") -> dict[str, object]:
    """Parse a JSON response from an LLM, stripping markdown code blocks if present."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1])
    try:
        result: dict[str, object] = json.loads(cleaned)
        return result
    except json.JSONDecodeError:
        logger.error("Failed to parse %s response as JSON: %s", context, cleaned[:200])
        return {}


def clean_code_block(raw: str) -> str:
    """Strip markdown code block wrappers from LLM output."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.split("\n")
        cleaned = "\n".join(lines[1:-1])
    return cleaned
