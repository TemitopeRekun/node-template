# Creator Card Microservice

[![CI](https://github.com/TemitopeRekun/node-template/actions/workflows/ci.yml/badge.svg)](https://github.com/TemitopeRekun/node-template/actions/workflows/ci.yml)

A REST API for publishing shareable creator profile cards (links + service
rates), built on the R17 backend template.

> 📐 **Implementation design, rules coverage, and decisions: [SOLUTION.md](./SOLUTION.md)**
> 📖 **Template architecture reference: [documentation.md](./documentation.md)**

## Live API

**Base URL:** `https://node-template-a2f0.onrender.com`

Endpoints are served at the root of the base URL (no auth, no versioning):

```
POST   https://node-template-a2f0.onrender.com/creator-cards
GET    https://node-template-a2f0.onrender.com/creator-cards/:slug
DELETE https://node-template-a2f0.onrender.com/creator-cards/:slug
GET    https://node-template-a2f0.onrender.com/            # health check
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/creator-cards` | Create a creator card |
| `GET` | `/creator-cards/:slug` | Public retrieval (honours draft + private access rules) |
| `DELETE` | `/creator-cards/:slug` | Delete a card (returns the deleted card) |
| `GET` | `/` | Health check |

No authentication and no URL versioning — all paths live at the root of the base URL.

## Getting started

**Requirements:** Node.js 20 LTS (see `.nvmrc`) and a MongoDB connection string (MongoDB Atlas free tier works).

```bash
npm install                 # install dependencies
cp .env.example .env        # then set PORT and MONGODB_URI
npm start                   # start the server (node bootstrap.js)
```

Minimum `.env`:

```
PORT=8811
MONGODB_URI=mongodb+srv://<user>:<pass>@<cluster>/creator_cards?retryWrites=true&w=majority
```

All other variables are optional — the queue/Redis, email, JWT and secrets
manager stay inactive unless their variables are set, and none of the endpoints
depend on them.

## Testing

```bash
npm test                    # unit tests (mocha) for rules, serializer and validation
npm run test:e2e            # end-to-end smoke test against a running server
```

- **Unit tests** run against the template's mock models, so they need no database.
- **End-to-end** (`scripts/creator-cards.e2e.js`) exercises all three endpoints
  over HTTP. It is non-destructive — every card it creates is namespaced with a
  unique per-run id and cleaned up afterwards, so it is safe to run against the
  live deployment:

  ```bash
  E2E_BASE=https://node-template-a2f0.onrender.com npm run test:e2e
  # defaults to http://localhost:8811 when E2E_BASE is unset
  ```

## Deployment (Render / Heroku)

- **Build:** `npm install`
- **Start:** `node bootstrap.js`
- **Env:** set `MONGODB_URI` only. Do not set `PORT` (the platform injects it)
  or `NODE_ENV=production` (it would skip the dev dependency used by the
  `prepare` hook). Allow Atlas network access from anywhere (`0.0.0.0/0`).

Render free instances sleep after ~15 minutes idle. The app self-pings its own
public URL (`RENDER_EXTERNAL_URL`, injected by Render) every 10 minutes to stay
awake — no external uptime service required. See [`keep-alive.js`](./keep-alive.js).

## Assessment compliance checklist

- Three endpoints at the root: `POST /creator-cards`, `GET /creator-cards/:slug`, `DELETE /creator-cards/:slug`
- No authentication and no URL versioning
- Field-level validation via the template validator (VSL) returns HTTP 400
- Business-rule codes returned with correct status: `SL02` (400), `AC01` (400), `AC05` (400), `NF01`/`NF02` (404), `AC03`/`AC04` (403)
- Responses expose `id`, never `_id`; `access_code` is returned on create/delete and omitted on retrieval
- Drafts return 404 `NF02`; deleted cards return 404 `NF01`
- Slug auto-generation and uniqueness (including soft-deleted cards) hold across requests
- Persisted in MongoDB Atlas; deployed on Render

## Template conventions

This service is built on the R17 backend template. For the full template
architecture reference (core modules, validator DSL syntax, repository patterns),
see [documentation.md](./documentation.md).
