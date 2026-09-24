import { getTranslations, setRequestLocale } from "next-intl/server";

import { safeReturnPath } from "@/lib/return-path";

import { GateForm } from "./gate-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function GatePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { next } = await searchParams;
  const t = await getTranslations("Gate");

  return (
    <section className="max-w-2xl pt-8">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      <p className="mt-6 text-lg">{t("intro")}</p>
      <GateForm locale={locale} next={safeReturnPath(next)} />
      <p className="mt-8 max-w-md text-sm text-muted">{t("privacy")}</p>
    </section>
  );
}
