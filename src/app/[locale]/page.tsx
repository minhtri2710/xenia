import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { GIFT_OCCASIONS } from "@/lib/catalogue";

import { Band, Container, SectionHeading } from "./page-parts";

const STEPS = ["buyer", "delivery", "gift", "review"] as const;

/** The home page: no wine and no product is featured here, so it promotes nothing (see AGENTS, ≥15°). */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const brand = await getTranslations("Brand");
  const gifts = await getTranslations("GiftCollections");
  const service = await getTranslations("GiftService");
  const steps = await getTranslations("Checkout.steps");

  return (
    <>
      <Band tone="wine" framed className="mx-auto max-w-7xl sm:mt-6">
        <Container className="flex flex-col items-center py-16 text-center sm:py-24">
          <p className="eyebrow">{brand("tagline")}</p>
          <h1 className="mt-6 max-w-3xl font-display text-4xl leading-tight font-semibold text-champagne sm:text-6xl">{t("title")}</h1>
          <p className="mt-6 max-w-2xl text-lg text-ivory">{t("lead")}</p>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <Link href="/ruou-vang" className="btn btn-champagne">{t("browse")}</Link>
            <Link href="/qua-tang" className="btn btn-line">{brand("giftCollections")}</Link>
          </div>
        </Container>
      </Band>
      <div role="img" aria-label={t("placeholder")} className="mx-auto aspect-[16/7] w-full max-w-7xl bg-sand" />

      <Container className="py-16">
        <SectionHeading id="home-occasions" eyebrow={t("occasionsEyebrow")} title={t("occasionsTitle")} />
        <p className="mt-3 max-w-2xl text-lg text-muted">{t("occasionsLead")}</p>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-labelledby="home-occasions">
          {GIFT_OCCASIONS.map((occasion) => (
            <li key={occasion} className="card flex flex-col overflow-hidden">
              <div aria-hidden="true" className="aspect-[4/3] bg-paper outline outline-1 -outline-offset-8 outline-champagne-deep/40" />
              <div className="flex flex-1 flex-col gap-2 p-6">
                <h3 className="font-display text-2xl font-semibold">{gifts(`collections.${occasion}.title`)}</h3>
                <p className="text-muted">{gifts(`collections.${occasion}.lead`)}</p>
                <Link href={`/qua-tang#collection-${occasion}`} className="mt-auto pt-2 text-sm font-medium text-wine underline underline-offset-4">
                  {t("occasionsLink")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </Container>

      <Band tone="paper" labelledBy="home-service">
        <Container className="grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16">
          <div aria-hidden="true" className="aspect-square bg-sand outline outline-1 -outline-offset-8 outline-champagne-deep/40" />
          <div>
            <SectionHeading id="home-service" eyebrow={t("serviceEyebrow")} title={service("title")} />
            <p className="mt-4 text-lg">{service("intro")}</p>
            <p className="mt-2 text-muted">{service("paid")}</p>
            <Link href="/dich-vu-goi-qua" className="btn btn-primary mt-8">{t("serviceLink")}</Link>
          </div>
        </Container>
      </Band>

      <Band tone="olive" labelledBy="home-steps">
        <Container className="py-16">
          <SectionHeading id="home-steps" eyebrow={t("stepsEyebrow")} title={<span className="text-ivory">{t("stepsTitle")}</span>} />
          <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((step, i) => (
              <li key={step} className="flex flex-col gap-2 border-t border-champagne pt-6">
                <span className="step-number" aria-hidden="true">{String(i + 1).padStart(2, "0")}</span>
                <h3 className="font-display text-xl font-semibold text-ivory">{steps(step)}</h3>
                <p className="text-ivory">{t(`steps.${step}`)}</p>
              </li>
            ))}
          </ol>
        </Container>
      </Band>

      <Container width="narrow" className="py-16">
        <div className="border border-champagne-deep p-3">
          <div className="flex flex-col items-center border border-line px-6 py-12 text-center">
            <h2 className="font-display text-3xl font-semibold">{t("ctaTitle")}</h2>
            <p className="mt-3 max-w-xl text-lg">{t("ctaLead")}</p>
            <Link href="/ruou-vang" className="btn btn-primary mt-8">{t("ctaButton")}</Link>
          </div>
        </div>
      </Container>
    </>
  );
}
