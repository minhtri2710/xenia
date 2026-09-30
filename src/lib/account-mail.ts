// `with { type: "json" }`: Playwright loads the Payload config (for its slugs) in plain Node ESM.
import en from "../../messages/en.json" with { type: "json" };
import vi from "../../messages/vi.json" with { type: "json" };
import { routing } from "../i18n/routing";
import { ACCOUNT_ROUTES } from "./accounts";

export type MailLocale = "vi" | "en";

export const isMailLocale = (value: unknown): value is MailLocale => value === "vi" || value === "en";

const MESSAGES = { vi: vi.Account.mail, en: en.Account.mail } as const;

/** A storefront path in `locale`, as next-intl's `as-needed` prefix routes it. */
export const localePath = (locale: MailLocale, href: string) => (locale === routing.defaultLocale ? href : `/${locale}${href}`);

export type Mail = { subject: string; html: string };

/**
 * The account mail, in the request's locale. A link is a path on the same locale, not an absolute
 * URL: this run has no configured site URL and trusts no request header for one (the mock outbox
 * sends nothing; a real provider needs the Human's gate and a configured origin).
 */
export function accountMail(kind: "verify" | "exists" | "reset", locale: MailLocale, token?: string): Mail {
  const link = (href: string, label: string) => `<p><a href="${href}">${label}</a></p>`;
  const page = (route: keyof typeof ACCOUNT_ROUTES) => localePath(locale, ACCOUNT_ROUTES[route]);

  if (kind === "exists") {
    const m = MESSAGES[locale].exists;
    return { subject: m.subject, html: `<p>${m.intro}</p>${link(page("signIn"), m.signIn)}${link(page("forgot"), m.reset)}<p>${m.ignore}</p>` };
  }
  const m = MESSAGES[locale][kind];
  const href = `${page(kind)}?token=${encodeURIComponent(token ?? "")}`;
  return { subject: m.subject, html: `<p>${m.intro}</p>${link(href, href)}<p>${m.ignore}</p>` };
}
