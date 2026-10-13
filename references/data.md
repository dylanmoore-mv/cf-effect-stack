# Data: Hyperdrive + Drizzle + Postgres on PlanetScale

Drizzle owns schema and migrations; one `Db` service wraps it so the rest of the code
never sees a driver. `@effect/sql-pg` via effect-cf's Hyperdrive SQL layer is the
alternative and drops Drizzle; this stack keeps Drizzle for `drizzle-kit` migrations and
schema-inferred row types.

## The Db service

```ts
export class Db extends Context.Tag("Db")<Db, {
  readonly query: <A>(f: (d: Drizzle) => Promise<A>) => Effect.Effect<A, StoreError>;
  readonly transaction: <A, E>(f: (d: Drizzle) => Effect.Effect<A, E>) => Effect.Effect<A, E | StoreError>;
}>() {}

export const DbLive = Layer.scoped(Db, Effect.gen(function* () {
  const hd = yield* HyperdriveBinding;                      // effect-cf Hyperdrive Tag
  const sql = postgres(hd.connectionString, { max: 5, fetch_types: false, prepare: false });
  yield* Effect.addFinalizer(() => Effect.promise(() => sql.end({ timeout: 5 })));
  const d = drizzle(sql, { schema });
  return Db.of({ query: (f) => Effect.tryPromise({ try: () => f(d), catch: (cause) => new StoreError({ cause }) }), transaction: ... });
}));
```

`fetch_types: false`, `prepare: false` are what Hyperdrive wants from postgres.js;
`max: 5` stays under the per-invocation cap. The finalizer closes the client when the
request scope ends, so `DbLive` is a per-request Layer. A client cached across requests
is the bug this prevents. `transaction` is the aggregate boundary (`architecture.md`).

Rows decode to domain schemas at the adapter: `Schema.decodeUnknown(User)(row)`. It
looks redundant until a column drifts from the domain type and fails loudly in the
adapter instead of propagating.

## Migrations: expand/contract, forward-only

`drizzle-kit generate` from `packages/db/src/schema.ts`; commit the SQL. CI runs
`drizzle-kit migrate` against the env's branch before the Worker deploys (`delivery.md`),
so a Worker never runs ahead of its schema. Because PRs share a branch, every migration is **expand/contract**:
add the column or table (expand), deploy code that writes both, backfill, switch reads,
then drop the old shape in a later migration (contract). A migration that would break
the previous Worker version is the one case for an opt-in PR branch (`delivery.md`).
Rollback is a new migration.

## PlanetScale branches, honestly

PlanetScale Postgres branches are isolated deployments: billed per branch, minutes to
create, empty until migrated, and (per their docs) no schema copy yet. That is not a
fork. So: `prod` and `staging` are long-lived branches; every PR shares `staging`'s
branch; a PR gets its own branch only when labelled `db-branch`. Test isolation on the
shared branch comes from data, not infra: e2e runs create their own rows under a run id
and clean up after. Seed `staging` from committed fixtures or an anonymised snapshot in
R2, never a production backup. If per-PR forks ever become a real need, Neon's
copy-on-write branches are the tool built for it and the `Db` service does not change.
