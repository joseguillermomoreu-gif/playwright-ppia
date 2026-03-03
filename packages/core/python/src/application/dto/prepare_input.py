from __future__ import annotations

from pydantic import BaseModel, Field


class PrepareInputRequest(BaseModel):
    raw_input: str = Field(description="Natural language test description")
    model: str = Field(default="", description="LLM model override (empty = use default)")


class PrepareInputResponse(BaseModel):
    url: str
    objective: str
    test_name: str
    parameters: dict[str, str]
    tokens_used: int
