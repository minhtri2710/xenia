/**
 * The account, server side (F8): one path through Payload's Local API for every account action.
 * Payload owns the password hash, verification and reset tokens, lockout and sessions; nothing
 * here hashes, signs or stores a secret. The session is the customer's Payload token, kept in the
 * storefront's own `ACCOUNT_COOKIE`, never in Payload's `payload-token`.
 */
import config from "@payload-config";
import { cookies } from "next/headers";
import { commitTransaction, createLocalReq, getPayload, initTransaction, killTransaction, logoutOperation, UnverifiedEmail } from "payload";

import { accountMail, type MailLocale } from "@/lib/account-mail";
import { ACCOUNT_COOKIE } from "@/lib/accounts";
import { cookieOptions } from "@/lib/cookies";
import type { Customer, Order } from "@/payload-types";

const COOKIE_OPTIONS = cookieOptions(process.env.NODE_ENV === "production");

const CUSTOMERS = "customers";

/** A Local API request that carries the mail's locale to `generateEmailHTML` (src/collections/customers.ts). */
async function requestIn(locale: MailLocale) {
  return createLocalReq({ context: { accountLocale: locale } }, await getPayload({ config }));
}

/** The signed-in customer, or `null`. An admin token, an expired, revoked or unverified one, is `null`. */
export async function currentCustomer(): Promise<Customer | null> {
  const token = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  if (!token) return null;
  const payload = await getPayload({ config });
  const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) });
  return user && user.collection === CUSTOMERS ? (user as Customer) : null;
}

/** Signs in and sets the account cookie. Any failure (unknown, wrong password, unverified, locked) is `false`. */
export async function signIn(email: string, password: string): Promise<boolean> {
  const payload = await getPayload({ config });
  try {
    const { token } = await payload.login({ collection: CUSTOMERS, data: { email, password } });
    if (!token) return false;
    (await cookies()).set(ACCOUNT_COOKIE, token, COOKIE_OPTIONS);
    return true;
  } catch {
    return false;
  }
}

/** Ends every session of the customer on the server (Payload's own logout operation). */
async function endAllSessions(id: number) {
  const payload = await getPayload({ config });
  const req = await createLocalReq({ user: { id, collection: CUSTOMERS } as never }, payload);
  await logoutOperation({ allSessions: true, collection: payload.collections[CUSTOMERS], req });
}

/** Sign-out: the session ends on the server, then the cookie goes. */
export async function signOut() {
  const token = (await cookies()).get(ACCOUNT_COOKIE)?.value;
  if (token) {
    const payload = await getPayload({ config });
    const { user } = await payload.auth({ headers: new Headers({ Authorization: `JWT ${token}` }) });
    if (user && user.collection === CUSTOMERS) {
      const req = await createLocalReq({ user: user as never }, payload);
      await logoutOperation({ collection: payload.collections[CUSTOMERS], req });
    }
  }
  (await cookies()).delete(ACCOUNT_COOKIE);
}

const findByEmail = async (email: string) => {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({ collection: CUSTOMERS, where: { email: { equals: email } }, depth: 0, limit: 1 });
  return docs[0] ?? null;
};

const consentsNow = () => ({ terms: true, privacy: true, at: new Date().toISOString() });

/**
 * Registration for an email that passed `checkRegistration`. A new email gets an unverified
 * account and Payload's verification mail; an email that already has an account gets a notice
 * mail instead. The caller answers the same either way.
 */
export async function registerCustomer({ email, password, name }: { email: string; password: string; name: string }, locale: MailLocale) {
  const payload = await getPayload({ config });
  const notify = async () => {
    const mail = accountMail("exists", locale);
    await payload.sendEmail({ to: email, subject: mail.subject, html: mail.html });
  };
  if (await findByEmail(email)) return notify();
  try {
    await payload.create({ collection: CUSTOMERS, data: { email, password, name, consents: consentsNow() }, req: await requestIn(locale) });
  } catch (error) {
    // A concurrent registration of the same email won the unique index: it is an existing account now.
    if (await findByEmail(email)) return notify();
    throw error;
  }
}

/**
 * "Send the verification email again" for an unverified account: Payload creates a verification
 * token only when it creates the row and has no way to issue another. So the pending, unverified
 * account is replaced in one transaction by a fresh one with the same email, password, name and consents
 * (which Payload verifies first, by attempting the sign-in it refuses as unverified), and the old
 * link stops working. Anything else (unknown email, wrong password, already verified) does nothing.
 */
export async function resendVerification(email: string, password: string, locale: MailLocale) {
  const payload = await getPayload({ config });
  const pending = await findByEmail(email);
  if (!pending || pending._verified) return;
  try {
    await payload.login({ collection: CUSTOMERS, data: { email, password } });
    return; // signed in: it was verified after all
  } catch (error) {
    if (!(error instanceof UnverifiedEmail)) return;
  }
  const req = await requestIn(locale);
  await initTransaction(req);
  try {
    await payload.delete({ collection: CUSTOMERS, id: pending.id, req });
    // The consent record stays as registration wrote it: `consents.at` is when the person consented, not when they asked again.
    await payload.create({ collection: CUSTOMERS, data: { email, password, name: pending.name ?? undefined, consents: pending.consents }, req });
    await commitTransaction(req);
  } catch (error) {
    await killTransaction(req);
    throw error;
  }
}

/** Verifies the emailed token (Payload consumes it: it works once). */
export async function verifyEmail(token: string): Promise<boolean> {
  const payload = await getPayload({ config });
  try {
    return await payload.verifyEmail({ collection: CUSTOMERS, token });
  } catch {
    return false;
  }
}

/** The reset request. Unknown and known emails are indistinguishable to the caller, whatever the mail does. */
export async function requestPasswordReset(email: string, locale: MailLocale) {
  const payload = await getPayload({ config });
  try {
    await payload.forgotPassword({ collection: CUSTOMERS, data: { email }, req: await requestIn(locale) });
  } catch {
    payload.logger.error("account: a password reset request failed");
  }
}

/** Sets the new password with the emailed token (it expires and works once), then ends every session. */
export async function resetPassword(token: string, password: string): Promise<boolean> {
  const payload = await getPayload({ config });
  try {
    const { user } = await payload.resetPassword({ collection: CUSTOMERS, data: { token, password }, overrideAccess: true });
    if (typeof user?.id === "number") await endAllSessions(user.id);
    return true;
  } catch {
    return false;
  }
}

/** Whether `password` is the customer's current one (a sign-in that is thrown away; failures count towards the lockout). */
async function passwordMatches(customer: Customer, password: string): Promise<boolean> {
  const payload = await getPayload({ config });
  try {
    await payload.login({ collection: CUSTOMERS, data: { email: customer.email, password } });
    return true;
  } catch {
    return false;
  }
}

export async function updateProfile(customer: Customer, profile: { name: string; phone: string; address: string }) {
  const payload = await getPayload({ config });
  await payload.update({ collection: CUSTOMERS, id: customer.id, data: profile });
}

/** A password change ends every session, this one included, and signs in again with the new password. */
export async function changePassword(customer: Customer, current: string, next: string): Promise<boolean> {
  if (!(await passwordMatches(customer, current))) return false;
  const payload = await getPayload({ config });
  await payload.update({ collection: CUSTOMERS, id: customer.id, data: { password: next } });
  await endAllSessions(customer.id);
  return signIn(customer.email, next);
}

/** Deletes the account (the orders stay and lose the link in the database). */
export async function deleteAccount(customer: Customer, password: string): Promise<boolean> {
  if (!(await passwordMatches(customer, password))) return false;
  const payload = await getPayload({ config });
  await payload.delete({ collection: CUSTOMERS, id: customer.id });
  (await cookies()).delete(ACCOUNT_COOKIE);
  return true;
}

/** The account's own orders, newest first. */
export async function loadOrdersOf(customer: Customer): Promise<Order[]> {
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "orders",
    where: { customer: { equals: customer.id } },
    sort: "-createdAt",
    depth: 0,
    pagination: false,
  });
  return docs;
}
