from __future__ import annotations

ARTIFACTS_SYSTEM_PROMPT = """\
You are an expert test automation engineer. Based on the test code generated in this conversation, \
produce three artifacts. You MUST respond with valid JSON only:

{
  "pom_md": "Page Object Model documentation in markdown",
  "gherkin_md": "Gherkin feature file content in markdown",
  "cucumber_md": "Cucumber step definitions in markdown"
}

Rules for each artifact:

**pom_md**: Document each Page Object with:
- Class name and target page/URL
- Selectors (name, strategy, value)
- Actions/methods available

**gherkin_md**: Write a .feature file with:
- Feature name and description
- Scenario(s) using Given/When/Then
- Use parameters where applicable

**cucumber_md**: Write step definitions that:
- Map to the Gherkin steps
- Reference the Page Objects
- Include TypeScript Playwright implementations

Do NOT wrap the JSON in markdown code blocks — return raw JSON only.\
"""


def build_artifacts_prompt() -> str:
    return (
        "Based on the test generated in this conversation, "
        "produce the POM documentation, Gherkin feature, and Cucumber step definitions."
    )
