# Cloudflare through effect-cf

`effect-cf` (danieljvdm, the npm package) models each Cloudflare service as a Tag whose
Layer names its binding, checks that name against the generated env types, and puts the
Effect runtime boundary at the Worker and DO entrypoints. Its `docs/`, `examples/` and
`node_modules` types are the authority on signatures. (jbt95/effect-cf covers the same
primitives in an Effect 3 style; the where-to-use guidance below is identical.)

## Entrypoint

```ts
export default Worker.make(AppLive, {
  eventLayer: CloudflareTracer.layer,          // per invocation; captures async context
  fetch: (request) => handle(request),         // decode → use case → encode, nothing more
});
```

`AppLive` is built once per isolate; anything that captures a request (tracer, request
info, the DB client) goes in `eventLayer` or the per-request runtime (`edge.md`). The
classic bug is a tracer or DB client in the cached Layer. Background work goes through
`waitUntil` via effect-cf, never a dangling promise. Add `CloudflareTracer` on day one:
`Effect.fn` names become the trace vocabulary for free.

## Which primitive, and what it promises

The consistency column is the DDIA question to ask before picking one. Design to the
weakest guarantee a request crosses.

| Need | Primitive | Guarantee | Use it for | Avoid for |
| --- | --- | --- | --- | --- |
| Relational data, joins, transactions | Postgres via **Hyperdrive** | ACID at the origin; pooled at the edge | the system of record | hot per-request counters |
| Single-writer state, coordination, realtime | **Durable Object** | linearizable per object; one instance, in-memory + SQLite/KV storage | aggregates with cross-row invariants, locks, rate limits, WebSocket rooms, outbox | high-throughput fan-in to one object (it serializes) |
| Fire-and-forget work | **Queues** | at-least-once, retries, dead-letter | domain events with a consumer, email, webhooks | anything needing exactly-once without an idempotency key |
| Multi-step, long-running, retried processes | **Workflows** | durable execution; each step persisted and retried | sagas, onboarding, billing runs | request-latency paths |
| Read-mostly config and lookups | **KV** | eventually consistent (~60s), global, cheap reads | feature flags, session lookup, cached derived data | anything read right after write |
| Blobs | **R2** | strongly consistent objects, S3 API, presigned URLs | uploads, exports, snapshots | small hot rows |
| Edge HTTP caching | **Cache API** | per-colo, TTL | public GETs, computed pages | per-user responses |
| Embeddings | **Vectorize** | eventual index | semantic search | source of truth |
| Model calls | **AI Gateway** | caching, rate limits, logs over any provider | every LLM call | - |
| Metrics | **Analytics Engine** | sampled writes, SQL reads | product/usage counters | billing-grade counts |
| Cheap SQLite | **D1** | per-database ACID, regional | small isolated datasets | your main store when Postgres exists |

Each row is an adapter folder `adapters/<tech>/` with a Live Layer over the effect-cf
Tag; a port in front only when a use case needs it (`architecture.md`).

## Durable Objects

```ts
export class Counter extends DurableObject.Tag<Counter>()("Counter", {
  increment: DurableObject.method({ args: [Schema.Int], success: Schema.Int }),
}) {}
```

RPC args and results are schema-checked both ways; declared alarm handlers not
registered fail typecheck. A DO's methods are an entrypoint: decode, call the use case,
with its storage behind a Live Layer. Two patterns worth their structure:

- **Outbox via `DurableObjectAlarm.transaction`**: commit state and the alarm that will
  deliver its side effect together, so a restart cannot leave one without the other.
  At-least-once delivery; make the handler idempotent (same key, same content).
- **Hibernating WebSockets** (`DurableObjectWebSocket` / `DurableObjectRpcWebSocket`)
  for realtime, with session state schema-validated on restore and streams resumed from
  checkpoints the application provides.

## Queues and idempotency

Every consumer is at-least-once, so every message carries an idempotency key (the
aggregate id + event id) and the handler is safe to replay. Messages are schemas in
`packages/domain`; the Queue Tag checks them against the binding's declared body.
Dead-letter after N attempts to a queue someone watches.

## Local

`wrangler dev` runs the Worker under Miniflare with emulated KV/R2/D1/Queues/DOs and a
direct Postgres connection (`delivery.md`). `cf` is wrangler's beta successor; it does not change
anything above.
