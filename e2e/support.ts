import { execFileSync, spawn, type ChildProcess } from "node:child_process";

import AxeBuilder from "@axe-core/playwright";
import { type APIRequestContext, type BrowserContext, expect, type Page } from "@playwright/test";

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

export function spawnPsqlTransaction(statement: string, applicationName: string): { child: ChildProcess; exited: Promise<{ code: number | null; signal: NodeJS.Signals | null; error?: Error }> } {
  const child = spawn("docker", [
    "exec", "xenia-dev-postgres", "psql", "-X", "-qAt", "-U", "xenia", "-d", databaseName(),
    "-v", "ON_ERROR_STOP=1", "-c", `SET application_name = '${applicationName}'; ${statement}`,
  ], { stdio: "ignore" });
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null; error?: Error }>((resolve) => {
    child.once("error", (error) => resolve({ code: null, signal: null, error }));
    child.once("exit", (code, signal) => resolve({ code, signal }));
  });
  return { child, exited };
}

/** The hand-independent vintage → localized wine title oracle for an admin list locale. */
export function vintageWineNames(locale: "vi" | "en"): Map<number, string> {
  const rows = sql(
    `SELECT v.id::text || E'\\t' || wl.name FROM vintages v JOIN wines_locales wl ON wl._parent_id = v.wine_id WHERE wl._locale = '${locale}' ORDER BY v.id`,
  );
  return new Map(
    rows.split("\n").filter(Boolean).map((row) => {
      const separator = row.indexOf("\t");
      return [Number(row.slice(0, separator)), row.slice(separator + 1)];
    }),
  );
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

/** Opens `path` through the gate: redirect, adult declaration, return to `next`. */
export async function declareAdult(page: Page, path: string) {
  await page.goto(path);
  await expect(page).toHaveURL((url) => url.pathname.endsWith("/xac-minh-tuoi"));
  await page.locator("#gate-name").fill("Nguyễn Văn An");
  await page.locator("#gate-dob").fill(vietnamDateYearsAgo(30));
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname === new URL(path, "http://x").pathname);
}

/** The account passwords the specs use: 15 to 128 characters. */
export const ACCOUNT_PASSWORD = "correct horse battery staple";
export const NEW_ACCOUNT_PASSWORD = "another long passphrase here";

/** The newest mock-outbox message to `email`: its subject, body and the first link in it. */
export function lastMail(email: string): { subject: string; body: string; href: string; token: string } | null {
  const row = sql(`SELECT subject || E'\\x1f' || body FROM mock_outbox WHERE "to" = '${email}' ORDER BY id DESC LIMIT 1`);
  if (!row) return null;
  const [subject, body] = row.split("\x1f");
  const href = /href="([^"]+)"/.exec(body)?.[1] ?? "";
  return { subject, body, href, token: new URL(href, "http://x").searchParams.get("token") ?? "" };
}

/** Whether any mock-outbox message to `email` holds the date of birth, in the ISO form the form takes or as day/month/year. */
export function outboxHoldsDateOfBirth(email: string, dob: string): boolean {
  const [year, month, day] = dob.split("-");
  const holds = [dob, `${day}/${month}/${year}`].map((form) => `position('${form}' in subject || ' ' || body) > 0`).join(" OR ");
  return sql(`SELECT count(*) FROM mock_outbox WHERE "to" = '${email}' AND (${holds})`) !== "0";
}

export const mailCount = (email: string) => Number(sql(`SELECT count(*) FROM mock_outbox WHERE "to" = '${email}'`));
export const customerCount = (email: string) => Number(sql(`SELECT count(*) FROM customers WHERE email = '${email}'`));

/** Fills and submits the registration form (the visitor is already through the gate). */
export async function register(page: Page, prefix: string, email: string, { dob = vietnamDateYearsAgo(30), password = ACCOUNT_PASSWORD, name = "Nguyễn Văn An" } = {}) {
  await page.goto(`${prefix}/tai-khoan/dang-ky`);
  await page.locator("#register-name").fill(name);
  await page.locator("#register-dob").fill(dob);
  await page.locator("#register-email").fill(email);
  await page.locator("#register-password").fill(password);
  await page.locator("#register-terms").check();
  await page.locator("#register-privacy").check();
  await page.locator("form button[type=submit]").click();
}

/** Opens the verification link from the outbox and confirms it. */
export async function verifyFromMail(page: Page, prefix: string, email: string) {
  const mail = lastMail(email);
  expect(mail, `a verification mail to ${email}`).not.toBeNull();
  await page.goto(mail!.href);
  await page.locator("form button[type=submit]").click();
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/tai-khoan/dang-nhap`);
}

export async function signInAs(page: Page, prefix: string, email: string, password = ACCOUNT_PASSWORD, next = "") {
  await page.goto(`${prefix}/tai-khoan/dang-nhap${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  await page.locator("#sign-in-email").fill(email);
  await page.locator("#sign-in-password").fill(password);
  await page.locator("form button[type=submit]").first().click();
}

/** A verified, signed-in customer in a gated visitor's browser. */
export async function newCustomerSession(page: Page, prefix: string, email: string) {
  await declareAdult(page, `${prefix}/tai-khoan/dang-ky`);
  await register(page, prefix, email);
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/tai-khoan/dang-nhap`);
  await verifyFromMail(page, prefix, email);
  await signInAs(page, prefix, email);
  await expect(page).toHaveURL((url) => url.pathname === `${prefix}/tai-khoan`);
}

export const ACCOUNT_COOKIE_NAME = "xenia_account";

export async function accountCookie(context: BrowserContext) {
  return (await context.cookies()).find((cookie) => cookie.name === ACCOUNT_COOKIE_NAME);
}
