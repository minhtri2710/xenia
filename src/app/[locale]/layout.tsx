import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/cormorant-garamond/500-italic.css";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/500.css";
import "@fontsource/playfair-display/600.css";
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
import { BRIO_PATH } from "@/lib/brio";
import { brioIsPromotable } from "@/lib/catalogue-data";
import { POLICY_SLUGS, policyPath } from "@/lib/policies";
import { QUOTE_PATH } from "@/lib/quote";
import { loadSiteSettings } from "@/lib/shop-data";

import { LanguageLink } from "./language-link";
import { NavLink } from "./nav-link";

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
  const brand = await getTranslations("Brand");
  const brio = await getTranslations("Brio");
  const personalise = await getTranslations("Personalise");
  const quote = await getTranslations("Quote");
  const showBrio = await brioIsPromotable();
  const showSample = (owner?.legalName ?? "").startsWith("Xenia Sample Trading Company");

  return (
    <footer className="dark bg-wine-deep px-6 pt-16 pb-8 text-sm text-on-dark sm:px-12">
      <div className="mx-auto max-w-7xl">
        <p className="font-display text-2xl font-semibold tracking-[0.12em] text-champagne uppercase">{brand("name")}</p>
        <p className="mt-1 font-accent text-xl text-champagne italic">{brand("tagline")}</p>
        <nav aria-label={t("explore")} className="mt-6">
          <ul className="flex flex-wrap gap-x-6 gap-y-2" data-testid="footer-explore">
            {showBrio && <li><Link className="inline-block py-1 text-on-dark underline decoration-champagne/50 underline-offset-4 hover:text-champagne" href={BRIO_PATH}>{brio("title")}</Link></li>}
            <li><Link className="inline-block py-1 text-on-dark underline decoration-champagne/50 underline-offset-4 hover:text-champagne" href="/ca-nhan-hoa">{personalise("nav")}</Link></li>
            <li><Link className="inline-block py-1 text-on-dark underline decoration-champagne/50 underline-offset-4 hover:text-champagne" href={QUOTE_PATH}>{quote("nav")}</Link></li>
          </ul>
        </nav>
      </div>
      <div className="mx-auto mt-10 grid max-w-7xl gap-8 md:grid-cols-3">
        <section aria-labelledby="footer-owner" data-testid="footer-owner">
          <h2 id="footer-owner" className="eyebrow">{t("business")}</h2>
          {showSample && <p className="mt-2 text-champagne">{t("sample")}</p>}
          <dl className="mt-3 grid gap-2">
            <div><dt className="inline font-medium text-on-dark-muted">{t("business")}: </dt><dd className="inline">{owner?.legalName}</dd></div>
            <div><dt className="inline font-medium text-on-dark-muted">{t("registration")}: </dt><dd className="inline">{owner?.businessRegistration?.number}</dd></div>
            <div><dt className="inline font-medium text-on-dark-muted">{t("registrationDate")}: </dt><dd className="inline">{owner?.businessRegistration?.date}</dd></div>
            <div><dt className="inline font-medium text-on-dark-muted">{t("registrationPlace")}: </dt><dd className="inline">{owner?.businessRegistration?.place}</dd></div>
            <div><dt className="inline font-medium text-on-dark-muted">{t("representative")}: </dt><dd className="inline">{owner?.legalRepresentative}</dd></div>
            <div><dt className="inline font-medium text-on-dark-muted">{t("licence")}: </dt><dd className="inline">{owner?.alcoholLicence?.number}</dd></div>
            <div><dt className="inline font-medium text-on-dark-muted">{t("licenceIssuer")}: </dt><dd className="inline">{owner?.alcoholLicence?.issuer}</dd></div>
            <div><dt className="inline font-medium text-on-dark-muted">{t("licenceDate")}: </dt><dd className="inline">{owner?.alcoholLicence?.date}</dd></div>
            <div><dt className="inline font-medium text-on-dark-muted">{t("headOffice")}: </dt><dd className="inline">{owner?.headOffice}</dd></div>
          </dl>
        </section>
        <section aria-labelledby="footer-contact">
          <h2 id="footer-contact" className="eyebrow">{t("contact")}</h2>
          <p className="mt-3"><a className="break-all text-on-dark underline decoration-champagne/50 underline-offset-4 hover:text-champagne" href={`mailto:${owner?.contactEmail}`}>{owner?.contactEmail}</a></p>
          <p className="mt-2"><a className="text-on-dark underline decoration-champagne/50 underline-offset-4 hover:text-champagne" href={`tel:${owner?.contactPhone}`}>{owner?.contactPhone}</a></p>
          {owner?.notificationLink && <p className="mt-3"><a className="break-all text-on-dark underline decoration-champagne/50 underline-offset-4 hover:text-champagne" href={owner.notificationLink} rel="noreferrer">{t("notification")}</a></p>}
        </section>
        <nav aria-labelledby="footer-policies">
          <h2 id="footer-policies" className="eyebrow">{t("policies")}</h2>
          <ul className="mt-3 grid gap-2">
            {POLICY_SLUGS.map((slug) => <li key={slug}><Link className="text-on-dark underline decoration-champagne/50 underline-offset-4 hover:text-champagne" href={policyPath(slug)}>{p(slug)}</Link></li>)}
          </ul>
        </nav>
      </div>
      <p className="mx-auto mt-12 max-w-7xl border-t border-on-dark/20 pt-6" data-testid="age-notice">
        <strong lang="vi" className="font-medium text-champagne">{notice("legal")}</strong>
        {notice.has("translation") && <span className="text-on-dark-muted"> — {notice("translation")}</span>}
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
  const brio = await getTranslations("Brio");
  const personalise = await getTranslations("Personalise");
  const account = await currentCustomer();
  const showBrio = await brioIsPromotable();

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <NextIntlClientProvider>
          <a href="#main-content" className="skip-link">{notice("skip")}</a>
          <header className="border-b border-line bg-ivory px-6 py-4 sm:px-12">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-8 gap-y-4">
              <div>
                <Link href="/" className="font-display text-2xl font-semibold tracking-[0.12em] text-wine uppercase no-underline">{brand("name")}</Link>
                <p className="eyebrow mt-1">{brand("tagline")}</p>
              </div>
              <nav aria-label={footer("primaryNav")} className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <NavLink href="/ruou-vang">{brand("wines")}</NavLink>
                <NavLink href="/qua-tang">{brand("giftCollections")}</NavLink>
                {showBrio && <NavLink href={BRIO_PATH} testId="header-brio">{brio("title")}</NavLink>}
                <NavLink href="/ca-nhan-hoa">{personalise("nav")}</NavLink>
                <NavLink href="/dich-vu-goi-qua">{brand("giftService")}</NavLink>
                <NavLink href="/gio-hang">{brand("cart")}</NavLink>
                <NavLink href={account ? ACCOUNT_PATH : ACCOUNT_ROUTES.signIn} testId="header-account">{account ? brand("account") : brand("signIn")}</NavLink>
                <span className="sr-only">{footer("language")}</span>
                <LanguageLink />
              </nav>
              <Link href={QUOTE_PATH} className="btn btn-primary hidden sm:inline-flex">{brand("quote")}</Link>
            </div>
          </header>
          <main id="main-content" tabIndex={-1} className="w-full flex-1 pb-16">{children}</main>
          <SiteFooter />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
