import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { ACCOUNT_ROUTES } from "@/lib/accounts";

import { Container, PageHero } from "../../page-parts";
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
  const a = await getTranslations("Account");
  const n = await getTranslations("Account.notices");
  const known = NOTICES.find((key) => key === notice);

  return (
    <>
      <PageHero eyebrow={a("eyebrow")} title={t("title")} width="text" />
      <Container width="text" className="pt-10">
        <div className="card p-6 sm:p-8 [&>*:first-child]:mt-0">
          {known && (
            <p role="status" className="notice mb-6" data-testid="account-notice" data-notice={known}>
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
        </div>
        <ResendForm locale={locale} />
      </Container>
    </>
  );
}
