# Agent notes

The gate is `pnpm check`; run it before reporting done. CI runs the same script.
`pnpm fix` formats and autofixes.

Layout: `packages/domain` (effect only), `packages/contract` (HttpApi + RPC definitions,
imports domain only), `packages/db` (Drizzle schema + migrations), `apps/web`
(React Router + Worker entry + adapters + wrangler.jsonc), `terraform/` (resources). Inside `apps/web/src`:
`application` → `ports` → `adapters/<tech>` → `entry`; imports point inward and
`.dependency-cruiser.cjs` enforces it.

Gates, not advice: `unknown`/`any`/casts fail lint; failures a caller handles are
`Schema.TaggedError` handled exhaustively, the rest are defects; `vi.mock` fails lint,
inject a Test Layer; the Postgres client is request-scoped; migrations are
expand/contract because PRs share the staging branch.

Structure must name the failure it prevents. A port with one implementation, a mapper
between identical shapes, an event with no consumer: leave them out.

Uncertain API? Read `node_modules/<pkg>`. The Effect family is pinned in the pnpm
catalog; bump it together.
