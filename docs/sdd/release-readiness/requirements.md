# Requirements — Release Readiness (T21 / T22 / T23)

> Group: `release-readiness`
> Tasks: T21 (Documentation), T22 (npm publish), T23 (Example project)
> Format: EARS (Easy Approach to Requirements Syntax)

---

## Functional Requirements

### FR-01 — Public README for packages/core

**WHEN** a developer or potential user visits the `playwright-ppia` npm package page or the `packages/core/` directory on GitHub,
**THE SYSTEM SHALL** present a `README.md` that includes:
- Framework description and value proposition
- Installation instructions (`npm install --save-dev playwright-ppia`)
- Quick Start section covering `ppia init` and `ppia generate`
- Description of all CLI subcommands (`generate`, `run`, `setup`, `suite`, `docs`, `compare`)
- Prerequisites (Node >=18, Python >=3.10, an OpenAI or Anthropic API key)
- Link to the root `CONTRIBUTING.md`

**Rationale**: The current `packages/core/` directory has no README; the npm page will be blank without one.

---

### FR-02 — Contributor guide (CONTRIBUTING.md)

**WHEN** a contributor opens a pull request or wants to set up a local development environment,
**THE SYSTEM SHALL** provide a `CONTRIBUTING.md` at the repository root that covers:
- Repository structure (monorepo layout, `packages/core/`, `packages/core/python/`)
- Local setup steps (pnpm install, Python venv, environment variables)
- How to run TypeScript quality checks (`pnpm lint`, `pnpm typecheck`, `pnpm test`)
- How to run Python quality checks (`ruff check`, `mypy --strict`, `pytest`)
- Branch naming convention and PR workflow
- Commit message convention (Conventional Commits)

**Rationale**: No `CONTRIBUTING.md` exists in the repository root.

---

### FR-03 — Real npm publish in release pipeline

**WHEN** a commit is pushed to `master` and the `release.yml` workflow reaches the publish step,
**THE SYSTEM SHALL** execute `npm publish --access public` from `packages/core/` using the `NPM_TOKEN` secret stored in GitHub Actions,
**INSTEAD OF** the current placeholder `echo` command.

The publish step SHALL:
- Run `pnpm build` before publishing to ensure `dist/` is up to date
- Use `NODE_AUTH_TOKEN` environment variable populated from `secrets.NPM_TOKEN`
- Set `registry-url: https://registry.npmjs.org` on the `setup-node` action
- Publish only after the version bump and tag have been committed and pushed

**Rationale**: `release.yml` contains `echo "npm publish will be enabled in T22"` — no actual publish occurs today.

---

### FR-04 — `files` field correctness in packages/core/package.json

**WHEN** the package is published to npm,
**THE SYSTEM SHALL** include exactly the following in the published artifact:
- `dist/` — compiled TypeScript output
- `python/` — Python AI service source (bundled with the npm package)

**AND SHALL NOT** include `src/`, `node_modules/`, test files, or any file matching `.env*`.

**Rationale**: The `files` field already exists (`["dist/", "python/"]`) but must be validated against the actual build output before enabling real publishing.

---

### FR-05 — NPM_TOKEN secret provisioning

**WHEN** a repository administrator sets up the project for automated publishing,
**THE SYSTEM SHALL** require that an `NPM_TOKEN` secret with publish rights is registered in the GitHub repository's Actions secrets under the exact key `NPM_TOKEN`.

The `release.yml` workflow SHALL fail with a clear error (not silently skip) if the secret is absent or empty.

**Rationale**: Without the secret being explicitly provisioned, the publish step would fail with an opaque authentication error.

---

### FR-06 — Example project (examples/basic-project/)

**WHEN** a new user wants to understand how to integrate `playwright-ppia` into a project from scratch,
**THE SYSTEM SHALL** provide a self-contained example under `examples/basic-project/` that demonstrates:
- Running `ppia init` to generate `ppia.yaml`
- Running `ppia generate` with a natural language description
- The resulting directory structure (`.ppia/`, `output/`)
- A minimal `package.json` that installs `playwright-ppia` as a dev dependency

The example SHALL NOT require any running application or live URL to be read as documentation.

**Rationale**: No example project exists today; new users have no reference beyond the root README.

---

## Non-Functional Requirements

### NFR-01 — Security: NPM_TOKEN handling

The `NPM_TOKEN` secret SHALL:
- Never be printed to GitHub Actions logs (no `echo $NPM_TOKEN`, no `--verbose` npm flags that expose it)
- Be consumed exclusively via the `NODE_AUTH_TOKEN` environment variable on the publish step
- Not be stored in any committed file (`.npmrc`, `package.json`, workflow files)

A `.npmrc` file SHALL NOT be committed to the repository; authentication SHALL be handled solely through the GitHub Actions environment.

---

### NFR-02 — Maintainability: documentation stays current

The `packages/core/README.md` and root `CONTRIBUTING.md` SHALL be written so that:
- CLI subcommand list is the single source of truth (cross-referenced from `src/cli/index.ts`)
- Adding a new subcommand requires updating only `README.md` — no duplication across multiple doc files
- The example project in `examples/basic-project/` uses `playwright-ppia` as a versioned dev dependency (`"playwright-ppia": "^0.x.x"`) so it tracks npm releases naturally

---

### NFR-03 — Idempotency: release pipeline

The `release.yml` publish step SHALL be idempotent with respect to already-published versions: if the version tag already exists on npm (e.g., due to a re-run), the step SHALL exit with a non-zero code and surface a human-readable error rather than silently overwrite the existing version.

---

## Out of Scope

- Scoped npm package name (e.g., `@ppia/core`) — decided against in ADR-01 (see `design.md`)
- Automated changelog generation
- CDN / unpkg distribution
- Documentation site (separate future task)
