from __future__ import annotations

import json

GENERATION_SYSTEM_PROMPT = """\
You are an expert Playwright test engineer. Generate a complete, runnable .spec.ts test file.

Rules:
- Use TypeScript with Playwright's test runner (`import { test, expect } from '@playwright/test'`)
- Follow Page Object Model pattern where applicable
- Prefer role-based selectors (getByRole), then label (getByLabel), \
then testId (getByTestId), then text, CSS as last resort
- Leverage Playwright auto-waiting — do NOT use waitForTimeout()
- Include proper assertions for each step
- Handle async/await correctly
- Add descriptive test.describe and test blocks
- Do NOT wrap the output in markdown code blocks — return raw TypeScript only\
"""

GENERATION_WITH_FAILURE_PROMPT = """\
The previous test attempt FAILED. Below is the failure report.
You MUST fix the issues described and generate a corrected test.
Do NOT repeat the same mistakes. Analyze the failure and adapt your approach.

Failure report:
{failure_report}\
"""


def build_generation_prompt(
    exploration_report: dict[str, object],
    failure_report: dict[str, object] | None = None,
) -> str:
    parts = [
        "Generate a Playwright .spec.ts test based on this exploration report:",
        json.dumps(exploration_report, indent=2),
    ]
    if failure_report:
        parts.append(GENERATION_WITH_FAILURE_PROMPT.format(failure_report=json.dumps(failure_report, indent=2)))
    return "\n\n".join(parts)
