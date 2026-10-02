import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { type Filters, facetOptions, listWines, PRICE_BANDS, parseQuery, SORTS, toQuery } from "@/lib/catalogue";
import { loadCatalogue } from "@/lib/catalogue-data";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Catalogue" });
  return { title: t("title") };
}

const PATH = "/ruou-vang";

function FacetGroup({
  label,
  allLabel,
  options,
  active,
  hrefFor,
}: {
  label: string;
  allLabel: string;
  options: { value: string; label: string }[];
  active: string | undefined;
  hrefFor: (value: string | undefined) => string;
}) {
  const item = (value: string | undefined, text: string) => {
    const current = value === active;
    return (
      <li key={value ?? ""}>
        <Link
          href={hrefFor(value)}
          aria-current={current ? "true" : undefined}
          className={current ? "font-medium text-wine underline underline-offset-4" : "text-ink hover:text-wine"}
        >
          {text}
        </Link>
      </li>
    );
  };
  return (
    <div>
      <h3 className="font-display text-lg font-semibold">{label}</h3>
      <ul className="mt-2 space-y-1 text-sm">
        {item(undefined, allLabel)}
        {options.map((o) => item(o.value, o.label))}
      </ul>
    </div>
  );
}

export default async function CollectionPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Catalogue");
  const format = await getFormatter();

  const filters = parseQuery(await searchParams);
  const wines = await loadCatalogue(locale === "en" ? "en" : "vi");
  const listings = listWines(wines, filters, locale);
  const options = facetOptions(wines, filters);

  const href = (change: Partial<Filters>) => PATH + toQuery({ ...filters, ...change });
  const price = (vnd: number) => format.number(vnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 });
  const hasFilters = toQuery({ ...filters, sort: "name" }) !== "";

  return (
    <section className="pt-8">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      <p className="mt-4 max-w-2xl text-muted">{t("lead")}</p>

      <div className="mt-10 grid gap-10 md:grid-cols-[14rem_1fr]">
        <nav aria-label={t("filters")} className="space-y-6">
          <h2 className="sr-only">{t("filters")}</h2>
          <FacetGroup
            label={t("facets.type")}
            allLabel={t("all")}
            options={options.types.map((v) => ({ value: v, label: t(`types.${v}`) }))}
            active={filters.type}
            hrefFor={(v) => href({ type: v as Filters["type"] })}
          />
          <FacetGroup
            label={t("facets.country")}
            allLabel={t("all")}
            options={options.countries.map((v) => ({ value: v, label: t(`countries.${v}`) }))}
            active={filters.country}
            hrefFor={(v) => href({ country: v, region: undefined })}
          />
          {filters.country && (
            <FacetGroup
              label={t("facets.region")}
              allLabel={t("all")}
              options={options.regions.map((v) => ({ value: v, label: v }))}
              active={filters.region}
              hrefFor={(v) => href({ region: v })}
            />
          )}
          <FacetGroup
            label={t("facets.grape")}
            allLabel={t("all")}
            options={options.grapes.map((v) => ({ value: v, label: v }))}
            active={filters.grape}
            hrefFor={(v) => href({ grape: v })}
          />
          <FacetGroup
            label={t("facets.price")}
            allLabel={t("all")}
            options={PRICE_BANDS.map((b) => ({ value: b.id, label: t(`priceBands.${b.id}`) }))}
            active={filters.price}
            hrefFor={(v) => href({ price: v as Filters["price"] })}
          />
          <FacetGroup
            label={t("facets.occasion")}
            allLabel={t("all")}
            options={options.occasions.map((v) => ({ value: v, label: t(`occasions.${v}`) }))}
            active={filters.occasion}
            hrefFor={(v) => href({ occasion: v })}
          />
          <FacetGroup
            label={t("facets.size")}
            allLabel={t("all")}
            options={options.sizes.map((v) => ({ value: String(v), label: t("size", { ml: v }) }))}
            active={filters.size === undefined ? undefined : String(filters.size)}
            hrefFor={(v) => href({ size: v === undefined ? undefined : (Number(v) as Filters["size"]) })}
          />
        </nav>

        <div>
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-ink/15 pb-4">
            <p role="status" data-testid="result-count" className="text-sm text-muted">
              {t("count", { count: listings.length })}
            </p>
            <div className="flex flex-wrap items-baseline gap-3 text-sm">
              <span className="text-muted">{t("sortLabel")}</span>
              <ul className="flex flex-wrap gap-3">
                {SORTS.map((s) => (
                  <li key={s}>
                    <Link
                      href={href({ sort: s })}
                      aria-current={filters.sort === s ? "true" : undefined}
                      className={filters.sort === s ? "font-medium text-wine underline underline-offset-4" : "hover:text-wine"}
                    >
                      {t(`sorts.${s}`)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {listings.length === 0 ? (
            <div className="py-16" data-testid="empty-result">
              <h2 className="font-display text-3xl font-medium">{t("empty.title")}</h2>
              <p className="mt-2 text-muted">{t("empty.body")}</p>
              <Link href={PATH} className="mt-6 inline-block text-wine underline underline-offset-4">
                {t("clear")}
              </Link>
            </div>
          ) : (
            <>
              {hasFilters && (
                <Link href={PATH + toQuery({ sort: filters.sort })} className="mt-4 inline-block text-sm text-wine underline underline-offset-4">
                  {t("clear")}
                </Link>
              )}
              <ul className="mt-6 grid gap-8 sm:grid-cols-2 lg:grid-cols-3" data-testid="wine-list">
                {listings.map(({ wine, fromPriceVnd, inStock }) => (
                  <li key={wine.slug} data-testid="wine-card" data-slug={wine.slug} className="card flex flex-col overflow-hidden">
                    <div aria-hidden="true" className="flex aspect-[3/4] items-end justify-center bg-paper outline outline-1 -outline-offset-8 outline-champagne-deep/40">
                      <div className="mb-8 h-3/5 w-1/5 rounded-t-full bg-wine/15" />
                    </div>
                    <div className="flex flex-1 flex-col p-6">
                      <h2 className="font-display text-2xl font-semibold">
                        <Link href={`${PATH}/${wine.slug}${filters.size ? `?size=${filters.size}` : ""}`} className="hover:text-wine-deep hover:underline">
                          {wine.name}
                        </Link>
                      </h2>
                      <p className="text-sm text-muted">{wine.producer}</p>
                      <p className="mt-1 text-sm">
                        {t(`types.${wine.type}`)} · {wine.region}, {t(`countries.${wine.country}`)}
                      </p>
                      <p className="mt-auto pt-4 font-display text-xl font-semibold text-ink" data-testid="price">
                        {t("from", { price: price(fromPriceVnd) })}
                      </p>
                      {!inStock && <p className="text-sm text-muted">{t("outOfStock")}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
