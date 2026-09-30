import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

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
  return (
    <section className="max-w-3xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      <p className="mt-2 text-muted">{t("intro")}</p>
      <RegisterForm locale={locale} />
    </section>
  );
}
