import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // OpenNext's Cloudflare build output and wrangler's own temp bundling
    // dir (see wrangler.jsonc) — generated, never edited by hand.
    ".open-next/**",
    ".wrangler/**",
  ]),
]);

export default eslintConfig;
