import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/cormorant-garamond/600.css";
import "../globals.css";

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Meta" });
  return { title: t("title") };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const brand = await getTranslations("Brand");
  const notice = await getTranslations("Notice");

  return (
    <html lang={locale}>
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <NextIntlClientProvider>
          <header className="flex items-start justify-between gap-6 px-6 py-8 sm:px-12">
            <div>
              <Link href="/" className="font-display text-3xl font-semibold tracking-wide text-ink">
                {brand("name")}
              </Link>
              <p className="mt-1 text-sm text-muted">{brand("tagline")}</p>
            </div>
            <Link href="/gio-hang" className="mt-2 text-sm text-wine underline underline-offset-4">
              {brand("cart")}
            </Link>
          </header>
          <main className="flex-1 px-6 pb-16 sm:px-12">{children}</main>
          <footer className="border-t border-ink/15 px-6 py-6 text-sm sm:px-12">
            <p data-testid="age-notice">
              <strong lang="vi" className="font-medium text-wine">
                {notice("legal")}
              </strong>
              {notice.has("translation") && <span className="text-muted"> — {notice("translation")}</span>}
            </p>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
