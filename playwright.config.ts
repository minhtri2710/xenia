import { defineConfig, devices } from "@playwright/test";

// The specs' SQL (`sql` in e2e/support.ts) reads DATABASE_URI; a value already in the shell wins.
process.loadEnvFile();

// 3417 is xenia's e2e port: 3000 is `pnpm dev`, 7784-7785 belong to other projects.
const PORT = 3417;
// `localhost`, not 127.0.0.1: Next builds `request.url` on `localhost`, so with
// `--hostname 127.0.0.1` next-intl's rewrites look cross-origin and loop.
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "e2e",
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  reporter: "list",
  use: { baseURL, navigationTimeout: 90_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec next dev --port ${PORT} --hostname localhost`,
    url: `${baseURL}/xac-minh-tuoi`,
    reuseExistingServer: false,
    timeout: 300_000,
  },
});
