"use server";

import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";

import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { checkQuote, QUOTE_PATH, type QuoteErrors, type QuoteFields } from "@/lib/quote";
import { saveQuote } from "@/lib/quote-data";

export type QuoteState = { errors: QuoteErrors; values: Omit<QuoteFields, "privacy"> };

const text = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/** Validates every field on the server, stores the request, then shows the confirmation. */
export async function sendQuote(_previous: QuoteState, formData: FormData): Promise<QuoteState> {
  const values = {
    company: text(formData, "company"),
    name: text(formData, "name"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    occasion: text(formData, "occasion"),
    quantity: text(formData, "quantity"),
    budget: text(formData, "budget"),
    message: text(formData, "message"),
  };
  const result = checkQuote({ ...values, privacy: formData.get("privacy") === "on" });
  if (!result.ok) return { errors: result.errors, values };
  await saveQuote(result.quote, new Date());
  const raw = text(formData, "locale");
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  redirect(getPathname({ href: `${QUOTE_PATH}?sent=1`, locale }));
}
