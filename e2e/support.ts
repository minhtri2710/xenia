import { execFileSync } from "node:child_process";

import { type APIRequestContext, expect, type Page } from "@playwright/test";

const isLocal = (url: URL) => url.hostname === "localhost" || url.hostname === "127.0.0.1";

/**
 * Records every http(s) request and ws(s) connection to a non-localhost origin and aborts it,
 * so nothing leaves the host. The caller asserts the returned list is empty.
 */
export async function blockThirdParty(page: Page): Promise<string[]> {
  const external: string[] = [];
  await page.route(
    (url) => url.protocol.startsWith("http") && !isLocal(url),
    (route) => {
      external.push(route.request().url());
      return route.abort();
    },
  );
  await page.routeWebSocket(
    (url) => !isLocal(url),
    (ws) => {
      external.push(ws.url());
      return ws.close();
    },
  );
  return external;
}

/**
 * Replaces the catalogue with the fixed seed (`pnpm seed`). The dev server pushes Payload's
 * schema on its first request, so hit it first; the seed then finds the tables in place.
 */
export async function seedCatalogue(request: APIRequestContext) {
  expect((await request.get("/api/users/init")).ok()).toBe(true);
  execFileSync("pnpm", ["-s", "seed"], { stdio: "inherit" });
}

/** An ISO date `yearsAgo` years before today's Vietnamese calendar date. */
export function vietnamDateYearsAgo(yearsAgo: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const [year, month, day] = today.split("-");
  // 28 February stands in for a 29 February that may not exist in the target year.
  return `${Number(year) - yearsAgo}-${month}-${month === "02" && day === "29" ? "28" : day}`;
}
