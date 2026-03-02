from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class Session:
    id: str = field(default_factory=lambda: uuid.uuid4().hex[:12])
    objective: str = ""
    history: list[dict[str, str]] = field(default_factory=list)
    completed: bool = False
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def add_message(self, role: str, content: str) -> None:
        self.history.append({"role": role, "content": content})
        self.updated_at = datetime.now(timezone.utc)

    def mark_completed(self) -> None:
        self.completed = True
        self.updated_at = datetime.now(timezone.utc)
