/**
 * The database the e2e run uses: the path of `DATABASE_URI`, which `playwright.config.ts` loads
 * from `.env` unless the shell already sets it. Missing either fails the run.
 * This module imports nothing from Playwright, so vitest loads it too.
 */
export function databaseName(): string {
  const uri = process.env.DATABASE_URI;
  if (!uri) throw new Error("DATABASE_URI is not set");
  const name = decodeURIComponent(new URL(uri).pathname.slice(1));
  if (!name) throw new Error("DATABASE_URI names no database");
  return name;
}
