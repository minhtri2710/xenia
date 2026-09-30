/**
 * The optional buyer account (F8): the enforced values, the pure validation and the routes.
 * Payload owns hashing, tokens, lockout and sessions; the values here are what it is configured
 * with (`src/collections/customers.ts`) and what the policy drafts state.
 */
import { checkDeclaration, type DeclarationError } from "./age";
import { MAX_ADDRESS_LENGTH, MAX_EMAIL_LENGTH, normalizePhone } from "./buyer";

/** The storefront's own session cookie: the customer's Payload token. Never Payload's `payload-token`. */
export const ACCOUNT_COOKIE = "xenia_account";

/** Password rule (NIST SP 800-63B-4, single-factor): length only, counted in code points, no composition rules. */
export const PASSWORD_MIN_CODE_POINTS = 15;
export const PASSWORD_MAX_CODE_POINTS = 128;

/** Failed sign-ins before Payload locks the account, and for how long. */
export const MAX_LOGIN_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;

/** How long a password reset link works (once). */
export const RESET_EXPIRY_MINUTES = 60;

/** How long a sign-in lasts on the server. */
export const SESSION_SECONDS = 2 * 60 * 60;

/** The mock outbox keeps a message this long; every send first deletes older ones. */
export const OUTBOX_TTL_HOURS = 24;

export const ACCOUNT_PATH = "/tai-khoan";
export const ACCOUNT_ROUTES = {
  register: "/tai-khoan/dang-ky",
  signIn: "/tai-khoan/dang-nhap",
  verify: "/tai-khoan/xac-minh",
  forgot: "/tai-khoan/quen-mat-khau",
  reset: "/tai-khoan/dat-lai-mat-khau",
} as const;

export const codePoints = (value: string) => [...value].length;

export type PasswordError = "passwordTooShort" | "passwordTooLong";

/** The password rule. The value is never trimmed or normalised: what is typed is what is hashed. */
export function checkPassword(password: string): PasswordError | null {
  const length = codePoints(password);
  if (length < PASSWORD_MIN_CODE_POINTS) return "passwordTooShort";
  if (length > PASSWORD_MAX_CODE_POINTS) return "passwordTooLong";
  return null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type EmailError = "emailRequired" | "emailInvalid";

export function checkEmail(value: string): { ok: true; email: string } | { ok: false; error: EmailError } {
  const email = value.trim().toLowerCase();
  if (!email) return { ok: false, error: "emailRequired" };
  if (email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) return { ok: false, error: "emailInvalid" };
  return { ok: true, email };
}

export type RegistrationFields = { email: string; password: string; name: string; dob: string; terms: boolean; privacy: boolean };

export type RegistrationErrors = DeclarationError & {
  email?: EmailError;
  password?: PasswordError;
  terms?: "consentRequired";
  privacy?: "consentRequired";
};

export type RegistrationResult =
  | { ok: true; email: string; name: string; password: string }
  | { ok: false; underage: true }
  | { ok: false; underage: false; errors: RegistrationErrors };

/**
 * Registration (Decree 24/2020 Art. 6.1, as at checkout step 1): the date of birth is only read to
 * decide with `checkDeclaration` / `isAdult`, and is never returned. A valid declaration under 18
 * is a refusal whatever else is wrong: no account.
 */
export function checkRegistration(fields: RegistrationFields, now: Date): RegistrationResult {
  const declaration = checkDeclaration(fields.name, fields.dob, now);
  if (declaration.ok && !declaration.adult) return { ok: false, underage: true };

  const errors: RegistrationErrors = declaration.ok ? {} : { ...declaration.errors };
  const email = checkEmail(fields.email);
  if (!email.ok) errors.email = email.error;
  const password = checkPassword(fields.password);
  if (password) errors.password = password;
  if (!fields.terms) errors.terms = "consentRequired";
  if (!fields.privacy) errors.privacy = "consentRequired";
  if (Object.keys(errors).length > 0 || !email.ok) return { ok: false, underage: false, errors };
  return { ok: true, email: email.email, name: fields.name.trim(), password: fields.password };
}

export type ProfileFields = { name: string; phone: string; address: string };

export type ProfileErrors = { name?: "nameTooLong"; phone?: "phoneInvalid"; address?: "addressTooLong" };

export type ProfileResult = { ok: true; profile: ProfileFields } | { ok: false; errors: ProfileErrors };

/** The profile is optional: an empty field is allowed, a filled one follows the buyer's contact rules. */
export function checkProfile(fields: ProfileFields, maxName: number): ProfileResult {
  const errors: ProfileErrors = {};
  const name = fields.name.trim();
  const address = fields.address.trim();
  const rawPhone = fields.phone.trim();
  const phone = rawPhone === "" ? "" : normalizePhone(rawPhone);
  if (name.length > maxName) errors.name = "nameTooLong";
  if (phone === null) errors.phone = "phoneInvalid";
  if (address.length > MAX_ADDRESS_LENGTH) errors.address = "addressTooLong";
  if (Object.keys(errors).length > 0 || phone === null) return { ok: false, errors };
  return { ok: true, profile: { name, phone, address } };
}
