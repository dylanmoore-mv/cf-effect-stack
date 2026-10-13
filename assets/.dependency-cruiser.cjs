/** Inward imports only: apps -> adapters -> application -> domain; contract sees only domain. */
module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
    { name: "domain-imports-effect-only", severity: "error",
      from: { path: "^packages/domain" }, to: { pathNot: ["^packages/domain", "^node_modules/effect(/|$)"] } },
    { name: "contract-imports-domain-only", severity: "error",
      from: { path: "^packages/contract" }, to: { pathNot: ["^packages/(contract|domain)", "^node_modules/effect(/|$)"] } },
    { name: "apps-do-not-import-each-other", severity: "error",
      from: { path: "^apps/([^/]+)/" }, to: { path: "^apps/", pathNot: "^apps/$1/" } },
    { name: "application-sees-no-adapters", severity: "error",
      from: { path: "^apps/web/src/(application|ports)" }, to: { path: ["^apps/web/src/(adapters|entry)", "^apps/web/app"] } },
    { name: "adapters-are-islands", severity: "error",
      from: { path: "^apps/web/src/adapters/([^/]+)/" }, to: { path: "^apps/web/src/adapters/", pathNot: "^apps/web/src/adapters/$1/" } },
    { name: "routes-see-no-adapters", severity: "error",
      from: { path: "^apps/web/app" }, to: { path: ["^apps/web/src/(adapters|entry)", "^node_modules/(effect-cf|drizzle-orm|postgres)"] } },
    { name: "only-entry-and-adapters-touch-effect-cf", severity: "error",
      from: { pathNot: ["^apps/web/src/(entry|adapters)"] }, to: { path: "^node_modules/effect-cf" } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: "tsconfig.json" },
    enhancedResolveOptions: { exportsFields: ["exports"], conditionNames: ["import", "default", "workerd"] },
  },
};
