from __future__ import annotations

from dataclasses import dataclass, field

from src.domain.model.selector import Selector


@dataclass(frozen=True)
class TestStep:
    step_type: str  # given | when | then | and
    description: str
    actions: list[str] = field(default_factory=list)
    selectors: list[Selector] = field(default_factory=list)

    def to_gherkin(self) -> str:
        keyword = self.step_type.capitalize()
        return f"{keyword} {self.description}"
