import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { loadWine } from "@/lib/catalogue-data";
import { selectVintage } from "@/lib/vintage-selection";

import { addToCart } from "../../gio-hang/actions";
import { Band, Container, SectionHeading } from "../../page-parts";
import { Photo } from "../../photo";

type Props = {
  params: Promise<{ locale: string; slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const PROFILE_AXES = ["body", "tannin", "sweetness", "acidity"] as const;

function Spec({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div data-spec={id} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-4 border-b border-line py-3">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function Choices({ label, options }: { label: string; options: { key: string; text: string; href: string; current: boolean }[] }) {
  return (
    <div>
      <h3 className="eyebrow">{label}</h3>
      <ul className="mt-3 flex flex-wrap gap-2">
        {options.map((o) => (
          <li key={o.key}>
            <Link href={o.href} aria-current={o.current ? "true" : undefined} className="pill">
              {o.text}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default async function WinePage({ params, searchParams }: Props) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const data = await loadWine(slug, locale === "en" ? "en" : "vi");
  const selection = data && selectVintage(data.vintages, await searchParams);
  if (!data || !selection) notFound();

  const { wine } = data;
  const v = selection.selected;
  const t = await getTranslations("Product");
  const c = await getTranslations("Catalogue");
  const format = await getFormatter();
  const path = `/ruou-vang/${wine.slug}`;
  const price = format.number(v.priceVnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 });
  const vintageText = (year: number | null) => (year === null ? t("nv") : String(year));
  let window: string | null = null;
  if (v.drinkFrom != null && v.drinkTo != null) {
    window = t("windowRange", { from: String(v.drinkFrom), to: String(v.drinkTo) });
  } else if (v.drinkFrom != null) {
    window = t("windowFrom", { from: String(v.drinkFrom) });
  } else if (v.drinkTo != null) {
    window = t("windowTo", { to: String(v.drinkTo) });
  }

  return (
    <article>
      <Container className="pt-8 pb-16">
        <Link href="/ruou-vang" className="inline-block py-2 text-sm text-wine underline underline-offset-4">
          {t("back")}
        </Link>

        <div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-16">
          <Photo name={`wines/${wine.slug}`} alt={wine.name} className="card aspect-[3/4]" testId="product-photo">
            <div aria-hidden="true" className="card flex aspect-[3/4] items-end justify-center bg-paper outline outline-1 -outline-offset-8 outline-champagne-deep/40">
              <div className="mb-8 h-3/5 w-1/5 rounded-t-full bg-wine/15" />
            </div>
          </Photo>

          <div>
            <p className="eyebrow">{wine.producer.name}</p>
            <h1 className="mt-3 font-display text-4xl leading-tight font-semibold sm:text-5xl">{wine.name}</h1>
            <p className="mt-2">
              {c(`types.${wine.type}`)} · {vintageText(v.year)} · {t("volumeValue", { ml: v.bottleMl })}
            </p>
            <p className="mt-6 font-display text-3xl font-semibold" data-testid="price">
              {t("priceValue", { price })}
            </p>
            <p className="text-sm text-muted" data-testid="stock">
              {v.stock > 0 ? t("inStock") : t("outOfStock")}
            </p>

            <nav aria-label={t("selector")} className="mt-8 space-y-6 border-t border-line pt-8">
              <h2 className="sr-only">{t("selector")}</h2>
              <Choices
                label={t("vintage")}
                options={selection.vintages.map((o) => ({ key: o.key, text: vintageText(o.year), href: path + o.query, current: o.current }))}
              />
              <Choices
                label={t("size")}
                options={selection.sizes.map((o) => ({
                  key: String(o.ml),
                  text: t("volumeValue", { ml: o.ml }),
                  href: path + o.query,
                  current: o.current,
                }))}
              />
            </nav>

            {v.stock > 0 && (
              <form action={addToCart} className="mt-8 flex flex-wrap items-end gap-3 border-t border-line pt-8" data-testid="add-to-cart">
                <input type="hidden" name="locale" value={locale} />
                <input type="hidden" name="vintageId" value={v.id} />
                <label className="grid gap-1 text-sm">
                  {t("quantity")}
                  <input
                    name="qty"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={v.stock}
                    step={1}
                    required
                    defaultValue={1}
                    className="min-h-12 w-24 border border-ink/40 bg-raised px-3 py-2"
                  />
                </label>
                <button type="submit" className="btn btn-primary">
                  {t("addToCart")}
                </button>
              </form>
            )}
          </div>
        </div>
      </Container>

      <Band tone="paper" labelledBy="specs">
        <Container className="grid gap-12 py-16 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading id="specs" eyebrow={t("specsEyebrow")} title={t("specs")} />
            <dl className="mt-6 border-t border-line" data-testid="spec-list">
              <Spec id="producer" label={t("spec.producer")}>
                {wine.producer.name}
              </Spec>
              <Spec id="vintage" label={t("spec.vintage")}>
                {vintageText(v.year)}
              </Spec>
              <Spec id="country" label={t("spec.country")}>
                {c(`countries.${wine.country}`)}
              </Spec>
              <Spec id="region" label={t("spec.region")}>
                {wine.region}
              </Spec>
              {wine.appellation && (
                <Spec id="appellation" label={t("spec.appellation")}>
                  {wine.appellation}
                </Spec>
              )}
              <Spec id="grapes" label={t("spec.grapes")}>
                {wine.grapes.map((g) => (g.pct == null ? g.grape : t("grapeShare", { grape: g.grape, pct: g.pct }))).join(", ")}
              </Spec>
              <Spec id="abv" label={t("spec.abv")}>
                {t("abvValue", { abv: format.number(v.abvPct, { maximumFractionDigits: 2 }) })}
              </Spec>
              <Spec id="volume" label={t("spec.volume")}>
                {t("volumeValue", { ml: v.bottleMl })}
              </Spec>
              {window && (
                <Spec id="drinking-window" label={t("spec.drinkingWindow")}>
                  {window}
                </Spec>
              )}
              <Spec id="importer" label={t("spec.importer")}>
                {v.importer}
              </Spec>
              <Spec id="serving-temp" label={t("spec.servingTemp")}>
                {t("tempValue", { temp: wine.servingTempC })}
              </Spec>
              <Spec id="price" label={t("spec.price")}>
                {t("priceValue", { price })}
              </Spec>
              <Spec id="stock" label={t("spec.stock")}>
                {v.stock > 0 ? t("inStock") : t("outOfStock")}
              </Spec>
            </dl>
          </div>

          <div>
            <p className="eyebrow mb-2">{t("tastingEyebrow")}</p>
            <h3 className="font-display text-2xl font-semibold">{t("tasting")}</h3>
            <dl className="mt-4 border-t border-line" data-testid="tasting">
              {(["nose", "palate", "finish"] as const).map((k) => (
                <Spec key={k} id={k} label={t(k)}>
                  {wine.tasting[k]}
                </Spec>
              ))}
            </dl>

            <h3 className="mt-10 font-display text-2xl font-semibold">{t("profile")}</h3>
            <dl className="mt-4 border-t border-line" data-testid="profile">
              {PROFILE_AXES.map((axis) => (
                <Spec key={axis} id={axis} label={t(`axes.${axis}`)}>
                  <span className="flex flex-wrap items-center gap-3">
                    <span aria-hidden="true" className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <span key={n} className={`h-2 w-5 ${n <= wine.profile[axis] ? "bg-wine" : "bg-taupe"}`} />
                      ))}
                    </span>
                    {t("profileValue", { value: wine.profile[axis] })}
                  </span>
                </Spec>
              ))}
            </dl>

            {wine.pairings && wine.pairings.length > 0 && (
              <>
                <h3 className="mt-10 font-display text-2xl font-semibold">{t("pairings")}</h3>
                <ul className="mt-3 flex flex-wrap gap-2 text-sm" data-testid="pairings">
                  {wine.pairings.map((p) => (
                    <li key={p} className="border border-line bg-raised px-3 py-1">
                      {c(`pairings.${p}`)}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </Container>
      </Band>
    </article>
  );
}
