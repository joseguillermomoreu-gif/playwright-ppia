from __future__ import annotations

from pydantic import BaseModel, Field


class GenerateTestRequest(BaseModel):
    exploration_report: dict[str, object] = Field(description="Report from Session A exploration")
    failure_report: dict[str, object] | None = Field(default=None, description="Previous failure report if retrying")
    model: str = Field(default="", description="LLM model override (empty = use default)")


class GenerateTestResponse(BaseModel):
    code: str
    tokens_used: int


class GenerateArtifactsRequest(BaseModel):
    model: str = Field(default="", description="LLM model override (empty = use default)")


class GenerateArtifactsResponse(BaseModel):
    pom_md: str
    gherkin_md: str
    cucumber_md: str
    tokens_used: int
