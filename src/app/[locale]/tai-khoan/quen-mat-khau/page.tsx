import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { ForgotForm } from "./forgot-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account.forgot" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function ForgotPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { sent } = await searchParams;
  const t = await getTranslations("Account.forgot");
  return (
    <section className="max-w-3xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      {sent === "1" ? (
        <p role="status" className="mt-6 border border-ink/30 p-4" data-testid="forgot-sent">
          {t("sent")}
        </p>
      ) : (
        <>
          <p className="mt-2 text-muted">{t("intro")}</p>
          <ForgotForm locale={locale} />
        </>
      )}
    </section>
  );
}
