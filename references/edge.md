# The edge: React Router and the shared contract

Three kinds of client reach the same use cases: React Router loaders (in-process), the
browser/extension/mobile over HTTP, and realtime subscribers over WebSocket. One
contract package, two wire surfaces, no duplicate validation.

## React Router loaders as Effects

```ts
export default Worker.make(AppLive, {
  eventLayer: CloudflareTracer.layer,
  fetch: (request) => Effect.gen(function* () {
    if (new URL(request.url).pathname.startsWith("/api/")) return yield* apiHandler(request);
    const run = yield* makeRequestRuntime(request);        // scoped: DbLive + RequestInfo; disposed on exit
    return yield* Effect.promise(() => rrHandler(request, { run }));
  }).pipe(Effect.scoped),
});

declare module "react-router" { interface AppLoadContext { run: ManagedRuntime.ManagedRuntime<RequestServices, never> } }

export const loader = ({ params, context }: Route.LoaderArgs) =>
  context.run.runPromise(Effect.gen(function* () {
    const id = yield* Schema.decodeUnknown(UserId)(params.id);
    return yield* getUser(id);
  }).pipe(toResponse));
```

`toResponse` is the one place tagged errors become HTTP for pages; `catchTags` with every
`AppError` member, so a new variant fails typecheck here. The exact derivation of a
request-scoped `ManagedRuntime` from the entrypoint runtime is the one call to confirm
against the pinned effect-cf; the invariant is isolate-wide Layers once, request Layers
per request. SSR only: SPA mode and prerender are unsupported with the Cloudflare Vite
plugin. RR7 default; v8 wires the same way.

## packages/contract

```ts
export class Authorization extends HttpApiMiddleware.Tag<Authorization>()("Authorization", {
  provides: CurrentUser, failure: Unauthorized, security: { bearer: HttpApiSecurity.bearer },
}) {}
export const Users = HttpApiGroup.make("users")
  .add(HttpApiEndpoint.get("byId", "/users/:id").setPath(Schema.Struct({ id: UserId })).addSuccess(User).addError(UserNotFound))
  .middleware(Authorization);
export const Api = HttpApi.make("app").add(Users).prefix("/api");
export const makeApiClient = (baseUrl: string, token: () => Effect.Effect<string>) =>
  HttpApiClient.make(Api, { baseUrl, transformClient: withBearer(token) });

export class Realtime extends RpcGroup.make(
  Rpc.make("watchDocument", { payload: Schema.Struct({ id: DocumentId }), success: DocumentEvent, error: DocumentNotFound, stream: true }),
) {}
```

- **HttpApi** (`effect/http-api`; confirm the installed path) for every request/response
  surface: REST, OpenAPI at `/api/openapi.json` generated from the same value, typed
  `HttpApiClient` for TS clients, a path to Swift/Kotlin via `@effect/openapi-generator`
  if a native client ever appears.
- **`effect/rpc`** only for streams: served by `RpcServer` inside the realtime Durable
  Object over a hibernating WebSocket (`cloudflare.md`).
- Errors on the wire are the domain's `TaggedError`s, so a client's `catchTags` is as
  exhaustive as the server's once the contract bumps.
- Handlers in `apps/web/src/entry/api.ts` are one line each into a use case.
  `AuthorizationLive` is the only place the token format is known (Cloudflare Access JWT,
  session token or signed API key). CORS lists the extension's `chrome-extension://<id>`
  and the web origin, nothing wider.

Clients: the extension calls `makeApiClient` from its background worker with the token
in `chrome.storage.session`; React Native the same with secure storage - `fetch` and
`WebSocket` are native, so `packages/contract` stays `lib: ["ESNext"]`. The web app's
loaders keep the in-process path; its browser-side fetches use the client.

Versioning is additive: new endpoints, optional fields, new error variants. A breaking
change is a new group version served beside the old one until clients migrate.
