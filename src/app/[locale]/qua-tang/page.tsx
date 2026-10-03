import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { giftCollections, PRICE_BANDS, parseQuery } from "@/lib/catalogue";
import { loadCatalogue } from "@/lib/catalogue-data";

import { Container, PageHero, SectionHeading } from "../page-parts";

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

/**
 * Gift collections by occasion and budget. Only wines with no restricted vintage are listed
 * (`giftCollections`); the budget is the URL query and its options are plain links.
 */
export default async function GiftCollectionsPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("GiftCollections");
  const c = await getTranslations("Catalogue");
  const format = await getFormatter();

  const { price: band } = parseQuery(await searchParams);
  const wines = await loadCatalogue(locale === "en" ? "en" : "vi");
  const collections = giftCollections(wines, band, locale);
  const money = (vnd: number) => format.number(vnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 });

  const budgetLink = (value: string | undefined, text: string) => (
    <li key={value ?? ""}>
      <Link href={value ? `${PATH}?price=${value}` : PATH} aria-current={value === band ? "true" : undefined} className="pill">
        {text}
      </Link>
    </li>
  );

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")}>
        <p className="notice mt-6 max-w-2xl" data-testid="gift-warning">
          <strong lang="vi" className="font-medium text-wine">
            {t("warning")}
          </strong>
          {t.has("warningTranslation") && <span className="text-muted"> — {t("warningTranslation")}</span>}
        </p>
        <p className="mt-4 max-w-2xl text-sm">
          {t("giftServiceNote")}{" "}
          <Link href="/dich-vu-goi-qua" className="text-wine underline underline-offset-4">
            {t("giftServiceLink")}
          </Link>
        </p>
      </PageHero>

      <Container className="pt-10">
        <nav aria-labelledby="gift-budget" className="border-b border-line pb-6">
          <h2 id="gift-budget" className="eyebrow">
            {t("budget")}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2" data-testid="budget-options">
            {budgetLink(undefined, t("budgetAll"))}
            {PRICE_BANDS.map((b) => budgetLink(b.id, c(`priceBands.${b.id}`)))}
          </ul>
        </nav>

        {collections.map(({ occasion, listings }) => (
          <section key={occasion} className="mt-14" aria-labelledby={`collection-${occasion}`} data-testid="gift-collection" data-occasion={occasion}>
            <SectionHeading id={`collection-${occasion}`} eyebrow={t("eyebrow")} title={t(`collections.${occasion}.title`)} />
            <p className="mt-2 text-muted">{t(`collections.${occasion}.lead`)}</p>
            {listings.length === 0 ? (
              <p className="mt-6" data-testid="collection-empty">
                {t("empty")}
              </p>
            ) : (
              <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="wine-list">
                {listings.map(({ wine, fromPriceVnd, inStock }) => (
                  <li key={wine.slug} data-testid="wine-card" data-slug={wine.slug} className="card flex flex-col overflow-hidden">
                    <div aria-hidden="true" className="flex aspect-[3/4] items-end justify-center bg-paper outline outline-1 -outline-offset-8 outline-champagne-deep/40">
                      <div className="mb-8 h-3/5 w-1/5 rounded-t-full bg-wine/15" />
                    </div>
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
                      <p className="mt-auto pt-4 font-display text-xl font-semibold text-ink" data-testid="price">
                        {c("from", { price: money(fromPriceVnd) })}
                      </p>
                      {!inStock && <p className="text-sm text-muted">{c("outOfStock")}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </Container>
    </>
  );
}
