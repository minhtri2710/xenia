import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { GATE_PATH } from "@/lib/gate";

import { PageHero } from "../page-parts";

export default async function ExitPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Exit");

  return (
    <PageHero tone="wine" eyebrow={t("eyebrow")} title={t("title")} lead={t("body")} width="text" center>
      <Link href={GATE_PATH} className="btn btn-line mt-8">
        {t("back")}
      </Link>
    </PageHero>
  );
}
