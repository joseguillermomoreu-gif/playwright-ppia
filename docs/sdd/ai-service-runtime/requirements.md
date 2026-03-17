# T24 — Requirements: Startup Check
## Health Check, Price Scraping, and Cost Estimation

> Format: EARS (Easy Approach to Requirements Syntax)
> Last updated: 2026-03-17

---

## Functional Requirements

### FR-01 — Health Endpoint (MUST)

**When** the Python AI Service starts, **the system shall** expose a `GET /ping` endpoint that returns `{ "status": "ok", "version": "<semver>" }` with HTTP 200.

**When** the TypeScript CLI polls `GET /ping` after spawning the Python process, **the system shall** retry up to 10 times at 300 ms intervals and consider the service ready on the first successful 200 response.

**If** the Python AI Service does not respond with HTTP 200 within 3 seconds of the first spawn attempt, **the system shall** abort startup and display a human-readable error message that includes the process stderr output.

---

### FR-02 — Price Scraping (MUST)

**When** the startup check runs and no valid cache exists for today, **the system shall** fetch model pricing data from `https://openrouter.ai/api/v1/models` using a plain HTTP GET request (no browser required).

**The system shall** extract, for each configured model (`model_fast` and `model_strong`), the following fields:
- `prompt` cost (USD per token)
- `completion` cost (USD per token)
- `context_length` (tokens)

**If** the HTTP request fails or the response does not contain pricing for a configured model, **the system shall** fall back silently to the existing `.ppia/llm-pricing.json` cache without surfacing an error to the user.

---

### FR-03 — Price Cache (MUST)

**When** price scraping succeeds, **the system shall** write the result to `.ppia/llm-pricing.json` relative to `--project-root`, including a `fetched_at` ISO-8601 timestamp per model.

**When** the startup check runs and `.ppia/llm-pricing.json` exists with a `fetched_at` date equal to today (UTC), **the system shall** skip the HTTP fetch and read prices from the cache directly.

**The system shall** never overwrite the cache with partial data — the write must be atomic (write to a temp file, then rename).

---

### FR-04 — Cost Estimation (MUST)

**When** the `POST /prepare-input` response is available, **the system shall** compute a per-session cost estimate using the formula:

```
exploration_cost = estimated_actions × avg_tokens_per_action × model_fast_price
generation_cost  = 1 × avg_tokens_generation × model_strong_price
total_estimated  = exploration_cost + generation_cost
```

Default token budgets (overridable in `ppia.yaml`):
- `avg_tokens_per_action`: 2 500 (input + output combined)
- `avg_tokens_generation`: 8 000

**The system shall** return `estimated_cost` (USD, float, 4 decimal places) in the `/prepare-input` response.

---

### FR-05 — Startup Display (MUST)

**When** the startup check completes, **the TypeScript CLI shall** display a startup panel to the terminal that includes:

1. Tool versions (Node.js, Python, AI Service)
2. API key presence — `✅ configured` or `❌ not set` (never the key value)
3. Current prices for `model_fast` and `model_strong` (input / output per MTok)
4. Cost estimate for the current session, broken down by phase (exploration / generation / total)

**If** prices are sourced from cache (not freshly scraped), **the system shall** append `(cached)` to the price display.

---

### FR-06 — Once-Per-Day Gate (SHOULD)

**When** `ppia generate` is invoked, **the system shall** check `.ppia/last-startup.json` for a `ran_at` date equal to today (UTC).

**If** the gate condition is met (already ran today), **the system shall** skip FR-02 through FR-05 and proceed directly to the main flow.

**When** the startup check runs to completion without error, **the system shall** write `.ppia/last-startup.json` with `{ "ran_at": "<ISO date UTC>", "version": "<semver>" }`.

---

## Non-Functional Requirements

### NFR-01 — Performance
The complete startup check shall complete within **3 seconds** on a standard broadband connection. The health check phase alone shall complete within **1 second** of the Python process being ready.

### NFR-02 — Security
- API key values **shall never** appear in any log file, terminal output, or HTTP response body.
- The CLI shall display only `✅ configured` or `❌ not set` per key.
- The `.ppia/llm-pricing.json` cache shall not contain any secret or credential.

### NFR-03 — Maintainability
- The pricing adapter shall implement a `PricingPort` interface (domain layer) so the data source can be swapped without touching application logic.
- Token budget defaults shall be defined as named constants in a single location.
- The price cache schema shall be versioned (`"schema_version": 1`) to allow future migrations.

### NFR-04 — Resilience
The startup check shall be fully non-blocking for the main flow: any failure in price scraping or cost estimation shall degrade gracefully to "prices unavailable" and shall not prevent `ppia generate` from proceeding.
