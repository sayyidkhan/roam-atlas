# RoamAtlas Deployment

RoamAtlas has two deployable applications. Build and deploy them independently
from the same npm workspace lockfile.

## Frontend

Workspace: `@roamatlas/web`

```bash
npm ci
npm run build:web
```

Deploy `dist/web/` to a static host or CDN. Configure SPA fallback to
`index.html` for application routes such as `/singapore` and
`/singapore/config`.

The workspace install and frontend build require Node.js 22.22 or newer to
match React Router 8's runtime baseline.

The frontend owns bundled assets under `public/`, including
`/country-cards/*`. It does not require provider credentials.

## API

Workspace: `@roamatlas/api`

```bash
npm ci
npm run check:api
HOST=0.0.0.0 PORT=4151 npm run start:api
```

The API requires Node.js 22.18 or newer because it executes the TypeScript entry
directly using Node's built-in type stripping.

Relevant environment variables:

| Variable | Purpose |
| --- | --- |
| `HOST` | Bind address; use `0.0.0.0` in a container |
| `PORT` | API port; defaults to `4151` |
| `OPENAI_API_KEY` | Image and visual-description provider |
| `EXA_API_KEY` | Optional reference-media/grounding provider |
| `ROAMATLAS_RUNTIME_CACHE_DIR` | Writable generated-artifact directory |

See `.env.example` for non-secret tuning variables. Never expose provider keys
to the frontend build.

The API deployment needs:

- `apps/api/`
- `libs/`
- root `package.json` and `package-lock.json`

It does not need `apps/web/`, `public/`, or `dist/web/` at runtime.

## Routing

Use one public origin unless a separate CORS policy is intentionally added:

| Public path | Destination |
| --- | --- |
| `/api/*` | API deployment |
| `/runtime-cache/*` | API deployment |
| `/country-cards/*` | Static web deployment |
| all other paths | Static web deployment with SPA fallback |

The Vite development server applies this routing locally. Production must
provide the equivalent through the hosting platform, reverse proxy, or edge
router.

## Persistence Note

The current API runtime cache is filesystem-backed. A single API instance needs
a persistent writable volume. Horizontal scaling should wait until generated
artifacts and job metadata move to shared object storage and durable
persistence, as tracked in `ARCHITECTURE.md`. Redis is not required for the
current single-instance deployment; it is a later job-coordination adapter.
