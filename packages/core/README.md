# playwright-ppia

[![npm version](https://img.shields.io/npm/v/playwright-ppia.svg)](https://www.npmjs.com/package/playwright-ppia)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered test generation framework for Playwright. Generate complete E2E tests from natural language descriptions — including Page Objects, selectors, and assertions — for your existing Playwright projects.

## Prerequisites

- **Node.js** 18+
- **Python** 3.11+ (managed automatically by the CLI — no manual setup required)
- **Playwright** installed in your project
- At least one API key: `OPENAI_API_KEY` or `ANTHROPIC_API_KEY`

## Installation

```bash
npm install --save-dev playwright-ppia
```

## Quick Start

### 1. Initialise your project

```bash
npx ppia setup add
```

This interactive command creates a `ppia.yaml` configuration file in your project root, guiding you through environment URLs, user credentials, and authentication flows.

### 2. Generate a test

```bash
npx ppia generate "Validate user login with valid credentials"
```

`playwright-ppia` will:
1. Start a browser and explore your application
2. Analyse the page structure with AI
3. Generate a complete `.spec.ts` file in `output/`
4. Validate the test by running it with Playwright

## CLI Reference

### `ppia generate`

Generate a new E2E test from a natural language description.

```bash
ppia generate "<description>" [--setup <env>] [--user <user>] [--model <model>]
```

| Option | Description |
|--------|-------------|
| `--setup <env>` | Use a pre-configured environment and auth setup |
| `--user <user>` | Specify a named user from `ppia.yaml` |
| `--model <model>` | Override the generation model for this run |

### `ppia run`

Run one or more tests from your suite.

```bash
ppia run [--test <name>] [--suite <path>] [--user <user>] [--setup <env>]
```

### `ppia docs`

Regenerate documentation artefacts (Page Object Model, Gherkin spec, Cucumber guide) from an existing test.

```bash
ppia docs --input output/<test_name>/test.spec.ts
ppia docs --suite <path>
```

### `ppia compare`

Compare two versions of a generated test side by side.

```bash
ppia compare --test <name> --before v1 --after v2
```

### `ppia suite`

Manage your test suite history.

```bash
ppia suite list [--filter <keyword>]
ppia suite show <test_name>
ppia suite versions <test_name>
ppia suite clean [--older-than 30d]
```

### `ppia setup`

Create and manage authentication setups.

```bash
ppia setup add                          # interactive: create env + user + auth flow
ppia setup list                         # list available setups in ppia.yaml
ppia setup test <env> <user>            # verify a setup works correctly
ppia setup remove <env>                 # remove a setup from ppia.yaml
```

## Configuration (`ppia.yaml`)

`ppia.yaml` lives in your project root. All fields are optional except `project.name`.

```yaml
project:
  name: my-project

ai_service:
  model_fast: gpt-4o-mini       # exploration model (default: gpt-4o-mini)
  model_strong: gpt-4o          # generation model  (default: gpt-4o)
  max_iterations: 25            # max exploration rounds (default: 25)
  max_generation_attempts: 3    # generation retries   (default: 3)

environments:
  staging:
    base_url: https://staging.example.com
  production:
    base_url: https://example.com

users:
  admin:
    email: admin@example.com
    password: ${ADMIN_PASSWORD}   # environment variable reference
    role: administrator
    auth_flow: login_form
  guest:
    role: anonymous

output:
  dir: ./output
  artifacts: integrated           # integrated | docs
```

### API keys

Set at least one of these environment variables before running `ppia`:

```bash
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
```

## How It Works

`playwright-ppia` uses a two-phase AI pipeline:

1. **Exploration** — A browser session navigates your app while an AI model (`model_fast`) analyses each page state and decides the next action.
2. **Generation** — A second AI model (`model_strong`) receives the full exploration report and generates a complete, validated `.spec.ts` file plus optional artefacts (Page Object Model, Gherkin spec, Cucumber guide).

The Python AI service is bundled inside the npm package and launched automatically. You never need to install or configure Python manually.

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for local setup instructions, quality check commands, and the PR workflow.

## License

MIT
