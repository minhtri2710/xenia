import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { featuredWines, GIFT_OCCASIONS } from "@/lib/catalogue";
import { loadCatalogue } from "@/lib/catalogue-data";
import { QUOTE_PATH } from "@/lib/quote";

import { Band, Container, SectionHeading } from "./page-parts";
import { Photo } from "./photo";

const STEPS = ["buyer", "delivery", "gift", "review"] as const;

/**
 * The home page. Its featured wines are a promotional surface: `featuredWines` never lists a wine
 * with a published vintage at 15% ABV or above, and the under-18 warning stands beside them.
 */
export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Home");
  const brand = await getTranslations("Brand");
  const gifts = await getTranslations("GiftCollections");
  const service = await getTranslations("GiftService");
  const steps = await getTranslations("Checkout.steps");
  const c = await getTranslations("Catalogue");
  const format = await getFormatter();
  const featured = featuredWines(await loadCatalogue(locale === "en" ? "en" : "vi"), locale);
  const money = (vnd: number) => format.number(vnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 });

  return (
    <>
      <Band tone="wine" framed>
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
      <Photo name="site/home-hero" className="h-64 sm:h-[480px]" testId="home-hero-photo">
        <div role="img" aria-label={t("placeholder")} className="h-64 w-full bg-sand sm:h-[480px]" />
      </Photo>

      <Container className="py-16">
        <SectionHeading id="home-occasions" eyebrow={t("occasionsEyebrow")} title={t("occasionsTitle")} />
        <p className="mt-3 max-w-2xl text-lg text-muted">{t("occasionsLead")}</p>
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-labelledby="home-occasions">
          {GIFT_OCCASIONS.map((occasion) => (
            <li key={occasion} className="card flex flex-col overflow-hidden">
              <Photo name={`site/occasion-${occasion}`} className="aspect-[4/3]">
                <div aria-hidden="true" className="aspect-[4/3] bg-paper outline outline-1 -outline-offset-8 outline-champagne-deep/40" />
              </Photo>
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
          <Photo name="site/gift-service" className="aspect-square">
            <div aria-hidden="true" className="aspect-square bg-sand outline outline-1 -outline-offset-8 outline-champagne-deep/40" />
          </Photo>
          <div>
            <SectionHeading id="home-service" eyebrow={t("serviceEyebrow")} title={service("title")} />
            <p className="mt-4 text-lg">{service("intro")}</p>
            <p className="mt-2 text-muted">{service("paid")}</p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/dich-vu-goi-qua" className="btn btn-primary">{t("serviceLink")}</Link>
              <Link href={QUOTE_PATH} className="btn border-ink/40 hover:border-wine hover:text-wine">{t("quoteButton")}</Link>
            </div>
          </div>
        </Container>
      </Band>

      {featured.length > 0 && (
        <Band labelledBy="home-featured">
          <Container className="py-16">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <SectionHeading id="home-featured" eyebrow={t("featuredEyebrow")} title={t("featuredTitle")} />
              <Link href="/ruou-vang" className="inline-block py-2 text-sm font-medium text-wine underline underline-offset-4">
                {t("featuredAll")}
              </Link>
            </div>
            <p className="notice mt-6 max-w-2xl" data-testid="featured-warning">
              <strong lang="vi" className="font-medium text-wine">
                {gifts("warning")}
              </strong>
              {gifts.has("warningTranslation") && <span className="text-muted"> — {gifts("warningTranslation")}</span>}
            </p>
            <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="featured-wines">
              {featured.map(({ wine, fromPriceVnd, inStock }) => (
                <li key={wine.slug} data-testid="featured-card" data-slug={wine.slug} className="card flex flex-col overflow-hidden">
                  <Photo name={`wines/${wine.slug}`} className="aspect-[4/3]">
                    <div aria-hidden="true" className="flex aspect-[4/3] items-end justify-center bg-paper outline outline-1 -outline-offset-8 outline-champagne-deep/40">
                      <div className="mb-6 h-3/4 w-1/6 rounded-t-full bg-wine/15" />
                    </div>
                  </Photo>
                  <div className="flex flex-1 flex-col p-6">
                    <h3 className="font-display text-2xl font-semibold">
                      <Link href={`/ruou-vang/${wine.slug}`} className="hover:text-wine-deep hover:underline">
                        {wine.name}
                      </Link>
                    </h3>
                    <p className="text-sm text-muted">{wine.producer}</p>
                    <p className="mt-1 text-sm">
                      {c(`types.${wine.type}`)} · {wine.region}, {c(`countries.${wine.country}`)}
                    </p>
                    <p className="mt-auto pt-4 font-display text-xl font-semibold text-ink">{c("from", { price: money(fromPriceVnd) })}</p>
                    {!inStock && <p className="text-sm text-muted">{c("outOfStock")}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </Container>
        </Band>
      )}

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
