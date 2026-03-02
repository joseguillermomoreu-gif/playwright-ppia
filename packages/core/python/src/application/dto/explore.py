from __future__ import annotations

from pydantic import BaseModel, Field


class CreateSessionResponse(BaseModel):
    session_id: str


class CloseSessionResponse(BaseModel):
    closed: bool


class ExploreRequest(BaseModel):
    html: str = Field(description="Current page HTML")
    context: dict[str, str] = Field(default_factory=dict, description="Additional context")
    model: str = Field(default="", description="LLM model override (empty = use default)")


class ExploreResponse(BaseModel):
    action: str
    target: str
    value: str | None = None
    completed: bool
    analysis_summary: str
    tokens_used: int
