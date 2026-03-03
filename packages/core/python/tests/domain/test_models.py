from __future__ import annotations

import pytest

from src.domain.model.pom_structure import Component, PageObject, POMStructure
from src.domain.model.selector import Selector
from src.domain.model.test_file import TestFile
from src.domain.model.test_step import TestStep


class TestSelector:
    def test_is_data_testid(self) -> None:
        selector = Selector(value='[data-testid="login-btn"]')
        assert selector.is_data_testid()

    def test_is_not_data_testid(self) -> None:
        selector = Selector(value=".login-button")
        assert not selector.is_data_testid()

    def test_is_css_selector(self) -> None:
        assert Selector(value=".my-class").is_css_selector()
        assert Selector(value="#my-id").is_css_selector()
        assert Selector(value="[href]").is_css_selector()

    def test_is_xpath(self) -> None:
        assert Selector(value="//div[@class='test']").is_xpath()
        assert Selector(value="(//button)[1]").is_xpath()

    def test_is_not_xpath(self) -> None:
        assert not Selector(value=".css-class").is_xpath()


class TestTestStep:
    def test_to_gherkin(self) -> None:
        step = TestStep(step_type="given", description="user is on login page")
        assert step.to_gherkin() == "Given user is on login page"

    def test_frozen(self) -> None:
        step = TestStep(step_type="when", description="clicks button")
        with pytest.raises(AttributeError):
            step.step_type = "then"  # type: ignore[misc]


class TestTestFile:
    def test_extract_selectors(self) -> None:
        selector = Selector(value='[data-testid="submit"]')
        step = TestStep(step_type="when", description="clicks submit", selectors=[selector])
        test_file = TestFile(path="test.spec.ts", steps=[step])
        assert test_file.extract_selectors() == [selector]

    def test_mutable(self) -> None:
        test_file = TestFile(path="test.spec.ts")
        test_file.content = "new content"
        assert test_file.content == "new content"


class TestPOMStructure:
    def test_get_all_selectors(self) -> None:
        s1 = Selector(value=".page-selector")
        s2 = Selector(value=".component-selector")
        component = Component(name="LoginForm", selectors=[s2])
        page = PageObject(name="LoginPage", selectors=[s1], components=[component])
        pom = POMStructure(page_objects=[page])
        all_selectors = pom.get_all_selectors()
        assert s1 in all_selectors
        assert s2 in all_selectors
        assert len(all_selectors) == 2
