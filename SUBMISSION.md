# Submission — Creator Card Microservice

- **GitHub repository:** https://github.com/TemitopeRekun/node-template
- **Deployed base URL:** https://node-template-a2f0.onrender.com

## Endpoints (root of the base URL, no auth, no versioning)

```
POST   /creator-cards
GET    /creator-cards/:slug
DELETE /creator-cards/:slug
GET    /                      # health check
```

## Verify locally

```bash
npm install
npm run verify        # format check + lint + unit tests with coverage gate
```

## Verify against the deployment

```bash
E2E_BASE=https://node-template-a2f0.onrender.com npm run test:e2e
```

(Non-destructive: each card is namespaced per run and cleaned up afterwards.)

## Deliberate decisions

- `DELETE` validates that `creator_reference` is present and exactly 20
  characters, but does not enforce that it matches the card owner — the brief
  does not specify an ownership error code, so adding that check could conflict
  with the required behaviour.
- `access_code` is stored in plain text because the contract requires returning
  it on create/delete and comparing it on retrieval. In production it would be
  hashed and shown once.
- Three small, documented changes were made to the template's `core/` to satisfy
  the contract (serialize the error `code`, map business codes to HTTP statuses,
  redact `access_code` from logs). See [SOLUTION.md](./SOLUTION.md).
