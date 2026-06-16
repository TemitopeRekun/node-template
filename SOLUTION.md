# Creator Card Microservice — Solution Notes

A REST API for publishing shareable creator profile cards, built on the
provided R17 backend template (Node.js + Express + MongoDB, with the template's
validator DSL and error utilities).

## Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/creator-cards` | Create a card (validates, auto-generates slug, returns the card) |
| `GET` | `/creator-cards/:slug` | Public retrieval, honouring draft + private access rules |
| `DELETE` | `/creator-cards/:slug` | Soft-delete a card and return it in the creation response format |
| `GET` | `/` | Health check (returns `{ status: 'ok' }`) for uptime probes |

No auth, no URL versioning — the assessment endpoints live at the root of the base URL.

## Project layout (follows the template conventions)

```
endpoints/creator-cards/      create.js · get.js · delete.js   (HTTP handlers)
endpoints/health/             health.js                        (GET / health check)
services/creator-cards/       create-creator-card.js · get-creator-card.js
                              delete-creator-card.js · serialize-card.js
                              card-rules.js (pure, unit-tested helpers)
repository/creator-cards/     creator-card.js                  (repository factory)
models/creator-card.js        Mongoose model (_id = ULID)
messages/creator-cards.js     all human-readable messages
test/creator-cards/           card-rules · serialize-card · create-creator-card specs
```

Routes are registered by adding `./endpoints/creator-cards/` to
`ENDPOINT_CONFIGS` in `app.js`; the template auto-loads every handler file in
that directory.

## Core changes (deliberate, minimal, and why they were required)

The template, as shipped, cannot satisfy the assessment contract without these
three edits. All of them use the template's own primitives.

### 1. `core/express/server.js` — surface the error `code` *(load-bearing)*

The error handler serialized `status`, `message`, `errors`, and `data`, but
never the error code. The spec requires every business-rule error to return
`"code": "SL02"` (etc.). Added:

```js
if (error.isApplicationError && error.errorCode) {
  responseComponents.body.code = error.errorCode;
}
```

This reads `error.errorCode`, which is exactly what the template's own
`throwAppError(message, code)` sets. Without it, no error response could carry a
`code`.

### 2. `core/errors/constants.js` — map business codes to HTTP statuses *(load-bearing)*

HTTP status is derived from `ERROR_STATUS_CODE_MAPPING[errorCode]` (fallback
400). The 400 codes work via the fallback, but `NF01`/`NF02` need 404 and
`AC03`/`AC04` need 403, so they were added to the map:

```js
SL02: 400, AC01: 400, AC05: 400,
NF01: 404, NF02: 404,
AC03: 403, AC04: 403,
```

This is the template's designated place for code→status mapping, so it was
extended rather than worked around.

### 3. `core/express/server.js` — consistent malformed-JSON shape *(cosmetic)*

The bad-JSON 400 response was `{code, error:true, message}`; changed to
`{status:'error', message, code:'ERR'}` so every error the service emits has an
identical shape. The original already returned a non-crashing 400 — this is
purely uniformity.

### 4. `core/express/server.js` — redact `access_code` from request logs *(security)*

Added `access_code` to the request-log `sanitizableFields` list (alongside
`authorization`/`password`) so a private card's pin is masked in any
request/error log line.

No other `core/` file was modified.

## Response shapes

Success:
```json
{ "status": "success", "message": "...", "data": { ... } }
```
Error:
```json
{ "status": "error", "message": "...", "code": "SL02" }
```

`access_code` is present in **create** and **delete** responses (the creator
needs it) and **omitted entirely** from public **retrieval** responses.
The identifier is always exposed as `id`, never `_id`.

## Validation strategy

Field-level rules (types, required, lengths, enums) are handled by the
template's validator DSL (VSL) and return **HTTP 400** with auto-generated,
non-empty messages. Rules VSL cannot express (no regex / integer constraints)
are enforced in the service and also return 400. Business rules carry the
custom codes from the spec.

### Field-level rules (VSL → 400)

| Rule | Example message |
|------|-----------------|
| `title` 3–100, required | `Passed title length 2 should be at least 3` / `title is required!` |
| `description` ≤ 500 | `Passed description length 501 should be at most 500` |
| `slug` 5–50 (client-provided) | `Passed slug length 4 should be at least 5` |
| `creator_reference` exactly 20 | `Passed creator_reference length 5 should be 20` |
| `links[].title` 1–100, `links[].url` ≤ 200 | length messages |
| `service_rates.currency` enum | `Expected ... to be one of NGN, USD, GBP, GHS` |
| `service_rates.rates` non-empty | `service_rates.rates is required!` |
| `rates[].name` 3–100, `rates[].description` ≤ 250 | length messages |
| `amount` is a number | `Invalid Type Passed for ...amount: Expected number got string` |
| `status` enum, required | `Expected status's value: archived to be one of draft, published` |
| `access_type` enum | `Expected access_type's value: secret to be one of public, private` |

### Rules VSL cannot express (enforced in-service → 400)

| Rule | Message |
|------|---------|
| `links[].url` must start with `http://` / `https://` | `links[0].url must start with http:// or https://` |
| `amount` positive integer (no 0, negatives, decimals) | `service_rates.rates[0].amount must be a positive integer` |
| client `slug` character set | `slug may only contain letters, numbers, hyphens and underscores` |
| `access_code` exactly 6 alphanumeric | `access_code must be exactly 6 alphanumeric characters` |

### Business rules (custom codes)

| Code | Status | Message |
|------|--------|---------|
| `SL02` | 400 | Slug is already taken |
| `AC01` | 400 | access_code is required when access_type is private |
| `AC05` | 400 | access_code can only be set on private cards |
| `NF01` | 404 | Creator card not found |
| `NF02` | 404 | Creator card not found |
| `AC03` | 403 | This card is private. An access code is required |
| `AC04` | 403 | Invalid access code |

Retrieval access checks run in the required order: **NF01** (missing) →
**NF02** (draft) → **AC03** (private, no code) → **AC04** (private, wrong code).

## Slug handling

A client-provided slug is validated (length by VSL, character set in-service)
and rejected with **SL02** if taken — it is never silently modified.

When omitted, the slug is auto-generated from the title: lowercase → whitespace
to hyphens → drop characters that aren't letters, numbers, `-` or `_`. If the
result is shorter than 5 characters or already taken, a `-` plus a random
6-character alphanumeric suffix is appended (retried until unique).

## MongoDB & serialization

- `_id` is a ULID, stored per Mongo convention and always serialized as `id`;
  `_id` never leaks into a response.
- `access_code` is stored, returned on create/delete, and stripped on public
  retrieval.
- Soft delete sets a `deleted` epoch-ms timestamp; deleted cards are excluded
  from retrieval (→ NF01).
- `created` / `updated` / `deleted` are numbers (epoch milliseconds).
- The validator strips unknown fields, so a client cannot inject `_id`,
  `created`, `deleted`, or any other field into the stored document.

## Edge cases the spec did not call out (hardened anyway)

- **Slug uniqueness counts soft-deleted cards** to stay consistent with the
  unique index on `slug`; otherwise reusing a deleted slug would cause a Mongo
  duplicate-key 500.
- **Auto-generated slugs are capped at 50 characters** (with trailing-hyphen
  cleanup), so a long title can never produce an over-length slug.
- **Empty auto-slug** (a title of only symbols) falls back to `card`.
- **`access_code` with `access_type` omitted** still returns AC05 (default is
  public).
- **Malformed JSON** → 400 in the standard error shape, never a crash.
- **Unexpected server errors** → 500 with a safe generic message, never a crash.

## Deliberate interpretations of ambiguous spec points

- **Delete does not verify `creator_reference` ownership.** The spec only
  requires the field to be present and exactly 20 characters, and states that
  delete-by-slug succeeds. A mismatch-rejecting ownership check is not
  implemented because it would conflict with that.
- **Consecutive whitespace in a title becomes consecutive hyphens**
  (`"A  B"` → `a--b`), following the literal rule "replace whitespace with
  hyphens"; they are not collapsed because the spec does not say to.

## No regex

Per the template's "No Regex Allowed" rule, all character-class checks (slug
generation, slug/access_code/url validation) are implemented with plain string
methods and explicit character-range comparisons.

## Testing

**Unit tests** (`npm test`, mocha) cover the assessment-specific logic against
the template's mock models, so they need no database:

- `card-rules` — slug generation, slug/access-code/url validation, suffix logic
- `serialize-card` — `_id`→`id` mapping, `access_code` inclusion/omission, defaults
- `create-creator-card` — every validation and business-rule error resolves to
  the correct code (SPCL_VALIDATION / VALIDATION_ERROR / AC01 / AC05)

**End-to-end:** all 16 assessment test cases plus additional edge cases
(malformed JSON, non-integer amount, bad URL scheme, long-title slug cap,
soft-deleted slug reuse, duplicate auto-slug, bad access-code length, string
amount, health check) were run against a live MongoDB Atlas instance — all
passing.
