import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Container, PageHero } from "../../page-parts";
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
  const a = await getTranslations("Account");
  return (
    <>
      <PageHero eyebrow={a("eyebrow")} title={t("title")} width="text" />
      <Container width="text" className="pt-10">
        <div className="card p-6 sm:p-8 [&>*:first-child]:mt-0">
          {sent === "1" ? (
            <p role="status" className="notice mb-6" data-testid="forgot-sent">
              {t("sent")}
            </p>
          ) : (
            <>
              <p className="mt-2 text-muted">{t("intro")}</p>
              <ForgotForm locale={locale} />
            </>
          )}
        </div>
      </Container>
    </>
  );
}
