from __future__ import annotations

from dataclasses import dataclass, field

from src.domain.model.selector import Selector
from src.domain.model.test_step import TestStep


@dataclass
class TestFile:
    path: str
    content: str = ""
    test_name: str = ""
    objective: str = ""
    steps: list[TestStep] = field(default_factory=list)
    strategy: str = ""

    def extract_selectors(self) -> list[Selector]:
        selectors: list[Selector] = []
        for step in self.steps:
            selectors.extend(step.selectors)
        return selectors

    def get_page_objects(self) -> list[str]:
        page_objects: list[str] = []
        for step in self.steps:
            for action in step.actions:
                if "page." in action.lower() or "Page" in action:
                    page_objects.append(action)
        return page_objects
