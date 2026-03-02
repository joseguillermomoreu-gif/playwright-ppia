from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class Selector:
    value: str
    element_type: str = ""
    action: str = ""
    context: str = ""

    def is_data_testid(self) -> bool:
        return self.value.startswith("[data-testid=") or self.value.startswith("data-testid=")

    def is_css_selector(self) -> bool:
        css_indicators = (".", "#", "[", ">", "~", "+", ":")
        return any(self.value.startswith(indicator) for indicator in css_indicators)

    def is_xpath(self) -> bool:
        return self.value.startswith("/") or self.value.startswith("(//")
