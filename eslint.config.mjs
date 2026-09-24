import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".data/**",
    "next-env.d.ts",
    "playwright-report/**",
    "test-results/**",
    "src/app/(payload)/admin/importMap.js",
    "src/payload-types.ts",
  ]),
]);
