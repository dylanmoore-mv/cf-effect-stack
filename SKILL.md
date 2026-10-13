---
name: cf-effect-stack
description: Build and maintain typed Cloudflare Workers apps on Effect 4 + effect-cf, React Router framework mode, Hyperdrive + Drizzle + Postgres (PlanetScale), Terraform-owned infra, a shared HttpApi/RPC contract for web, extension and mobile clients, ports-and-adapters held by dependency-cruiser, strict TypeScript, Oxlint with anti-slop, one `check` gate and a DRY GitHub Actions pipeline with e2e. Use whenever the user scaffolds a Workers project, adds a feature, route, port, adapter, binding, table, migration, queue, Durable Object or client to one, asks to "make this stricter", "add CI/e2e", "wire up Hyperdrive/Drizzle/DOs", reviews code against these conventions, or mentions Effect on Cloudflare, effect-cf, anti-slop, oxlint, hexagonal, DDD or React Router on Workers - even without naming the stack.
---

# cf-effect-stack

Agents drift from prose and cannot drift from a red `pnpm check`, so every convention
here is a **gate**: a type, a lint rule, a dependency-cruiser edge or a test. The
counter-rule is just as strong: **structure must name the failure it prevents.** A port
with one implementation, a mapper between identical shapes, a tagged error nobody handles
differently, an event with no consumer - each is ceremony, and the default is to leave
it out until the failure it would prevent shows up. When in doubt, the simpler shape wins
and the gate stays.

## Mode

| Situation | Branch |
| --- | --- |
| Empty repo, "scaffold", "start a project" | **Scaffold**: read every reference in the order listed, run the steps below |
| Existing repo, add a feature, route, binding, table, client | **Extend**: read `architecture.md` plus the one reference the change touches |
| "Make this stricter", "add lint/CI/tests", migrate onto the stack | **Enforce**: baseline `pnpm check` first, then install gates cheapest-first (`lint-and-types` → `architecture` → `delivery`), one rule per commit |
| "Review this" | **Enforce**, reporting instead of editing |

## Invariants

1. **One gate.** `pnpm check` = format, typecheck, lint, depcruise, unit + integration
   tests. CI runs the same script. Done means green.
2. **Decode once, at the edge.** `effect/schema` decodes env, requests, params, queue
   messages, DO RPC args and DB rows where they enter. Inside, values are typed;
   `unknown`/`any`/casts are lint errors.
3. **Inward imports.** `apps → adapters → application → domain`; `packages/contract`
   sees only `domain`. dependency-cruiser holds the edge.
4. **Failures a caller handles are tagged; the rest are defects.** `Schema.TaggedError`
   for the former, `Effect.die` for the latter. Exhaustive handling at the boundary that
   owns the response, so a new variant is a compile error there - that is open/closed.
5. **Pinned, same-version Effect.** `effect`, every `@effect/*` and `effect-cf`
   move together via the pnpm catalog. When an API is uncertain, read `node_modules`.

## Scaffold

1. Confirm in one message: app name; React Router 7 (v8 exists); first clients beyond
   the web app (extension / mobile / none). Proceed with defaults unless told.
2. `pnpm create cloudflare@latest apps/web --framework=react-router`, then the workspace
   layout from `architecture.md` and `assets/` copied into place.
3. One vertical slice end to end (route → use case → port → Drizzle adapter → migration
   → contract endpoint → tests at each level) so every gate bites.
4. `terraform apply` for staging, ids into `wrangler.jsonc`, then `pnpm check` green and
   the slice served by `wrangler dev`.

## References (read in this order for Scaffold)

- `references/architecture.md` - workspace, hexagon ↔ Effect, DDD where it pays, depcruise.
- `references/lint-and-types.md` - tsconfig, oxlint + anti-slop, the `check` script.
- `references/cloudflare.md` - effect-cf entrypoints; which primitive for which job
  and its consistency contract; DOs, queues, workflows, caching.
- `references/data.md` - Drizzle behind one `Db` service, Hyperdrive, migrations,
  shared staging branch.
- `references/edge.md` - React Router loaders as Effects; the shared HttpApi + RPC
  contract for extension and mobile.
- `references/delivery.md` - Terraform vs wrangler ownership, envs and PR previews,
  test pyramid, CI.
- `assets/` - config copied verbatim.
