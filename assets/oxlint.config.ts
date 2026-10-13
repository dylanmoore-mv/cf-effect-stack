import { defineConfig } from "oxlint";

// Vendored policy rules: tools/oxlint/anti-slop (dmmulroy/anti-slop). Update by copying
// a newer src/ and reviewing the diff. The oxlint JS plugin API pins exact versions of
// oxlint and @oxlint/plugins; keep them in lockstep.
export default defineConfig({
  ignorePatterns: ["tools/oxlint/anti-slop/**", "**/build/**", "**/.react-router/**", "**/*.d.ts", "terraform/**"],
  jsPlugins: [
    { name: "anti-slop", specifier: "./tools/oxlint/anti-slop/index.ts" },
    { name: "anti-slop-effect", specifier: "./tools/oxlint/anti-slop/effect/index.ts" },
    // Effect LSP rules as type-aware oxlint rules: see @effect/language-service for the entry.
  ],
  plugins: ["typescript", "import", "promise", "unicorn", "react", "oxc"],
  categories: { correctness: "error", suspicious: "error", perf: "error" },
  rules: {
    "anti-slop/no-chained-type-assertions": "error",
    "anti-slop/no-conditional-empty-object-spread": "error",
    "anti-slop/no-known-value-widening": "error",
    "anti-slop/no-module-mocking": "error",
    "anti-slop/no-object-parameters": "error",
    "anti-slop/no-reflect-apply": "error",
    "anti-slop/no-reflect-get": "error",
    "anti-slop/no-runtime-typeof": "error",
    "anti-slop/no-shape-in-symbol-names": "error",
    "anti-slop/no-unknown-parameters": "error",
    "anti-slop/no-unknown-returns": "error",
    "anti-slop/no-unknown-type-aliases": "error",
    "anti-slop/no-unsafe-dictionary-type": "error",
    "anti-slop/no-widen-then-assert": "error",
    "anti-slop/require-safety-comment-for-type-assertion": "error",
    "anti-slop-effect/no-service-constructor-imports": "error",
    "typescript/no-explicit-any": "error",
    "typescript/consistent-type-imports": "error",
    "typescript/no-floating-promises": "error",
    "import/no-cycle": "error",
    "unicorn/no-null": "off",
  },
});
