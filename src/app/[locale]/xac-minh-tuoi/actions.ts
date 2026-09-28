"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";

import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { checkDeclaration, type DeclarationError } from "@/lib/age";
import { cookieOptions } from "@/lib/cookies";
import { AGE_COOKIE, AGE_COOKIE_VALUE, EXIT_PATH } from "@/lib/gate";
import { safeReturnPath } from "@/lib/return-path";

export type GateState = { errors: DeclarationError; name: string; dob: string };

const field = (formData: FormData, key: string) => {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
};

/**
 * Validates the declaration on the server. The name and date of birth are only
 * read here to decide; they are never stored, logged or put in a cookie.
 */
export async function declareAge(_previous: GateState, formData: FormData): Promise<GateState> {
  const name = field(formData, "name");
  const dob = field(formData, "dob");
  const requestedLocale = field(formData, "locale");
  const locale = hasLocale(routing.locales, requestedLocale) ? requestedLocale : routing.defaultLocale;

  const result = checkDeclaration(name, dob, new Date());
  if (!result.ok) return { errors: result.errors, name, dob };

  const cookieStore = await cookies();
  if (!result.adult) {
    cookieStore.delete(AGE_COOKIE);
    redirect(getPathname({ href: EXIT_PATH, locale }));
  }

  cookieStore.set(AGE_COOKIE, AGE_COOKIE_VALUE, cookieOptions(process.env.NODE_ENV === "production"));
  redirect(safeReturnPath(field(formData, "next"), getPathname({ href: "/", locale })));
}
