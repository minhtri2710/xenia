import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "../globals.css";

import type { Metadata } from "next";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { currentCustomer } from "@/lib/account-data";
import { ACCOUNT_PATH, ACCOUNT_ROUTES } from "@/lib/accounts";
import { POLICY_SLUGS, policyPath } from "@/lib/policies";
import { loadSiteSettings } from "@/lib/shop-data";

import { LanguageLink } from "./language-link";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { title: t("title") };
}

async function SiteFooter() {
  const settings = await loadSiteSettings();
  const owner = settings.owner;
  const t = await getTranslations("Footer");
  const notice = await getTranslations("Notice");
  const p = await getTranslations("Policy.links");
  const showSample = (owner?.legalName ?? "").startsWith("Xenia Sample Trading Company");

  return (
    <footer className="mt-12 border-t border-ink/15 px-6 py-8 text-sm sm:px-12">
      <div className="mx-auto grid max-w-7xl gap-8 md:grid-cols-3">
        <section aria-labelledby="footer-owner" data-testid="footer-owner">
          <h2 id="footer-owner" className="font-display text-xl font-semibold">{t("business")}</h2>
          {showSample && <p className="mt-2 text-wine">{t("sample")}</p>}
          <dl className="mt-3 grid gap-2">
            <div><dt className="inline font-medium">{t("business")}: </dt><dd className="inline">{owner?.legalName}</dd></div>
            <div><dt className="inline font-medium">{t("registration")}: </dt><dd className="inline">{owner?.businessRegistration?.number}</dd></div>
            <div><dt className="inline font-medium">{t("registrationDate")}: </dt><dd className="inline">{owner?.businessRegistration?.date}</dd></div>
            <div><dt className="inline font-medium">{t("registrationPlace")}: </dt><dd className="inline">{owner?.businessRegistration?.place}</dd></div>
            <div><dt className="inline font-medium">{t("representative")}: </dt><dd className="inline">{owner?.legalRepresentative}</dd></div>
            <div><dt className="inline font-medium">{t("licence")}: </dt><dd className="inline">{owner?.alcoholLicence?.number}</dd></div>
            <div><dt className="inline font-medium">{t("licenceIssuer")}: </dt><dd className="inline">{owner?.alcoholLicence?.issuer}</dd></div>
            <div><dt className="inline font-medium">{t("licenceDate")}: </dt><dd className="inline">{owner?.alcoholLicence?.date}</dd></div>
            <div><dt className="inline font-medium">{t("headOffice")}: </dt><dd className="inline">{owner?.headOffice}</dd></div>
          </dl>
        </section>
        <section aria-labelledby="footer-contact">
          <h2 id="footer-contact" className="font-display text-xl font-semibold">{t("contact")}</h2>
          <p className="mt-3"><a className="break-all text-wine underline underline-offset-4" href={`mailto:${owner?.contactEmail}`}>{owner?.contactEmail}</a></p>
          <p className="mt-2"><a className="text-wine underline underline-offset-4" href={`tel:${owner?.contactPhone}`}>{owner?.contactPhone}</a></p>
          {owner?.notificationLink && <p className="mt-3"><a className="break-all text-wine underline underline-offset-4" href={owner.notificationLink} rel="noreferrer">{t("notification")}</a></p>}
        </section>
        <nav aria-labelledby="footer-policies">
          <h2 id="footer-policies" className="font-display text-xl font-semibold">{t("policies")}</h2>
          <ul className="mt-3 grid gap-2">
            {POLICY_SLUGS.map((slug) => <li key={slug}><Link className="text-wine underline underline-offset-4" href={policyPath(slug)}>{p(slug)}</Link></li>)}
          </ul>
        </nav>
      </div>
      <p className="mt-8" data-testid="age-notice">
        <strong lang="vi" className="font-medium text-wine">{notice("legal")}</strong>
        {notice.has("translation") && <span className="text-muted"> — {notice("translation")}</span>}
      </p>
    </footer>
  );
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  await connection();
  const brand = await getTranslations("Brand");
  const notice = await getTranslations("Notice");
  const footer = await getTranslations("Footer");
  const account = await currentCustomer();

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <NextIntlClientProvider>
          <a href="#main-content" className="skip-link">{notice("skip")}</a>
          <header className="border-b border-ink/10 px-6 py-5 sm:px-12">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
              <div>
                <Link href="/" className="font-display text-3xl font-semibold tracking-wide text-ink">{brand("name")}</Link>
                <p className="mt-1 text-sm text-muted">{brand("tagline")}</p>
              </div>
              <nav aria-label={footer("primaryNav")} className="flex flex-wrap items-center gap-x-5 gap-y-3">
                <Link href="/ruou-vang" className="text-sm text-wine underline underline-offset-4">{brand("wines")}</Link>
                <Link href="/qua-tang" className="text-sm text-wine underline underline-offset-4">{brand("giftCollections")}</Link>
                <Link href="/dich-vu-goi-qua" className="text-sm text-wine underline underline-offset-4">{brand("giftService")}</Link>
                <Link href="/gio-hang" className="text-sm text-wine underline underline-offset-4">{brand("cart")}</Link>
                <Link href={account ? ACCOUNT_PATH : ACCOUNT_ROUTES.signIn} className="text-sm text-wine underline underline-offset-4" data-testid="header-account">{account ? brand("account") : brand("signIn")}</Link>
                <span className="sr-only">{footer("language")}</span>
                <LanguageLink />
              </nav>
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-6 pb-16 sm:px-12">{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
