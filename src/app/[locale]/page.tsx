import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const brand = await getTranslations("Brand");

  return (
    <>
      <section className="dark framed mt-8 bg-wine md:mt-12">
        <div className="frame flex flex-col items-center px-6 py-16 text-center sm:py-24">
          <p className="eyebrow">{brand("tagline")}</p>
          <h1 className="mt-6 max-w-3xl font-display text-4xl leading-tight font-semibold text-champagne sm:text-6xl">{t("title")}</h1>
          <p className="mt-6 max-w-2xl text-lg text-ivory">{t("lead")}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/ruou-vang" className="btn btn-champagne">{t("browse")}</Link>
            <Link href="/qua-tang" className="btn btn-line">{brand("giftCollections")}</Link>
          </div>
        </div>
      </section>
      <div role="img" aria-label={t("placeholder")} className="aspect-[16/7] w-full bg-sand" />
    </>
  );
}
