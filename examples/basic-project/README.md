# PPIA Basic Example

This example demonstrates how to use **playwright-ppia** to generate complete E2E tests from natural language descriptions.

## Overview

`playwright-ppia` is an AI-powered test generation framework that:

1. Takes a natural language description of what to test
2. Launches a real browser and explores your application
3. Uses AI to analyse page structure and generate reliable selectors
4. Produces a complete, working `.spec.ts` test file
5. Optionally generates supporting artefacts: Page Object Model, Gherkin specs, and Cucumber guides

This example walks you through a complete workflow from setup to generating your first test.

## Prerequisites

- **Node.js** 18 or higher
- **npm**, **yarn**, or **pnpm** (this example uses npm)
- **Python** 3.11+ (managed automatically — no manual setup required)
- An **API key** for at least one LLM:
  - `OPENAI_API_KEY` (for OpenAI models like `gpt-4o`)
  - `ANTHROPIC_API_KEY` (for Anthropic models like `claude-opus`)

## Installation

```bash
npm install
```

This installs `playwright-ppia` and its dependencies (including Playwright itself).

## Configuration

Before generating tests, update `ppia.yaml` with your application's details:

### 1. Update the environment URL

Edit `ppia.yaml` and replace the placeholder URL:

```yaml
environments:
  staging:
    base_url: "https://your-actual-app-url.com"  # Change this to your app
```

### 2. Configure user credentials

If your application requires login, update the user section:

```yaml
users:
  admin:
    email: admin@your-app.com
    password: "${ADMIN_PASSWORD}"
    auth_flow: login_form
```

Then set the environment variable **before** running `ppia`:

```bash
export ADMIN_PASSWORD="your-actual-password"
npx ppia generate "..."
```

### 3. Set your API key

Before running any `ppia` command, ensure at least one API key is available:

```bash
# Option A: OpenAI
export OPENAI_API_KEY=sk-proj-...

# Option B: Anthropic
export ANTHROPIC_API_KEY=sk-ant-...
```

## Generate Your First Test

Once configured, generate a test with a natural language description:

```bash
npx ppia generate "Validate user login with valid credentials"
```

PPIA will:

1. **Startup check** — verify Node.js, Python, Playwright, and API keys
2. **Exploration phase** — launch a browser, navigate your app, analyse page structure
3. **Generation phase** — generate a complete `.spec.ts` test file using AI
4. **Validation** — run the generated test with Playwright to ensure it works

You'll see progress in your terminal. After a few seconds, the test is ready.

## Inspect the Output

Generated tests and artefacts are saved in the `output/` directory:

```
output/
├── my_test_name/
│   ├── test.spec.ts          # The generated Playwright test
│   ├── POM.md                # Page Object Model (optional)
│   ├── gherkin.md            # BDD Gherkin specification (optional)
│   └── cucumber.md           # Cucumber integration guide (optional)
```

### test.spec.ts

A fully working Playwright test:

```typescript
import { test, expect } from "@playwright/test";

test("Validate user login with valid credentials", async ({ page }) => {
  // Initialization and navigation
  // ...

  // Test steps generated from your description
  await page.goto("https://your-app.com/login");
  await page.fill("input[name='email']", "admin@your-app.com");
  await page.fill("input[name='password']", "password");
  await page.click("button[type='submit']");

  // Assertions
  await expect(page).toHaveURL("https://your-app.com/dashboard");
  // ...
});
```

Run the test directly:

```bash
npx playwright test output/my_test_name/test.spec.ts
```

### POM.md

A markdown document describing the Page Object Model discovered during exploration:

- Selectors found on each page
- Element types (buttons, inputs, links)
- Reliable vs. problematic selector patterns
- Authentication flows

### gherkin.md

A BDD-style Gherkin specification of your test in plain English:

```
Feature: User Login
  Scenario: Validate user login with valid credentials
    Given I navigate to the login page
    When I fill email with "admin@your-app.com"
    And I fill password with "password"
    And I click the submit button
    Then I should be redirected to the dashboard
```

### cucumber.md

A guide for integrating the test with Cucumber if you use BDD workflows.

## Next Steps

For the complete PPIA documentation, including:

- Full CLI reference (`generate`, `run`, `docs`, `compare`, `suite`, `setup`)
- Advanced configuration options
- Knowledge Base and selector learning
- Cost estimation and pricing
- Troubleshooting

**See** [playwright-ppia README](../../packages/core/README.md)

---

## Tips

1. **Start simple** — begin with short, focused test descriptions:
   - ✅ "Validate login"
   - ✅ "Fill profile form and submit"
   - ❌ "Walk through entire user journey from signup to checkout with multiple error scenarios"

2. **Provide setup** — if your app requires authentication, configure a user in `ppia.yaml` before generating tests

3. **Inspect the output** — PPIA learns selectors as you generate tests. Check the output carefully; the more realistic your descriptions, the better the results

4. **Reuse knowledge** — once PPIA has generated a few tests, it stores selector knowledge in `.ppia/knowledge.json` (if you commit it), speeding up future test generation

5. **Use `ppia setup add`** — to interactively create and test authentication setups before generating tests:
   ```bash
   npx ppia setup add
   npx ppia setup test staging admin
   ```

---

## Configuration Reference

All fields in `ppia.yaml` are optional except `project.name`. See `ppia.yaml` in this directory for inline comments on each field.

For complete configuration schema and defaults, see [ARCHITECTURE.md](../../docs/ARCHITECTURE.md#configuration-de-proyecto-ppiayaml).
