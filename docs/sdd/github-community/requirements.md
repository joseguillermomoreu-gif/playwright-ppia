# Requirements — github-community
> SDD Group: T30 + T31
> Last updated: 2026-03-17

---

## Overview

This group covers the creation of GitHub community health files for the
`playwright-ppia` npm package repository. These files guide external contributors
when opening issues and pull requests, ensuring consistent, actionable reports
and reducing maintainer triage overhead.

---

## Functional Requirements (EARS format)

### FR-01 — Bug report template (MUST)

**When** a user clicks "New Issue" on the repository,
**the system shall** present a `Bug Report` template that collects:
reproduction steps, expected vs actual behaviour, environment details
(Node.js version, OS, `playwright-ppia` version), and the full error output.

### FR-02 — Feature request template (MUST)

**When** a user clicks "New Issue" on the repository,
**the system shall** present a `Feature Request` template that collects:
a problem statement, a proposed solution, alternatives considered,
and the use case context from the user's project.

### FR-03 — Pull request template (MUST)

**When** a contributor opens a Pull Request,
**the system shall** pre-fill the PR body with a structured template that
includes: a summary section, a type-of-change checklist, a test plan
checklist, and the `Closes #N` trailer for automatic issue linking.

### FR-04 — Blank issue fallback (SHOULD)

**Where** neither bug report nor feature request fits,
**the system should** provide an option to open a blank issue so that
discussion-type threads are not blocked by the template mechanism.

---

## Non-Functional Requirements

### NFR-01 — Language consistency

All community templates MUST be written in **English**.
Rationale: the package is published on npm and targets an international
Playwright / QA automation audience. Internal project tooling (CLAUDE.md,
ARCHITECTURE.md) is in Spanish and is not part of the public-facing surface.

### NFR-02 — Maintainability

Templates MUST use GitHub-flavoured Markdown only (no HTML, no YAML front
matter beyond the `name`/`description`/`labels` fields recognised by GitHub).
This ensures they render correctly without additional tooling and remain easy
to update in a text editor.

### NFR-03 — Security

Templates MUST NOT request API keys, passwords, `ppia.yaml` credentials, or
any other sensitive value in plain text.
The bug report template MUST include a visible reminder to redact credentials
before submitting environment details.

### NFR-04 — Traceability

The pull request template MUST include a `Closes #N` placeholder to enforce
the automatic issue-closing convention already established in `CLAUDE.md`
(§ Cierre automático de issues).
