import { getTranslations, setRequestLocale } from "next-intl/server";

import { getPathname } from "@/i18n/navigation";
import { safeReturnPath } from "@/lib/return-path";

import { Container, PageHero } from "../page-parts";
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
    <>
      <PageHero tone="wine" eyebrow={t("eyebrow")} title={t("title")} lead={t("intro")} width="text" center />
      <Container width="text" className="pt-10">
        <div className="card p-6 sm:p-8 [&>*:first-child]:mt-0">
          <GateForm locale={locale} next={safeReturnPath(next, getPathname({ href: "/", locale }))} />
        </div>
        <p className="mt-6 text-sm text-muted">{t("privacy")}</p>
      </Container>
    </>
  );
}
