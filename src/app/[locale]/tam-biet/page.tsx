import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { GATE_PATH } from "@/lib/gate";

export default async function ExitPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Exit");

  return (
    <section className="max-w-xl pt-8">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      <p className="mt-6 text-lg">{t("body")}</p>
      <Link href={GATE_PATH} className="mt-8 inline-block text-wine underline underline-offset-4">
        {t("back")}
      </Link>
    </section>
  );
}
