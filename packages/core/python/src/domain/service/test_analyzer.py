from __future__ import annotations

import re
from dataclasses import dataclass, field

from src.domain.model.selector import Selector
from src.domain.model.test_file import TestFile
from src.domain.model.test_step import TestStep


@dataclass
class TestAnalyzer:
    _selector_pattern: re.Pattern[str] = field(
        default_factory=lambda: re.compile(
            r"""(?:getByTestId|getByRole|getByText|getByLabel|locator|querySelector)\s*\(\s*['"]([^'"]+)['"]\s*\)"""
        ),
        init=False,
    )

    def analyze_tests(self, test_files: list[TestFile]) -> list[TestFile]:
        analyzed: list[TestFile] = []
        for test_file in test_files:
            if test_file.content:
                steps = self.extract_steps_from_content(test_file.content)
                analyzed.append(
                    TestFile(
                        path=test_file.path,
                        content=test_file.content,
                        test_name=test_file.test_name,
                        objective=test_file.objective,
                        steps=steps,
                        strategy=test_file.strategy,
                    )
                )
            else:
                analyzed.append(test_file)
        return analyzed

    def extract_steps_from_content(self, content: str) -> list[TestStep]:
        steps: list[TestStep] = []
        selectors = self._extract_selectors(content)

        lines = content.strip().split("\n")
        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("//") or stripped.startswith("#"):
                continue

            step_type = self._detect_step_type(stripped)
            step = TestStep(
                step_type=step_type,
                description=stripped,
                selectors=selectors,
            )
            steps.append(step)

        return steps

    def _extract_selectors(self, content: str) -> list[Selector]:
        selectors: list[Selector] = []
        for match in self._selector_pattern.finditer(content):
            selector_value = match.group(1)
            selectors.append(Selector(value=selector_value))
        return selectors

    @staticmethod
    def _detect_step_type(line: str) -> str:
        lower = line.lower()
        if lower.startswith(("given", "dado", "setup", "arrange")):
            return "given"
        if lower.startswith(("when", "cuando", "act")):
            return "when"
        if lower.startswith(("then", "entonces", "assert", "expect")):
            return "then"
        return "and"
