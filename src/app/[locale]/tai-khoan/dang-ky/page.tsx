import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Container, PageHero } from "../../page-parts";
import { RegisterForm } from "./register-form";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account.register" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function RegisterPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Account.register");
  const a = await getTranslations("Account");
  return (
    <>
      <PageHero eyebrow={a("eyebrow")} title={t("title")} width="text" />
      <Container width="text" className="pt-10">
        <div className="card p-6 sm:p-8 [&>*:first-child]:mt-0">
          <p className="mt-2 text-muted">{t("intro")}</p>
          <RegisterForm locale={locale} />
        </div>
      </Container>
    </>
  );
}
