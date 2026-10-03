/**
 * A corporate gift quote request from `/lien-he`: company, contact, occasion, quantity, an optional
 * budget per gift and a message, validated on the server. Stored in `quote-requests` (admin-only)
 * with the time the visitor accepted the privacy policy; never a date of birth.
 */
import { checkEmail } from "./accounts";
import { MAX_NAME_LENGTH } from "./age";
import { normalizePhone } from "./buyer";
import { PRICE_BANDS, type PriceBand } from "./catalogue";

export const QUOTE_SLUG = "quote-requests";
export const QUOTE_PATH = "/lien-he";

export const QUOTE_OCCASIONS = ["tet", "thanks", "event", "staff", "other"] as const;
export type QuoteOccasion = (typeof QUOTE_OCCASIONS)[number];

/** What the admin does with a request; the storefront always creates `new`. */
export const QUOTE_STATUSES = ["new", "contacted", "quoted", "closed"] as const;

export const MAX_COMPANY_LENGTH = 200;
export const MAX_QUANTITY = 100_000;
export const MAX_QUOTE_MESSAGE_CODE_POINTS = 1000;

export type Quote = {
  company: string;
  name: string;
  email: string;
  phone: string;
  occasion: QuoteOccasion;
  quantity: number;
  budget: PriceBand | null;
  message: string;
};

export type QuoteErrors = {
  company?: "companyRequired" | "companyTooLong";
  name?: "nameRequired" | "nameTooLong";
  email?: "emailRequired" | "emailInvalid";
  phone?: "phoneRequired" | "phoneInvalid";
  occasion?: "occasionRequired";
  quantity?: "quantityInvalid";
  budget?: "budgetInvalid";
  message?: "messageTooLong" | "messageControl";
  privacy?: "privacyRequired";
};

export type QuoteFields = Record<"company" | "name" | "email" | "phone" | "occasion" | "quantity" | "budget" | "message", string> & { privacy: boolean };

export type QuoteResult = { ok: true; quote: Quote } | { ok: false; errors: QuoteErrors };

/** Every field at once, so the form shows every problem in one round trip. */
export function checkQuote(fields: QuoteFields): QuoteResult {
  const errors: QuoteErrors = {};

  const company = fields.company.trim();
  if (!company) errors.company = "companyRequired";
  else if (company.length > MAX_COMPANY_LENGTH) errors.company = "companyTooLong";

  const name = fields.name.trim();
  if (!name) errors.name = "nameRequired";
  else if (name.length > MAX_NAME_LENGTH) errors.name = "nameTooLong";

  const checkedEmail = checkEmail(fields.email);
  if (!checkedEmail.ok) errors.email = checkedEmail.error;

  const phone = normalizePhone(fields.phone);
  if (!fields.phone.trim()) errors.phone = "phoneRequired";
  else if (!phone) errors.phone = "phoneInvalid";

  const occasion = QUOTE_OCCASIONS.find((o) => o === fields.occasion);
  if (!occasion) errors.occasion = "occasionRequired";

  const quantity = /^\d{1,6}$/.test(fields.quantity.trim()) ? Number(fields.quantity.trim()) : NaN;
  if (!(quantity >= 1 && quantity <= MAX_QUANTITY)) errors.quantity = "quantityInvalid";

  const budgetRaw = fields.budget.trim();
  const budget = budgetRaw === "" ? null : (PRICE_BANDS.find((b) => b.id === budgetRaw)?.id ?? undefined);
  if (budget === undefined) errors.budget = "budgetInvalid";

  const message = fields.message.replace(/\r\n?/g, "\n").normalize("NFC").trim();
  if (/[^\P{Cc}\n]/u.test(message)) errors.message = "messageControl";
  else if ([...message].length > MAX_QUOTE_MESSAGE_CODE_POINTS) errors.message = "messageTooLong";

  if (!fields.privacy) errors.privacy = "privacyRequired";

  if (!checkedEmail.ok || !phone || !occasion || budget === undefined || Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, quote: { company, name, email: checkedEmail.email, phone, occasion, quantity, budget, message } };
}
