# Lint, format, types

`assets/tsconfig.base.json` and `assets/oxlint.config.ts` are the templates; this is why.

## tsconfig

Beyond `strict`: `noUncheckedIndexedAccess` (`rows[0]` is `T | undefined`, forcing the
decode at the edge), `exactOptionalPropertyTypes` (schema and TS agree on optionality),
`verbatimModuleSyntax` (type imports explicit), `erasableSyntaxOnly` (no enums/namespaces;
valid under type-stripping and tsgo), `noPropertyAccessFromIndexSignature` (loose env
access fails; env goes through Schema). `isolatedDeclarations` on for `packages/*` where
exported Effect signatures should be visible in review; off for `apps/*` where route
modules would pay in annotations for nothing. Generated binding types are included via
`types` so effect-cf's binding-name check works; `check` regenerates them before `tsc`.

## oxlint

Type-aware, three plugins, everything `error` or `off` (a `warn` is a rule nobody runs):

1. **anti-slop** (dmmulroy/anti-slop), vendored to `tools/oxlint/anti-slop` via
   `npx skills add dmmulroy/anti-slop --skill install-anti-slop`. Vendored because the
   oxlint JS-plugin API is alpha and pins exact versions; policy should not float. All
   fifteen rules on; the ones that catch agent output most: `no-unknown-parameters`,
   `no-unknown-returns`, `no-chained-type-assertions`, `no-widen-then-assert`,
   `require-safety-comment-for-type-assertion`, `no-module-mocking`.
2. **anti-slop-effect**: `no-service-constructor-imports`.
3. **Effect LSP rules** as type-aware oxlint rules (`@effect/language-service`; check
   the installed package for the plugin entry): leaked requirements, missing `yield*`.

Plus built-in `typescript`, `import`, `promise`, `unicorn`, `react` with `correctness`
and `suspicious` as errors. `oxfmt` with defaults.

## Scripts

```jsonc
"types": "wrangler types -c apps/web/wrangler.jsonc",
"check": "pnpm types && oxfmt --check . && tsc -b && oxlint --type-aware . && depcruise apps packages && vitest run",
"fix":   "oxfmt . && oxlint --type-aware --fix .",
"e2e":   "playwright test"
```

Sequential, cheapest first; each stage's failure makes the next meaningless. `tsc -b`
covers every workspace package so a contract change fails the extension's typecheck in
the same PR. Vite+ (`vp`) can front these without changing what the gate means.
