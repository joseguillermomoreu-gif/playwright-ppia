# Contributing to playwright-ppia

Thank you for your interest in contributing! This guide covers everything you need to get up and running locally.

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | 18+ | Use the version in `.nvmrc` if present |
| pnpm | 9+ | `npm install -g pnpm` |
| Python | 3.11+ | Required for the AI Service |

## Local Setup

### 1. Clone and install TypeScript dependencies

```bash
git clone https://github.com/joseguillermomoreu-gif/playwright-ppia.git
cd playwright-ppia
pnpm install
```

### 2. Set up the Python AI Service

```bash
cd packages/core/python
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -e ".[dev]"
```

### 3. Configure environment variables

Copy the example env file and fill in at least one API key:

```bash
cp packages/core/python/.env.example packages/core/python/.env
# Edit .env and add OPENAI_API_KEY and/or ANTHROPIC_API_KEY
```

## Repository Layout

```
playwright-ppia/
├── packages/core/
│   ├── src/            # TypeScript CLI, agents, browser automation
│   ├── python/         # Python AI Service (FastAPI + LLM integrations)
│   └── package.json
├── examples/           # Usage examples
├── docs/               # Architecture and design documents
└── pnpm-lock.yaml
```

## Quality Checks

Run these before opening a pull request. The pre-push hook runs them automatically on `git push`.

### TypeScript

```bash
cd packages/core
pnpm lint        # ESLint
pnpm typecheck   # tsc --noEmit
pnpm test        # Vitest
```

### Python

```bash
cd packages/core/python
ruff check .     # Linter
mypy --strict src  # Type checker
pytest           # Tests
```

## Branch and Commit Conventions

- **Feature branches**: `feature/t{num}_{short_desc}` branched from `develop`
- **Hotfix branches**: `hotfix/t{num}_{short_desc}` branched from `master`
- **Commits**: follow [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat(scope): description` — new feature
  - `fix(scope): description` — bug fix
  - `chore(scope): description` — tooling, config, dependencies
  - `docs(scope): description` — documentation only

## PR Workflow

1. Create a branch from `origin/develop` (never from the local branch directly):
   ```bash
   git fetch origin
   git checkout -b feature/t{num}_{desc} origin/develop
   ```
2. Implement your changes
3. Ensure all quality checks pass locally
4. Push — the pre-push hook runs the full check suite automatically
5. Open a PR against `develop`
6. The PR body must include `Closes #N` to auto-close the related issue on merge

## Release Process

Releases are fully automated via `.github/workflows/release.yml`:

1. Merging to `master` triggers the release workflow
2. The workflow determines the version bump (patch / minor / major) from Conventional Commit prefixes
3. It bumps `packages/core/package.json`, creates a git tag, and publishes to npm

You do not need to manually bump versions or create tags.
