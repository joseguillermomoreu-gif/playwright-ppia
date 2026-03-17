# playwright-ppia

AI-powered test generation framework for Playwright.

Generate complete E2E tests from natural language descriptions — including Page Objects, selectors, and assertions — for your existing Playwright projects.

## Installation

```bash
npm install --save-dev playwright-ppia
```

## Quick Start

```bash
npx ppia generate "Validate user login with valid credentials"
```

## How It Works

1. **You describe** what to test in natural language
2. **PPIA explores** your application using a real browser
3. **AI analyzes** the page structure and generates reliable selectors
4. **You get** a complete `.spec.ts` file ready to run

## Architecture

- **TypeScript framework** (`packages/core/`) — CLI, browser automation, test execution
- **Python AI service** (internal) — LLM integration, prompt engineering, code generation

The Python service is bundled inside the npm package and managed transparently. You never need to install or configure Python manually.

## Documentation

Full CLI reference, configuration guide, and API details: [packages/core/README.md](packages/core/README.md)

Want to contribute? See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
