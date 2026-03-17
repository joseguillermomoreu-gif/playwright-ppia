from __future__ import annotations

from pydantic import BaseModel


class StartupInfoResponse(BaseModel):
    version: str
    model_fast: str
    model_strong: str
