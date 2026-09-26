import { execFileSync } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, expect, type Page } from "@playwright/test";

import { databaseName } from "./database";

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

/** Runs one SQL statement in the e2e database and returns its unaligned, tuples-only output. */
export function sql(query: string): string {
  return execFileSync("docker", ["exec", "xenia-dev-postgres", "psql", "-U", "xenia", "-d", databaseName(), "-tAc", query], { encoding: "utf8" }).trim();
}

/**
 * Replaces the catalogue with the fixed seed (`pnpm seed`). The dev server pushes Payload's
 * schema on its first request, so hit it first; the seed then finds the tables in place.
 */
export async function seedCatalogue(request: APIRequestContext) {
  expect((await request.get("/api/users/init")).ok()).toBe(true);
  execFileSync("pnpm", ["seed"], { stdio: "inherit" });
}

/** An ISO date `yearsAgo` years before today's Vietnamese calendar date. */
export function vietnamDateYearsAgo(yearsAgo: number): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
  const [year, month, day] = today.split("-");
  // 28 February stands in for a 29 February that may not exist in the target year.
  return `${Number(year) - yearsAgo}-${month}-${month === "02" && day === "29" ? "28" : day}`;
}

/**
 * Runs axe (WCAG 2.1 A and AA) and fails on serious or critical violations. Waits first for the
 * document title: after a soft navigation React commits the new page and removes the old <title>
 * in one step, and Next's streamed metadata inserts the new one a few milliseconds later.
 */
export async function expectNoSeriousA11yViolations(page: Page, label?: string) {
  await expect(page).toHaveTitle(/\S/);
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(blocking.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`), label).toEqual([]);
  await expectNoHorizontalOverflow(page, label);
}

export async function expectNoHorizontalOverflow(page: Page, label?: string) {
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("A viewport is required for the responsive check.");
  await page.setViewportSize({ width: 360, height: viewport.height });
  const { viewportWidth, documentWidth, bodyWidth, overflowing } = await page.evaluate(() => ({
    viewportWidth: document.documentElement.clientWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    overflowing: [...document.querySelectorAll("body *")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return rect.right > document.documentElement.clientWidth + 1 || rect.left < -1;
      })
      .slice(0, 8)
      .map((element) => ({ tag: element.tagName, id: element.id, className: typeof element.className === "string" ? element.className : "", text: element.textContent?.trim().slice(0, 50) })),
  }));
  expect({ documentWidth, bodyWidth }, `${label ?? "page"}: ${JSON.stringify({ viewportWidth, overflowing })}`).toEqual({ documentWidth: viewportWidth, bodyWidth: viewportWidth });
  await page.setViewportSize(viewport);
}

export const POLICY_ROUTES = [
  { slug: "thong-tin-doanh-nghiep", path: "/chinh-sach/thong-tin-doanh-nghiep" },
  { slug: "bao-mat", path: "/chinh-sach/bao-mat" },
  { slug: "dieu-khoan", path: "/chinh-sach/dieu-khoan" },
  { slug: "khieu-nai", path: "/chinh-sach/khieu-nai" },
  { slug: "gia", path: "/chinh-sach/gia" },
  { slug: "dieu-kien-ban-hang", path: "/chinh-sach/dieu-kien-ban-hang" },
  { slug: "thanh-toan", path: "/chinh-sach/thanh-toan" },
  { slug: "giao-hang", path: "/chinh-sach/giao-hang" },
  { slug: "doi-tra-hoan-tien", path: "/chinh-sach/doi-tra-hoan-tien" },
] as const;
