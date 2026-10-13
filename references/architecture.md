# Architecture

## Workspace

```
apps/web          React Router + the Worker entrypoint + adapters (one deployable)
apps/extension    Chrome extension  } only when a second client exists; both import
apps/mobile       React Native      } packages/contract and nothing from apps/web
packages/domain   schemas, branded ids, tagged errors, pure functions. Imports effect only.
packages/contract HttpApi + RpcGroup definitions, client factories. Imports domain only.
packages/db       Drizzle schema + migrations
terraform/        long-lived resources per env (delivery.md); wrangler.jsonc lives in apps/web
tools/oxlint/anti-slop
```

Inside `apps/web/src`: `application/` (use cases), `ports/`, `adapters/<tech>/`, `entry/`.
Split `application`/`ports` into a package only when a second app needs to call use
cases in-process; until then the folder rule is enough and a package is ceremony.

## Hexagon in Effect, minimum viable

- **Port = `Context.Tag`** per external *technology the domain needs something from*
  (`UserRepo`, `SessionStore`, `EventBus`), not per entity and never split reader/writer.
  A port earns its place by having two Layers: Live and Test. If a thing has only ever
  one implementation and no test needs to replace it, call it directly.
- **Use case = `Effect.fn("name")`** yielding ports. A plain function; no command bus,
  no handler class. The name is the trace span.
- **Adapter = `Layer`** implementing a port. Decode rows to domain schemas at the
  adapter (`data.md`); that decode is the only "mapper" - no DTO layer when wire and
  domain shapes agree.
- **Entry** composes Layers once per isolate; request-scoped Layers per request
  (`cloudflare.md`).

```ts
export class UserRepo extends Context.Tag("UserRepo")<UserRepo, {
  readonly byId: (id: UserId) => Effect.Effect<Option.Option<User>, StoreError>;
  readonly save: (user: User) => Effect.Effect<void, StoreError>;
}>() {}

export const renameUser = Effect.fn("renameUser")(function* (id: UserId, name: UserName) {
  const repo = yield* UserRepo;
  const user = yield* repo.byId(id).pipe(Effect.flatMap(Option.match({ onNone: () => new UserNotFound({ id }), onSome: Effect.succeed })));
  yield* repo.save({ ...user, name });
});
```

## DDD, only the parts that are gates

- **Value objects as branded schemas.** `UserId = Schema.String.pipe(Schema.brand("UserId"))`,
  `Email`, `Money`. Cheap, and the compiler stops an `OrderId` reaching a user query.
  This is the highest-value DDD idea here; use it everywhere.
- **Aggregate = the unit whose invariants must hold across writes.** In this stack that
  is either one Postgres transaction or one Durable Object (single writer, linearizable;
  see `cloudflare.md`). Name the aggregate, put its invariant checks in `domain/` as pure
  functions, and let the adapter own the transaction. No aggregate base class.
- **Ubiquitous language** lives in schema and table names; a glossary document is
  ceremony if the names already say it.
- **Bounded contexts** are packages only when two vocabularies genuinely collide;
  otherwise folders. **Domain events** exist only when something consumes them
  (`cloudflare.md`, queues).

## Errors and open/closed

```ts
export class UserNotFound extends Schema.TaggedError<UserNotFound>()("UserNotFound", { id: UserId }) {}
```

Tag a failure when some caller handles it differently from the others (404 vs 500,
retry vs dead-letter). Infrastructure faults that nobody can act on are defects
(`Effect.die`), caught once at the entry and logged with the trace. Handle tagged
errors with `catchTags`/`Match.exhaustive` at the boundary that owns the response;
adding a variant then fails to compile until that boundary accounts for it. A
`default:` or `catchAll` that swallows new variants removes the gate.

## dependency-cruiser

`assets/.dependency-cruiser.cjs`: inward imports only, no cycles, `packages/domain` imports
`effect` only, `packages/contract` imports domain only, `apps/*` never import each other,
`adapters/<tech>` never import a sibling tech, only `entry/` and `adapters/` import
`effect-cf`. A new top-level folder is added to the rules in the same PR.
