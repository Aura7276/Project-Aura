import { defineConfig, globalIgnores } from "eslint/config";
import next from "eslint-config-next/core-web-vitals";
import ts from "eslint-config-next/typescript";
export default defineConfig([
  ...next,
  ...ts,
  globalIgnores([
    "AURA_Requirements_v0.14/**",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
