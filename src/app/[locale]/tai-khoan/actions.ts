"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";

import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import {
  changePassword,
  currentCustomer,
  deleteAccount,
  registerCustomer,
  requestPasswordReset,
  resendVerification,
  resetPassword,
  signIn,
  signOut,
  updateProfile,
  verifyEmail,
} from "@/lib/account-data";
import {
  ACCOUNT_PATH,
  ACCOUNT_ROUTES,
  checkEmail,
  checkPassword,
  checkProfile,
  checkRegistration,
  type EmailError,
  type PasswordError,
  type ProfileErrors,
  type RegistrationErrors,
} from "@/lib/accounts";
import { MAX_NAME_LENGTH } from "@/lib/age";
import { AGE_COOKIE, EXIT_PATH } from "@/lib/gate";
import { safeReturnPath } from "@/lib/return-path";
import { clearCheckout } from "@/lib/shop-data";

const field = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

const localeOf = (formData: FormData) => {
  const value = field(formData, "locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
};

const go = (formData: FormData, href: string): never => redirect(getPathname({ href, locale: localeOf(formData) }));

// ── Registration ────────────────────────────────────────────────────────────────────────────

export type RegisterState = { errors: RegistrationErrors; values: { name: string; dob: string; email: string } };

/**
 * Registration (Decree 24/2020 Art. 6.1, as at checkout step 1). The date of birth is read only to
 * decide with `isAdult`: never stored, logged or put in a cookie, and not in the account. Under 18:
 * no account, the marker and checkout cookies go, and the visitor is sent to the exit page. The
 * answer is the same whether or not the email already has an account.
 */
export async function register(_previous: RegisterState, formData: FormData): Promise<RegisterState> {
  const values = { name: field(formData, "name"), dob: field(formData, "dob"), email: field(formData, "email") };
  const result = checkRegistration(
    { ...values, password: field(formData, "password"), terms: formData.get("terms") === "on", privacy: formData.get("privacy") === "on" },
    new Date(),
  );
  if (!result.ok && result.underage) {
    (await cookies()).delete(AGE_COOKIE);
    await clearCheckout();
    return go(formData, EXIT_PATH);
  }
  if (!result.ok) return { errors: result.errors, values };

  await registerCustomer({ email: result.email, password: result.password, name: result.name }, localeOf(formData));
  return go(formData, `${ACCOUNT_ROUTES.signIn}?notice=registered`);
}

// ── Sign-in, verification ───────────────────────────────────────────────────────────────────

export type SignInState = { failed: boolean; email: string };

/** One generic failure for an unknown email, a wrong password, an unverified or a locked account. */
export async function signInAction(_previous: SignInState, formData: FormData): Promise<SignInState> {
  const email = field(formData, "email");
  const ok = await signIn(email, field(formData, "password"));
  if (!ok) return { failed: true, email };
  const locale = localeOf(formData);
  return redirect(safeReturnPath(field(formData, "next"), getPathname({ href: ACCOUNT_PATH, locale })));
}

/** "Send the verification email again": the answer never depends on the email or the password. */
export async function resendAction(formData: FormData) {
  await resendVerification(field(formData, "email").trim().toLowerCase(), field(formData, "password"), localeOf(formData));
  return go(formData, `${ACCOUNT_ROUTES.signIn}?notice=resent`);
}

/** The verification link's page posts its token here; it works once. */
export async function verifyAction(formData: FormData) {
  const ok = await verifyEmail(field(formData, "token"));
  return go(formData, ok ? `${ACCOUNT_ROUTES.signIn}?notice=verified` : `${ACCOUNT_ROUTES.verify}?failed=1`);
}

// ── Reset ───────────────────────────────────────────────────────────────────────────────────

export type ForgotState = { error?: EmailError; email: string };

/** The reset request: a well-formed email always gets the same answer, known or not. */
export async function forgotAction(_previous: ForgotState, formData: FormData): Promise<ForgotState> {
  const email = field(formData, "email");
  const checked = checkEmail(email);
  if (!checked.ok) return { error: checked.error, email };
  await requestPasswordReset(checked.email, localeOf(formData));
  return go(formData, `${ACCOUNT_ROUTES.forgot}?sent=1`);
}

export type ResetState = { error?: PasswordError | "tokenInvalid" };

export async function resetAction(_previous: ResetState, formData: FormData): Promise<ResetState> {
  const password = field(formData, "password");
  const rule = checkPassword(password);
  if (rule) return { error: rule };
  const ok = await resetPassword(field(formData, "token"), password);
  if (!ok) return { error: "tokenInvalid" };
  return go(formData, `${ACCOUNT_ROUTES.signIn}?notice=reset`);
}

// ── The account page ────────────────────────────────────────────────────────────────────────

export type ProfileState = { errors: ProfileErrors; saved: boolean };

async function requireCustomer(formData: FormData) {
  const customer = await currentCustomer();
  return customer ?? go(formData, ACCOUNT_ROUTES.signIn);
}

export async function saveProfile(_previous: ProfileState, formData: FormData): Promise<ProfileState> {
  const customer = await requireCustomer(formData);
  const result = checkProfile({ name: field(formData, "name"), phone: field(formData, "phone"), address: field(formData, "address") }, MAX_NAME_LENGTH);
  if (!result.ok) return { errors: result.errors, saved: false };
  await updateProfile(customer, result.profile);
  return { errors: {}, saved: true };
}

export type PasswordState = { error?: PasswordError | "wrongPassword"; changed: boolean };

export async function changePasswordAction(_previous: PasswordState, formData: FormData): Promise<PasswordState> {
  const customer = await requireCustomer(formData);
  const next = field(formData, "newPassword");
  const rule = checkPassword(next);
  if (rule) return { error: rule, changed: false };
  const ok = await changePassword(customer, field(formData, "currentPassword"), next);
  return ok ? { changed: true } : { error: "wrongPassword", changed: false };
}

export async function signOutAction(formData: FormData) {
  await signOut();
  return go(formData, `${ACCOUNT_ROUTES.signIn}?notice=signedOut`);
}

export type DeleteState = { error?: "wrongPassword" };

export async function deleteAccountAction(_previous: DeleteState, formData: FormData): Promise<DeleteState> {
  const customer = await requireCustomer(formData);
  if (!(await deleteAccount(customer, field(formData, "password")))) return { error: "wrongPassword" };
  return go(formData, `${ACCOUNT_ROUTES.signIn}?notice=deleted`);
}
