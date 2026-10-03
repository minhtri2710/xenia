import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { GIFT_OCCASIONS, giftListing, giftOccasionsOf, parseGiftOccasion, PRICE_BANDS, parseQuery } from "@/lib/catalogue";
import { loadCatalogue } from "@/lib/catalogue-data";

import { Band, Container, PageHero } from "../page-parts";
import { Photo } from "../photo";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "GiftCollections" });
  return { title: t("title") };
}

const PATH = "/qua-tang";

function href(occasion: string | undefined, price: string | undefined): string {
  const query = new URLSearchParams();
  if (occasion) query.set("occasion", occasion);
  if (price) query.set("price", price);
  const search = query.toString();
  return search ? `${PATH}?${search}` : PATH;
}

/**
 * Gift collections: one grid filtered by gift occasion and budget. Only wines with no restricted
 * vintage are listed (`giftListing`); both filters are the URL query and their options are plain links.
 */
export default async function GiftCollectionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("GiftCollections");
  const c = await getTranslations("Catalogue");
  const format = await getFormatter();

  const query = await searchParams;
  const { price: band } = parseQuery(query);
  const occasion = parseGiftOccasion(query.occasion);
  const listings = giftListing(await loadCatalogue(locale === "en" ? "en" : "vi"), { occasion, price: band }, locale);
  const money = (vnd: number) => format.number(vnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 });

  const pill = (key: string, link: string, current: boolean, text: string) => (
    <li key={key}>
      <Link href={link} aria-current={current ? "true" : undefined} className="pill">
        {text}
      </Link>
    </li>
  );

  return (
    <>
      <PageHero tone="wine" eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} center />

      <Container className="pt-10">
        <p className="notice max-w-2xl" data-testid="gift-warning">
          <strong lang="vi" className="font-medium text-wine">
            {t("warning")}
          </strong>
          {t.has("warningTranslation") && <span className="text-muted"> — {t("warningTranslation")}</span>}
        </p>

        <div className="mt-8 grid gap-6 border-b border-line pb-8 md:grid-cols-2">
          <nav aria-labelledby="gift-occasion">
            <h2 id="gift-occasion" className="eyebrow">
              {t("occasion")}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2" data-testid="occasion-options">
              {pill("all", href(undefined, band), occasion === undefined, t("occasionAll"))}
              {GIFT_OCCASIONS.map((o) => pill(o, href(o, band), o === occasion, t(`collections.${o}.title`)))}
            </ul>
          </nav>
          <nav aria-labelledby="gift-budget">
            <h2 id="gift-budget" className="eyebrow">
              {t("budget")}
            </h2>
            <ul className="mt-3 flex flex-wrap gap-2" data-testid="budget-options">
              {pill("all", href(occasion, undefined), band === undefined, t("budgetAll"))}
              {PRICE_BANDS.map((b) => pill(b.id, href(occasion, b.id), b.id === band, c(`priceBands.${b.id}`)))}
            </ul>
          </nav>
        </div>

        <h2 id="gift-results" className="sr-only">
          {occasion ? t(`collections.${occasion}.title`) : t("title")}
        </h2>
        {occasion && <p className="mt-8 max-w-2xl text-lg text-muted">{t(`collections.${occasion}.lead`)}</p>}
        {listings.length === 0 ? (
          <p className="mt-10" data-testid="collection-empty">
            {t("empty")}
          </p>
        ) : (
          <ul className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-labelledby="gift-results" data-testid="wine-list">
            {listings.map(({ wine, fromPriceVnd, inStock }) => (
              <li key={wine.slug} data-testid="wine-card" data-slug={wine.slug} className="card flex flex-col overflow-hidden">
                <Photo name={`wines/${wine.slug}`} className="aspect-square">
                  <div aria-hidden="true" className="flex aspect-square items-end justify-center bg-paper outline outline-1 -outline-offset-8 outline-champagne-deep/40">
                    <div className="mb-8 h-3/5 w-1/6 rounded-t-full bg-wine/15" />
                  </div>
                </Photo>
                <div className="flex flex-1 flex-col p-6">
                  <p className="eyebrow" data-testid="card-occasions">
                    {giftOccasionsOf(wine)
                      .map((o) => t(`collections.${o}.title`))
                      .join(" · ")}
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-semibold">{wine.name}</h3>
                  <p className="text-sm text-muted">{wine.producer}</p>
                  <p className="mt-1 text-sm">
                    {c(`types.${wine.type}`)} · {wine.region}, {c(`countries.${wine.country}`)}
                  </p>
                  <p className="mt-auto pt-4 font-display text-xl font-semibold text-ink" data-testid="price">
                    {c("from", { price: money(fromPriceVnd) })}
                  </p>
                  {!inStock && <p className="text-sm text-muted">{c("outOfStock")}</p>}
                  <Link href={`/ruou-vang/${wine.slug}`} className="btn btn-ghost mt-5 self-start" aria-label={t("detailsFor", { name: wine.name })} data-testid="card-details">
                    {t("details")}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Container>

      <Band tone="paper" labelledBy="gift-cta" className="mt-16">
        <Container width="narrow" className="flex flex-col items-center py-16 text-center">
          <h2 id="gift-cta" className="font-display text-3xl font-semibold">
            {t("ctaTitle")}
          </h2>
          <p className="mt-3 max-w-xl text-lg">{t("ctaLead")}</p>
          <p className="mt-2 max-w-xl text-sm text-muted">
            {t("giftServiceNote")}{" "}
            <Link href="/dich-vu-goi-qua" className="text-wine underline underline-offset-4">
              {t("giftServiceLink")}
            </Link>
          </p>
          <Link href="/ca-nhan-hoa" className="btn btn-primary mt-8">
            {t("ctaButton")}
          </Link>
        </Container>
      </Band>
    </>
  );
}
