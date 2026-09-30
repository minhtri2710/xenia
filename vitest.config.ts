import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  // The Payload config imports through `@/`, as the app does (tsconfig paths).
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts", "e2e/database.unit.ts"],
  },
});
