import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

import { PageHero } from "./page-parts";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <PageHero tone="wine" eyebrow={t("eyebrow")} title={t("title")} width="text" center>
      <Link href="/" className="btn btn-champagne mt-8">
        {t("back")}
      </Link>
    </PageHero>
  );
}
