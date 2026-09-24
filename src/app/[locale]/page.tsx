import { getTranslations, setRequestLocale } from "next-intl/server";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");

  return (
    <section className="grid gap-12 pt-8 md:grid-cols-[3fr_2fr] md:items-end md:pt-16">
      <div className="max-w-2xl">
        <h1 className="font-display text-5xl leading-tight font-medium sm:text-6xl">{t("title")}</h1>
        <p className="mt-6 text-lg text-muted">{t("lead")}</p>
      </div>
      <div
        role="img"
        aria-label={t("placeholder")}
        className="aspect-[3/4] w-full max-w-sm bg-paper outline outline-1 -outline-offset-8 outline-wine/40"
      />
    </section>
  );
}
