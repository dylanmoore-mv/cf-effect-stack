# Delivery: Terraform resources, wrangler deploys, tests, CI

## Who owns what

| Thing | Owner | Why |
| --- | --- | --- |
| PlanetScale database, `prod`/`staging` branches, roles; Hyperdrive configs; KV, R2, queues, DO namespaces, DNS, secrets stores | **Terraform** (`terraform/`, one workspace per env) | long-lived, shared, reviewed like any infra |
| The Worker script, its bindings by name, compat flags, preview versions | **wrangler** (`apps/web/wrangler.jsonc`, `env.staging` / `env.prod`) | `versions upload` gives PR previews Terraform cannot; `wrangler types` feeds effect-cf's binding check |
| Schema migrations | **CI** (`drizzle-kit migrate` over a direct connection secret) | runs before the Worker that needs it |

`wrangler.jsonc` references resource ids Terraform created; after `terraform apply` the
ids are committed (or templated from `terraform output -json` in CI - pick one and keep
it). Terraform does not manage the `cloudflare_workers_script` resource: two owners of
one Worker is the drift that costs the most. The dashboard is read-only.

## Environments

- **prod** and **staging**: a Terraform workspace each, a wrangler env each, a PlanetScale
  branch each, a Hyperdrive config each. `main` deploys staging, then prod; staging
  proves the migration first.
- **PR preview**: `wrangler versions upload --env staging --preview-alias pr-N`. A
  version of the staging Worker on its own URL, sharing staging's bindings and database.
  No teardown needed; versions are inert. Isolation is by data (e2e rows under a run id,
  `data.md`), which is enough for previews and costs nothing.
- **`db-branch` label** (opt-in, for a migration that cannot be expand/contract): CI
  creates a PlanetScale branch `pr-N` and a Hyperdrive config via `pscale`/`wrangler
  hyperdrive create`, templates the id into a `pr` wrangler env, migrates, uploads;
  `pr-closed` destroys both. Hyperdrive configs are capped per account (25 at last
  check), which is another reason this is the exception.
- **laptop**: `wrangler dev` with `CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE`
  pointing at PlanetScale's pooled endpoint for a dev branch, or a local container.

Secrets: Wrangler secrets per env for the Worker (`wrangler secret put --env`), Actions
secrets per GitHub environment (`preview`, `production`) for CI; the direct DB URL for
migrations lives only in the latter.

## Tests

| Level | Proves | Runner | Dependencies |
| --- | --- | --- | --- |
| Unit | use cases and domain logic, every tagged-error branch | `@effect/vitest` | Test Layers (`Layer.succeed(UserRepo, inMemory())`), `TestClock` |
| Integration | adapters against real bindings; contract handlers via `HttpApiClient` on an in-process `toWebHandler` | `@cloudflare/vitest-pool-workers` | emulated bindings from `wrangler.jsonc`; PGlite for plain-SQL adapters, a Postgres container for extension-dependent ones |
| e2e | build, deploy, bindings, auth, routing agree | Playwright + one `makeApiClient` spec per client | the preview URL; rows namespaced by run id and cleaned up |

`vi.mock` is a lint error: a Test Layer declares the dependency a mock would hide. Run
the port's contract tests against both its Live and Test Layers so they stay honest.
Keep e2e to the vertical slices; it proves what nothing lower can and nothing more.
Accept `@effect/vitest`'s Vitest 5 peer warning while the Cloudflare pool pins Vitest 4.

## CI, DRY

`assets/.github/`: one composite `setup` action; one reusable `ci.yml` taking `env` and
`preview`; `pr.yml` and `main.yml` call it. Jobs, each needing the last:
`check` (Postgres service container for integration) → `migrate` (`drizzle-kit migrate`
against the env's branch; skipped for previews, which run on staging's already-migrated
schema) → `deploy` (`wrangler versions upload` for previews, `wrangler deploy` for envs;
URL as output) → `e2e` (`BASE_URL` from deploy). Branch protection requires `check` and
`e2e`. Terraform has its own `infra.yml`: plan on PR, apply on main, path-filtered to
`terraform/`.

No matrix, no split lint/test jobs, no `continue-on-error`; secrets scoped per GitHub
environment. Caches: pnpm store and Playwright browsers. When CI fails on something
`check` passed locally the difference is the environment, and the fix goes in `setup`
or `ci.yml`, never a retry.
