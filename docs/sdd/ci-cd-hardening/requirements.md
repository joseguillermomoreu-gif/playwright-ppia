# Requirements — ci-cd-hardening

> Group: T25, T28, T29
> Last updated: 2026-03-17

---

## 1. Purpose

This document specifies the requirements for hardening the CI/CD pipeline of the
`playwright-ppia` project. The group addresses three independent but related
improvements: dependency caching for the TypeScript job (T25), dependency caching
for the Python job (T28), and permission scoping for the release workflow (T29).

---

## 2. Functional Requirements

### FR-01 — pnpm dependency cache in ci-typescript [MUST]

**UBIQUITOUS:** THE SYSTEM SHALL configure `actions/setup-node@v4` in the
`ci-typescript` job of `ci.yml` with `cache: pnpm` so that pnpm's package store
is persisted and restored across CI runs on the same branch.

**Acceptance criteria:**
- `setup-node@v4` step in `ci-typescript` includes `cache: pnpm`.
- A warm run (lockfile unchanged) skips the full `pnpm install` network fetch.

---

### FR-02 — pip dependency cache in ci-python [MUST]

**UBIQUITOUS:** THE SYSTEM SHALL configure `actions/setup-python@v5` in the
`ci-python` job of `ci.yml` with `cache: 'pip'` so that pip's HTTP cache is
persisted and restored across CI runs on the same branch.

**Acceptance criteria:**
- `setup-python@v5` step in `ci-python` includes `cache: 'pip'`.
- A warm run (no dependency changes) restores packages from cache without
  downloading from PyPI.

---

### FR-03 — Job-scoped permissions in release.yml [MUST]

**UBIQUITOUS:** THE SYSTEM SHALL move the `permissions: contents: write`
declaration in `release.yml` from the workflow level to the `release` job level,
so that only the job that requires write access to repository contents holds that
permission.

**Acceptance criteria:**
- No `permissions` block exists at the top-level workflow scope in `release.yml`.
- The `release` job contains `permissions: contents: write`.
- The workflow continues to push the version bump commit and tag successfully
  after the change.

---

### FR-04 — CI duration improvement [SHOULD]

**EVENT-DRIVEN:** WHEN a pull request is opened or updated against `develop` or
`master`, THE SYSTEM SHALL restore cached dependencies for both the TypeScript
and Python jobs within the normal GitHub Actions cache TTL (7 days), reducing
average job duration compared to a cold run.

**Note:** No hard SLA is imposed; improvement is expected but not instrumented
in this group.

---

### FR-05 — No regression on existing CI behaviour [MUST]

**UNWANTED:** IF any change in this group causes an existing passing check
(lint, typecheck, tests) to fail on a previously passing pull request, THEN THE
SYSTEM SHALL surface the failure in the CI run so it can be investigated and
corrected before merging.

---

## 3. Non-Functional Requirements

### NFR-01 — Security: Principle of Least Privilege

The `release.yml` workflow MUST NOT grant `contents: write` at workflow scope.
Other jobs added to the workflow in the future MUST NOT inherit write access to
repository contents unless explicitly declared in their own `permissions` block.

### NFR-02 — Performance: Cache hit ratio

The pnpm and pip caches SHALL use the action-native cache keys derived from the
lockfile (`pnpm-lock.yaml` for pnpm, `requirements` files for pip). This
maximises hit ratio without additional custom cache configuration.

### NFR-03 — Maintainability: Configuration locality

Cache and permission settings SHALL be declared as close as possible to the step
or job they govern (i.e., inside `with:` of the setup action, or inside the job
block), not as global workflow-level variables or secrets, to make intent
immediately readable during code review.

### NFR-04 — Compatibility: Pinned action versions

All changes SHALL use the action versions already present in the workflow
(`actions/setup-node@v4`, `actions/setup-python@v5`) and SHALL NOT introduce
new actions or bump existing ones as a side effect of this group.
