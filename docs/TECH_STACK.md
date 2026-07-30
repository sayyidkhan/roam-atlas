# RoamAtlas Tech Stack

## Decision

RoamAtlas is local-first for the current product stage. Redis is not part of
the current implementation. It becomes an option only when one API process can
no longer coordinate artwork jobs safely.

The state model separates ownership instead of putting every value in one
global store:

| State category | Current owner | Examples |
| --- | --- | --- |
| Route state | React Router | Country, place, and configuration URLs |
| Remote/API state | TanStack Query | Country-pack registry and artwork job polling |
| Shared browser workflow state | Zustand feature stores | Country setup and explorer presentation state |
| Component presentation state | React state and reducers | Dialogs, tabs, disclosure, and focus |
| Browser preferences | Typed storage adapters | Image quality and other user preferences |
| Server job state | API-owned repositories and runtime files | Artwork status, metadata, and generated artifacts |

Zustand must remain feature-scoped. Do not create one application-wide store
containing country setup, explorer, artwork, notifications, and remote data.
Components should subscribe through narrow selectors.

TanStack Query is the browser authority for server-owned data. Zustand may
retain active job ids and UI intent, but it must not duplicate country packs,
job responses, generated artifact metadata, or other API records.

## Current Local-First Topology

```text
React Router
  -> route identity

Zustand feature stores
  -> local workflow and cross-component UI state

TanStack Query
  -> API reads, cache, invalidation, and artwork job polling

Hono API
  -> job creation and factual/visual policy
  -> local runtime repository
  -> in-process worker coordination
  -> generated artifact files
```

Backend idempotency remains mandatory even while the app is local. An artwork
request should use a deterministic identity containing the country, node,
scene, data version, prompt version, style version, image model, and quality.
The browser cache improves responsiveness; the API identity prevents expensive
work from being repeated.

## Persistence Path

The browser may later persist selected TanStack Query data to IndexedDB and use
Cache Storage for generated image responses. Do not place image binaries or
large API payloads in Zustand or `localStorage`.

The current API filesystem remains suitable for one persistent API instance.
Before horizontal scaling, move:

1. Job and review metadata to PostgreSQL.
2. Generated images to S3-compatible object storage.
3. Queue coordination to a durable queue.

## When Redis Becomes Justified

Redis is a future adapter, not a current dependency. Introduce it only when at
least one of these conditions is real:

- Multiple API or worker instances must share active job status.
- Process restarts must not lose queue coordination.
- Duplicate expensive jobs occur across processes.
- Polling endpoints need a fast shared status projection.
- Distributed locks, leases, or rate limits become necessary.

At that point Redis can coordinate queue state, locks, progress, and temporary
status. PostgreSQL and object storage remain the durable record; generated
images should not be stored in Redis.

The frontend contract should not change:

```text
TanStack Query -> GET /api/jobs/:jobId
                         |
                         v
                 API job repository
                  local now, Redis later
```

This adapter boundary lets RoamAtlas scale when usage requires it without
paying Redis operational cost during local development and early validation.
