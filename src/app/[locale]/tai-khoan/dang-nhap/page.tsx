import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { ACCOUNT_ROUTES } from "@/lib/accounts";

import { ResendForm, SignInForm } from "./sign-in-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const NOTICES = ["registered", "resent", "verified", "reset", "signedOut", "deleted"] as const;

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account.signIn" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { notice, next } = await searchParams;
  const t = await getTranslations("Account.signIn");
  const n = await getTranslations("Account.notices");
  const known = NOTICES.find((key) => key === notice);

  return (
    <section className="max-w-3xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      {known && (
        <p role="status" className="mt-6 border border-ink/30 p-4" data-testid="account-notice" data-notice={known}>
          {n(known)}
        </p>
      )}
      <SignInForm locale={locale} next={typeof next === "string" ? next : ""} />
      <p className="mt-6 text-sm">
        {t("noAccount")}{" "}
        <Link href={ACCOUNT_ROUTES.register} className="text-wine underline underline-offset-4">
          {t("register")}
        </Link>
      </p>
      <ResendForm locale={locale} />
    </section>
  );
}
