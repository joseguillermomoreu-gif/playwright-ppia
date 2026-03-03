from __future__ import annotations

from dataclasses import dataclass, field

from src.domain.model.selector import Selector


@dataclass(frozen=True)
class Component:
    name: str
    selectors: list[Selector] = field(default_factory=list)
    actions: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class PageObject:
    name: str
    url: str = ""
    components: list[Component] = field(default_factory=list)
    selectors: list[Selector] = field(default_factory=list)


@dataclass(frozen=True)
class POMStructure:
    page_objects: list[PageObject] = field(default_factory=list)

    def get_all_selectors(self) -> list[Selector]:
        selectors: list[Selector] = []
        for page in self.page_objects:
            selectors.extend(page.selectors)
            for component in page.components:
                selectors.extend(component.selectors)
        return selectors
