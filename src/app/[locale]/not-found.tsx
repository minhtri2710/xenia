import { getTranslations } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("NotFound");
  return (
    <section className="max-w-xl pt-8">
      <h1 className="font-display text-4xl font-medium">{t("title")}</h1>
      <Link href="/" className="mt-6 inline-block text-wine underline underline-offset-4">
        {t("back")}
      </Link>
    </section>
  );
}
