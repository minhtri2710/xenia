import { expect, test } from "@playwright/test";

import config from "../src/payload.config";
import {
  ACCOUNT_COOKIE_NAME,
  ACCOUNT_PASSWORD,
  accountCookie,
  blockThirdParty,
  customerCount,
  declareAdult,
  expectNoSeriousA11yViolations,
  lastMail,
  mailCount,
  NEW_ACCOUNT_PASSWORD,
  newCustomerSession,
  register,
  seedCatalogue,
  signInAs,
  sql,
  verifyFromMail,
  vietnamDateYearsAgo,
} from "./support";

// F8. The account is optional and never widens what `/api` shows. These specs never truncate
// `customers` or `orders`: every email below is unique to its test.

const ADMIN_EMAIL = "admin-f8@xenia.test";
const ADMIN_PASSWORD = "e2e-dev-only-password";
const run = Date.now().toString(36);
const mailbox = (name: string) => `${name}.${run}@example.test`;

test.beforeAll(async ({ request }) => {
  await seedCatalogue(request);
});

// ── V1: the same rule on every collection and global, over HTTP ─────────────────────────────

type Row = { slug: string; op: string; customerCookie: number; customerJwt: number; admin: number };

const isOurs = (slug: string) => !slug.startsWith("payload-");
// The slugs are Payload's own configured ones, so a collection added later is in the table.
const collectionSlugs = async () => (await config).collections.map((c) => c.slug).filter(isOurs);
const globalSlugs = async () => (await config).globals.map((g) => g.slug);

test("V1: a customer's token, as a cookie or as a JWT header, gets nothing from /api; an admin's rules are unchanged", async ({ playwright, page }) => {
  test.setTimeout(600_000);
  const customerEmail = mailbox("v1");
  await newCustomerSession(page, "", customerEmail);
  // The customer's own JWT is what Payload would accept as `payload-token` or as `Authorization: JWT`.
  const token = (await accountCookie(page.context()))!.value;

  const anonymous = await playwright.request.newContext({ baseURL: "http://localhost:3417" });
  // The admin column needs a known admin, so V1 sets up its own like the checkout and admin specs: empty `users`
  // (its foreign keys reach only Payload's own session, preference and lock tables, never customers or orders),
  // first-register ADMIN_EMAIL, and fail, never skip, when either step is refused.
  sql("TRUNCATE users CASCADE");
  const created = await anonymous.post("/api/users/first-register", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, "confirm-password": ADMIN_PASSWORD } });
  expect(created.ok()).toBe(true);
  const login = await anonymous.post("/api/users/login", { data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD } });
  expect(login.ok()).toBe(true);
  const adminToken = (await login.json()).token as string;

  const cookieCtx = await playwright.request.newContext({ baseURL: "http://localhost:3417", extraHTTPHeaders: { cookie: `payload-token=${token}` } });
  const jwtCtx = await playwright.request.newContext({ baseURL: "http://localhost:3417", extraHTTPHeaders: { authorization: `JWT ${token}` } });
  const adminCtx = await playwright.request.newContext({ baseURL: "http://localhost:3417", extraHTTPHeaders: { authorization: `JWT ${adminToken}` } });

  const calls: { slug: string; op: string; method: "get" | "post" | "patch" | "delete"; path: string }[] = [];
  for (const slug of await collectionSlugs()) {
    calls.push({ slug, op: "find", method: "get", path: `/api/${slug}` });
    calls.push({ slug, op: "findByID", method: "get", path: `/api/${slug}/999999` });
    calls.push({ slug, op: "create", method: "post", path: `/api/${slug}` });
    calls.push({ slug, op: "update", method: "patch", path: `/api/${slug}/999999` });
    calls.push({ slug, op: "delete", method: "delete", path: `/api/${slug}/999999` });
    calls.push({ slug, op: "versions", method: "get", path: `/api/${slug}/versions` });
  }
  for (const slug of await globalSlugs()) {
    calls.push({ slug, op: "global read", method: "get", path: `/api/globals/${slug}` });
    calls.push({ slug, op: "global update", method: "post", path: `/api/globals/${slug}` });
  }

  const table: Row[] = [];
  for (const call of calls) {
    const status = async (ctx: typeof cookieCtx) => {
      const response = await ctx[call.method](call.path, call.method === "get" || call.method === "delete" ? {} : { data: {} });
      const body = await response.text();
      // Never any document data for a customer, whatever the status.
      if (ctx !== adminCtx) expect(body, `${call.method} ${call.path} body`).not.toMatch(/"docs":\s*\[\s*\{|"email":|"buyer":/);
      return response.status();
    };
    table.push({ slug: call.slug, op: call.op, customerCookie: await status(cookieCtx), customerJwt: await status(jwtCtx), admin: await status(adminCtx) });
  }
  console.log(`V1 table (customer cookie | customer JWT | admin)\n${table.map((r) => `${r.slug} ${r.op}: ${r.customerCookie} | ${r.customerJwt} | ${r.admin}`).join("\n")}`);

  for (const row of table) {
    // Refused by access (403), not merely by validation (400) or a missing document (404); `customers` has no REST surface (501).
    const refused = row.slug === "customers" ? 501 : 403;
    expect(row.customerCookie, `${row.slug} ${row.op} with the customer's cookie`).toBe(refused);
    expect(row.customerJwt, `${row.slug} ${row.op} with the customer's JWT header`).toBe(refused);
  }
  // Orders can be neither created nor deleted, even by an admin.
  const of = (slug: string, op: string) => table.find((r) => r.slug === slug && r.op === op)!;
  expect(of("orders", "create").admin).toBe(403);
  expect(of("orders", "delete").admin).toBe(403);
  // An admin still reads and lists the catalogue, orders and the outbox.
  for (const slug of ["producers", "wines", "vintages", "orders", "mock-outbox", "packaging", "card-designs", "checkout-drafts", "users"]) expect(of(slug, "find").admin, `${slug} find as admin`).toBe(200);
  expect(of("site-settings", "global read").admin).toBe(200);
  // `customers` has no REST or GraphQL surface at all.
  for (const row of table.filter((r) => r.slug === "customers")) expect(row.admin, `customers ${row.op} as admin`).toBeGreaterThanOrEqual(400);
  // The mock outbox is read-only for everyone.
  for (const op of ["create", "update", "delete"]) expect(of("mock-outbox", op).admin, `mock-outbox ${op} as admin`).toBeGreaterThanOrEqual(400);

  // A customer cannot use /admin.
  const adminPage = await page.context().newPage();
  await adminPage.context().addCookies([{ name: "payload-token", value: token, url: "http://localhost:3417" }]);
  await adminPage.goto("/admin");
  await expect(adminPage).toHaveURL(/\/admin\/(login|unauthorized)/);
  await adminPage.close();

  // And GraphQL: not for customers either.
  const graphql = await cookieCtx.post("/api/graphql", { data: { query: "{ Customers { docs { email } } }" } });
  expect(await graphql.text()).not.toContain(customerEmail);
  await Promise.all([anonymous, cookieCtx, jwtCtx, adminCtx].map((ctx) => ctx.dispose()));
});

// ── Registration, verification and sign-in ──────────────────────────────────────────────────

test("registration, verification and sign-in; the session is the account cookie, not payload-token", async ({ page, context }) => {
  const external = await blockThirdParty(page);
  const email = mailbox("flow");
  await declareAdult(page, "/tai-khoan/dang-ky");
  await expectNoSeriousA11yViolations(page, "register");
  await register(page, "", email);
  await expect(page).toHaveURL((url) => url.pathname === "/tai-khoan/dang-nhap" && url.searchParams.get("notice") === "registered");
  await expect(page.getByTestId("account-notice")).toBeVisible();

  const row = sql(`SELECT name || '|' || _verified::text FROM customers WHERE email = '${email}'`);
  expect(row).toBe("Nguyễn Văn An|false");
  // The date of birth is checked and never stored anywhere in the account row.
  expect(sql(`SELECT count(*) FROM information_schema.columns WHERE table_name = 'customers' AND column_name ~* '(dob|birth)'`)).toBe("0");
  expect(sql(`SELECT count(*) FROM customers WHERE row_to_json(customers)::text LIKE '%${vietnamDateYearsAgo(30)}%'`)).toBe("0");

  // Not verified: one generic failure, no session.
  await signInAs(page, "", email);
  await expect(page.getByTestId("sign-in-failed")).toBeVisible();
  expect(await accountCookie(context)).toBeUndefined();

  const mail = lastMail(email)!;
  expect(mail.subject).toBe("Xác minh email của bạn");
  expect(mail.href).toMatch(/^\/tai-khoan\/xac-minh\?token=/);
  // Opening the link alone uses nothing up; the token is spent by the button.
  await page.goto(mail.href);
  expect(sql(`SELECT _verified FROM customers WHERE email = '${email}'`)).toBe("f");
  await page.locator("form button[type=submit]").click();
  await expect(page.getByTestId("account-notice")).toHaveAttribute("data-notice", "verified");
  expect(sql(`SELECT _verified FROM customers WHERE email = '${email}'`)).toBe("t");
  // The token works once.
  await page.goto(mail.href);
  await page.locator("form button[type=submit]").click();
  await expect(page.getByTestId("verify-failed")).toBeVisible();

  await signInAs(page, "", email);
  await expect(page).toHaveURL((url) => url.pathname === "/tai-khoan");
  await expect(page.getByTestId("account-email")).toContainText(email);
  const cookie = (await accountCookie(context))!;
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: "Lax", path: "/" });
  expect((await context.cookies()).map((c) => c.name)).not.toContain("payload-token");
  await expect(page.getByTestId("header-account")).toHaveAttribute("href", "/tai-khoan");
  const robots = await page.locator('meta[name="robots"]').getAttribute("content");
  expect(robots).toContain("noindex");
  await expectNoSeriousA11yViolations(page, "account");
  expect(external).toEqual([]);
});

test("registration under 18 makes no account and no mail, clears the age marker and goes to the exit page", async ({ page, context }) => {
  const email = mailbox("minor");
  await declareAdult(page, "/tai-khoan/dang-ky");
  expect((await context.cookies()).some((c) => c.name === "xenia_age_ok")).toBe(true);
  await register(page, "", email, { dob: vietnamDateYearsAgo(17) });
  await expect(page).toHaveURL((url) => url.pathname === "/tam-biet");
  expect(customerCount(email)).toBe(0);
  expect(mailCount(email)).toBe(0);
  expect((await context.cookies()).some((c) => c.name === "xenia_age_ok")).toBe(false);
  await page.goto("/tai-khoan/dang-ky");
  await expect(page).toHaveURL((url) => url.pathname.endsWith("/xac-minh-tuoi"));
});

test("registration needs both consents unticked by default and asks for a long enough password", async ({ page }) => {
  await declareAdult(page, "/tai-khoan/dang-ky");
  await expect(page.locator("#register-terms")).not.toBeChecked();
  await expect(page.locator("#register-privacy")).not.toBeChecked();
  const email = mailbox("rules");
  await page.locator("#register-name").fill("An");
  await page.locator("#register-dob").fill(vietnamDateYearsAgo(30));
  await page.locator("#register-email").fill(email);
  await page.locator("#register-password").fill("a".repeat(14));
  await page.locator("form button[type=submit]").click();
  await expect(page.locator("#register-password-error")).toBeVisible();
  await expect(page.locator("#register-terms-error")).toBeVisible();
  await expect(page.locator("#register-privacy-error")).toBeVisible();
  expect(customerCount(email)).toBe(0);
});

test("registering an existing email answers exactly like a new one and sends a notice, not a second account", async ({ page, browser }) => {
  const email = mailbox("twice");
  await declareAdult(page, "/tai-khoan/dang-ky");
  await register(page, "", email);
  await expect(page).toHaveURL(/notice=registered/);
  const first = await page.getByTestId("account-notice").textContent();

  const other = await browser.newContext();
  const page2 = await other.newPage();
  await declareAdult(page2, "/tai-khoan/dang-ky");
  await register(page2, "", email);
  await expect(page2).toHaveURL(/notice=registered/);
  expect(await page2.getByTestId("account-notice").textContent()).toBe(first);
  expect(customerCount(email)).toBe(1);
  expect(mailCount(email)).toBe(2);
  expect(lastMail(email)!.subject).toBe("Bạn đã có tài khoản");
  await other.close();
});

test("the verification mail can be sent again with the email and password, and the answer never depends on them", async ({ page }) => {
  const email = mailbox("resend");
  await declareAdult(page, "/tai-khoan/dang-ky");
  await register(page, "", email);
  await expect(page).toHaveURL(/notice=registered/);
  const consentAt = () => sql(`SELECT consents_at FROM customers WHERE email = '${email}'`);
  const consentedAt = consentAt();
  expect(consentedAt).not.toBe("");
  await page.goto("/tai-khoan/dang-nhap");
  const before = mailCount(email);
  await page.locator("#resend-email").fill(email);
  await page.locator("#resend-password").fill(ACCOUNT_PASSWORD);
  await page.locator("#resend-email").locator("xpath=ancestor::form").locator("button[type=submit]").click();
  await expect(page.getByTestId("account-notice")).toHaveAttribute("data-notice", "resent");
  const known = await page.getByTestId("account-notice").textContent();
  expect(mailCount(email)).toBe(before + 1);
  // The replacement row keeps the consent record from registration: `consents.at` does not move to the resend.
  expect(consentAt()).toBe(consentedAt);
  // The new link verifies the account.
  await verifyFromMail(page, "", email);

  const unknown = mailbox("resend-nobody");
  await page.locator("#resend-email").fill(unknown);
  await page.locator("#resend-password").fill("whatever it is, wrong");
  await page.locator("#resend-email").locator("xpath=ancestor::form").locator("button[type=submit]").click();
  await expect(page.getByTestId("account-notice")).toHaveAttribute("data-notice", "resent");
  expect(await page.getByTestId("account-notice").textContent()).toBe(known);
  expect(mailCount(unknown)).toBe(0);
});

test("five wrong passwords lock the account: even the right password fails until the lock ends", async ({ page }) => {
  const email = mailbox("lock");
  await newCustomerSession(page, "", email);
  await page.context().clearCookies({ name: ACCOUNT_COOKIE_NAME });
  for (let i = 0; i < 5; i++) {
    await signInAs(page, "", email, "not the password at all");
    await expect(page.getByTestId("sign-in-failed")).toBeVisible();
  }
  await signInAs(page, "", email);
  await expect(page.getByTestId("sign-in-failed")).toBeVisible();
  expect(sql(`SELECT lock_until IS NOT NULL FROM customers WHERE email = '${email}'`)).toBe("t");
  sql(`UPDATE customers SET lock_until = now() - interval '1 minute', login_attempts = 0 WHERE email = '${email}'`);
  await signInAs(page, "", email);
  await expect(page).toHaveURL((url) => url.pathname === "/tai-khoan");
});

// ── Reset and password change ───────────────────────────────────────────────────────────────

test("a reset request answers the same for a known and an unknown email; the link works once, expires, and ends other sessions", async ({ page, browser }) => {
  const email = mailbox("reset");
  await newCustomerSession(page, "", email);
  const otherBrowser = await browser.newContext();
  const elsewhere = await otherBrowser.newPage();
  await declareAdult(elsewhere, "/tai-khoan");
  await signInAs(elsewhere, "", email);
  await expect(elsewhere).toHaveURL((url) => url.pathname === "/tai-khoan");

  const ask = async (address: string) => {
    await page.goto("/tai-khoan/quen-mat-khau");
    await page.locator("#forgot-email").fill(address);
    await page.locator("form button[type=submit]").click();
    await expect(page.getByTestId("forgot-sent")).toBeVisible();
    return { url: page.url(), text: await page.getByTestId("forgot-sent").textContent() };
  };
  const unknown = mailbox("reset-nobody");
  const forUnknown = await ask(unknown);
  const before = mailCount(email);
  const forKnown = await ask(email);
  expect(forKnown).toEqual(forUnknown);
  expect(mailCount(unknown)).toBe(0);
  expect(mailCount(email)).toBe(before + 1);

  const mail = lastMail(email)!;
  expect(mail.href).toMatch(/^\/tai-khoan\/dat-lai-mat-khau\?token=/);
  await page.goto(mail.href);
  expect(await page.locator('meta[name="referrer"]').getAttribute("content")).toBe("no-referrer");
  await page.locator("#reset-password").fill("short");
  await page.locator("form button[type=submit]").click();
  await expect(page.locator("#reset-password-error")).toBeVisible();
  await page.locator("#reset-password").fill(NEW_ACCOUNT_PASSWORD);
  await page.locator("form button[type=submit]").click();
  await expect(page.getByTestId("account-notice")).toHaveAttribute("data-notice", "reset");

  // Once: the same link no longer works.
  await page.goto(mail.href);
  await page.locator("#reset-password").fill("yet another long passphrase");
  await page.locator("form button[type=submit]").click();
  await expect(page.getByTestId("reset-invalid")).toBeVisible();

  // Other sessions ended by the reset.
  await elsewhere.goto("/tai-khoan");
  await expect(elsewhere).toHaveURL((url) => url.pathname === "/tai-khoan/dang-nhap");
  // Old password refused, new password accepted.
  await signInAs(page, "", email);
  await expect(page.getByTestId("sign-in-failed")).toBeVisible();
  await signInAs(page, "", email, NEW_ACCOUNT_PASSWORD);
  await expect(page).toHaveURL((url) => url.pathname === "/tai-khoan");
  await otherBrowser.close();

  // Expiry: a fresh link past its expiry fails.
  await ask(email);
  const expired = lastMail(email)!;
  sql(`UPDATE customers SET reset_password_expiration = now() - interval '1 minute' WHERE email = '${email}'`);
  await page.goto(expired.href);
  await page.locator("#reset-password").fill(ACCOUNT_PASSWORD);
  await page.locator("form button[type=submit]").click();
  await expect(page.getByTestId("reset-invalid")).toBeVisible();
});

test("changing the password ends the account's other sessions and keeps this one", async ({ page, browser }) => {
  const email = mailbox("change");
  await newCustomerSession(page, "", email);
  const other = await browser.newContext();
  const elsewhere = await other.newPage();
  await declareAdult(elsewhere, "/tai-khoan");
  await signInAs(elsewhere, "", email);
  await expect(elsewhere).toHaveURL((url) => url.pathname === "/tai-khoan");

  await page.locator("#password-current").fill("not the current one");
  await page.locator("#password-new").fill(NEW_ACCOUNT_PASSWORD);
  await page.locator("#password-new").locator("xpath=ancestor::form").locator("button[type=submit]").click();
  await expect(page.locator("#password-current-error")).toBeVisible();

  await page.locator("#password-current").fill(ACCOUNT_PASSWORD);
  await page.locator("#password-new").fill(NEW_ACCOUNT_PASSWORD);
  await page.locator("#password-new").locator("xpath=ancestor::form").locator("button[type=submit]").click();
  await expect(page.getByTestId("password-changed")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("account-email")).toBeVisible();
  await elsewhere.goto("/tai-khoan");
  await expect(elsewhere).toHaveURL((url) => url.pathname === "/tai-khoan/dang-nhap");
  await other.close();
});

// ── Sign-out, profile, deletion ─────────────────────────────────────────────────────────────

test("signing out ends the session on the server: the old cookie, replayed, is no session", async ({ page, browser }) => {
  const email = mailbox("out");
  await newCustomerSession(page, "", email);
  const old = (await accountCookie(page.context()))!;
  expect(Number(sql(`SELECT count(*) FROM customers_sessions WHERE _parent_id = (SELECT id FROM customers WHERE email = '${email}')`))).toBe(1);

  await page.getByRole("button", { name: /Đăng xuất/ }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/tai-khoan/dang-nhap");
  expect(await accountCookie(page.context())).toBeUndefined();
  expect(Number(sql(`SELECT count(*) FROM customers_sessions WHERE _parent_id = (SELECT id FROM customers WHERE email = '${email}')`))).toBe(0);
  await expect(page.getByTestId("header-account")).toHaveAttribute("href", "/tai-khoan/dang-nhap");

  const replay = await browser.newContext();
  await replay.addCookies([{ name: old.name, value: old.value, url: "http://localhost:3417" }, { name: "xenia_age_ok", value: (await page.context().cookies()).find((c) => c.name === "xenia_age_ok")!.value, url: "http://localhost:3417" }]);
  const replayed = await replay.newPage();
  await replayed.goto("/tai-khoan");
  await expect(replayed).toHaveURL((url) => url.pathname === "/tai-khoan/dang-nhap");
  await replay.close();
});

test("the profile is saved and the account is deleted with the password; the row goes", async ({ page }) => {
  const email = mailbox("profile");
  await newCustomerSession(page, "", email);
  await page.locator("#profile-phone").fill("090 123 4567");
  await page.locator("#profile-address").fill("12 Lê Lợi, Quận 1");
  await page.locator("#profile-phone").locator("xpath=ancestor::form").locator("button[type=submit]").click();
  await expect(page.getByTestId("profile-saved")).toBeVisible();
  expect(sql(`SELECT phone || '|' || address FROM customers WHERE email = '${email}'`)).toBe("0901234567|12 Lê Lợi, Quận 1");

  await page.locator("#delete-password").fill("wrong wrong wrong wrong");
  await page.locator("#delete-password").locator("xpath=ancestor::form").locator("button[type=submit]").click();
  await expect(page.locator("#delete-password-error")).toBeVisible();
  expect(customerCount(email)).toBe(1);

  await page.locator("#delete-password").fill(ACCOUNT_PASSWORD);
  await page.locator("#delete-password").locator("xpath=ancestor::form").locator("button[type=submit]").click();
  await expect(page.getByTestId("account-notice")).toHaveAttribute("data-notice", "deleted");
  expect(customerCount(email)).toBe(0);
  expect(await accountCookie(page.context())).toBeUndefined();
});

test("the English account pages and mail are in English and link to /en", async ({ page }) => {
  const email = mailbox("english");
  await declareAdult(page, "/en/tai-khoan/dang-ky");
  await register(page, "/en", email);
  await expect(page).toHaveURL((url) => url.pathname === "/en/tai-khoan/dang-nhap");
  const mail = lastMail(email)!;
  expect(mail.subject).toBe("Verify your email");
  expect(mail.href).toMatch(/^\/en\/tai-khoan\/xac-minh\?token=/);
  await verifyFromMail(page, "/en", email);
  await signInAs(page, "/en", email);
  await expect(page).toHaveURL((url) => url.pathname === "/en/tai-khoan");
  await expect(page.getByTestId("header-account")).toHaveAttribute("href", "/en/tai-khoan");
});
