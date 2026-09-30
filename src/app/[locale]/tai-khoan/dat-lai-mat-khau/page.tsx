import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { ACCOUNT_ROUTES } from "@/lib/accounts";

import { ResetForm } from "./reset-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account.reset" });
  // The token is in the URL: keep it out of indexes and out of Referer headers.
  return { title: t("title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function ResetPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token } = await searchParams;
  const t = await getTranslations("Account.reset");
  return (
    <section className="max-w-3xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      {typeof token === "string" && token !== "" ? (
        <ResetForm locale={locale} token={token} />
      ) : (
        <p className="mt-6 text-muted">
          {t("noToken")}{" "}
          <Link href={ACCOUNT_ROUTES.forgot} className="text-wine underline underline-offset-4">
            {t("again")}
          </Link>
        </p>
      )}
    </section>
  );
}
