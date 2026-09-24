/**
 * Checkout step 1 (Decree 24/2020 Art. 6.1): the buyer's full name, date of birth, phone, email
 * and residential address, validated on the server. The date of birth is only read to re-check
 * age with `isAdult`; it is never returned, stored, logged or put in a cookie.
 */
import { checkDeclaration, MAX_NAME_LENGTH } from "./age";

export const MAX_EMAIL_LENGTH = 254;
export const MAX_ADDRESS_LENGTH = 500;

export type Buyer = { name: string; phone: string; email: string; address: string };

export type BuyerErrors = {
  name?: "nameRequired" | "nameTooLong";
  dob?: "dobRequired" | "dobInvalid" | "dobFuture";
  phone?: "phoneRequired" | "phoneInvalid";
  email?: "emailRequired" | "emailInvalid";
  address?: "addressRequired" | "addressTooLong";
};

export type Recipient = { name: string; phone: string; address: string };

export type RecipientErrors = Pick<BuyerErrors, "name" | "phone" | "address">;

type RecipientResult = { ok: true; recipient: Recipient } | { ok: false; errors: RecipientErrors };

type ContactResult = { ok: true; buyer: Buyer } | { ok: false; errors: BuyerErrors };

export type BuyerResult = { ok: true; buyer: Buyer; adult: boolean } | { ok: false; errors: BuyerErrors };

/** A Vietnamese phone number, `0` or `+84` then nine digits; spaces, dots and hyphens are ignored. */
export function normalizePhone(value: string): string | null {
  const compact = value.replace(/[\s.-]/g, "");
  const match = /^(?:0|\+84)([1-9]\d{8})$/.exec(compact);
  return match ? `0${match[1]}` : null;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The contact fields a buyer and a gift recipient share: name, phone and address. */
function checkNamePhoneAddress(fields: Omit<Buyer, "email">) {
  const errors: RecipientErrors = {};
  const name = fields.name.trim();
  const phone = normalizePhone(fields.phone);
  const address = fields.address.trim();
  if (!name) errors.name = "nameRequired";
  else if (name.length > MAX_NAME_LENGTH) errors.name = "nameTooLong";
  if (!fields.phone.trim()) errors.phone = "phoneRequired";
  else if (!phone) errors.phone = "phoneInvalid";
  if (!address) errors.address = "addressRequired";
  else if (address.length > MAX_ADDRESS_LENGTH) errors.address = "addressTooLong";
  return { errors, name, phone, address };
}

/** Name, phone, email and address. Used at step 1 and again when the order is placed. */
export function checkContact(fields: Buyer): ContactResult {
  const { errors: shared, name, phone, address } = checkNamePhoneAddress(fields);
  const errors: BuyerErrors = { ...shared };
  const email = fields.email.trim();
  if (!email) errors.email = "emailRequired";
  else if (email.length > MAX_EMAIL_LENGTH || !EMAIL.test(email)) errors.email = "emailInvalid";

  if (Object.keys(errors).length > 0 || !phone) return { ok: false, errors };
  return { ok: true, buyer: { name, phone, email, address } };
}

/** A gift recipient (step 2, gift mode): name, phone and address under the buyer's rules. */
export function checkRecipient(fields: Recipient): RecipientResult {
  const { errors, name, phone, address } = checkNamePhoneAddress(fields);
  if (Object.keys(errors).length > 0 || !phone) return { ok: false, errors };
  return { ok: true, recipient: { name, phone, address } };
}

/** Step 1: every field, plus the age re-check on the Asia/Ho_Chi_Minh calendar date at `now`. */
export function checkBuyer(fields: Buyer & { dob: string }, now: Date): BuyerResult {
  const contact = checkContact(fields);
  const declaration = checkDeclaration(fields.name, fields.dob, now);
  if (!contact.ok || !declaration.ok) {
    const errors: BuyerErrors = contact.ok ? {} : { ...contact.errors };
    if (!declaration.ok && declaration.errors.dob) errors.dob = declaration.errors.dob;
    return { ok: false, errors };
  }
  return { ok: true, buyer: contact.buyer, adult: declaration.adult };
}
