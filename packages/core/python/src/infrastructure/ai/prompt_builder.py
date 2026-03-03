from __future__ import annotations


def build_system_prompt(context: str = "") -> str:
    base = (
        "You are an expert test automation engineer specializing in Playwright and TypeScript. "
        "You generate clean, maintainable E2E tests following the Page Object Model pattern."
    )
    if context:
        return f"{base}\n\nAdditional context:\n{context}"
    return base


def build_analysis_prompt(test_content: str) -> str:
    return (
        "Analyze the following test content and extract:\n"
        "1. Test objective\n"
        "2. Test steps (given/when/then)\n"
        "3. Selectors used\n"
        "4. Page objects referenced\n\n"
        f"Test content:\n{test_content}"
    )
