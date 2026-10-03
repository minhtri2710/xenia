import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { BRIO_SLUG, isBrioPromotable } from "@/lib/brio";
import { loadWine } from "@/lib/catalogue-data";
import { QUOTE_PATH } from "@/lib/quote";
import { selectVintage } from "@/lib/vintage-selection";

import { Band, Container, SectionHeading } from "../page-parts";
import { Photo } from "../photo";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Brio" });
  return { title: t("title") };
}

const PROCESS = ["region", "ferment", "bottle"] as const;

/**
 * The Brio story. A promotional surface: it renders only while the catalogue's `brio` wine is
 * promotable (`isBrioPromotable`: published, no published vintage at 15% ABV or above), else 404.
 */
export default async function BrioPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const data = await loadWine(BRIO_SLUG, locale === "en" ? "en" : "vi");
  const selection = data && isBrioPromotable(data.vintages) ? selectVintage(data.vintages, {}) : null;
  if (!data || !selection) notFound();

  const { wine } = data;
  const v = selection.selected;
  const t = await getTranslations("Brio");
  const p = await getTranslations("Product");
  const g = await getTranslations("GiftCollections");
  const home = await getTranslations("Home");
  const format = await getFormatter();
  const price = format.number(v.priceVnd, { style: "currency", currency: "VND", maximumFractionDigits: 0 });
  const specs: [id: string, label: string, value: string][] = [
    ["vintage", p("spec.vintage"), v.year === null ? p("nv") : String(v.year)],
    ["abv", p("spec.abv"), p("abvValue", { abv: format.number(v.abvPct, { maximumFractionDigits: 2 }) })],
    ["volume", p("spec.volume"), p("volumeValue", { ml: v.bottleMl })],
    ["grapes", p("spec.grapes"), wine.grapes.map((x) => (x.pct == null ? x.grape : p("grapeShare", { grape: x.grape, pct: x.pct }))).join(", ")],
    ["serving-temp", p("spec.servingTemp"), p("tempValue", { temp: wine.servingTempC })],
    ["price", p("spec.price"), p("priceValue", { price })],
  ];

  return (
    <>
      <Band tone="deep" framed>
        <Container className="grid items-center gap-12 py-16 sm:py-24 md:grid-cols-2 md:gap-16">
          <div>
            <p className="eyebrow">{t("eyebrow")}</p>
            <h1 className="mt-4 font-display text-5xl leading-tight font-semibold text-champagne sm:text-6xl">{t("title")}</h1>
            <p className="mt-2 font-display text-2xl text-on-dark sm:text-3xl">{t("lead")}</p>
            <p className="mt-6 max-w-xl text-lg text-on-dark">{t("intro")}</p>
            <p className="notice mt-6 max-w-xl" data-testid="brio-warning">
              <strong lang="vi" className="font-medium text-champagne">
                {g("warning")}
              </strong>
              {g.has("warningTranslation") && <span className="text-ivory"> — {g("warningTranslation")}</span>}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Link href="/qua-tang" className="btn btn-champagne">
                {t("giftsLink")}
              </Link>
              <Link href={QUOTE_PATH} className="btn btn-line">
                {t("quoteLink")}
              </Link>
            </div>
          </div>
          <Photo name={`wines/${BRIO_SLUG}`} alt={wine.name} className="aspect-[4/5]">
            <div role="img" aria-label={home("placeholder")} className="flex aspect-[4/5] items-end justify-center border border-on-dark/20 bg-wine">
              <div className="mb-10 h-3/5 w-1/5 rounded-t-full bg-champagne/15" />
            </div>
          </Photo>
        </Container>
      </Band>

      <Container width="text" className="py-16 text-center sm:py-24">
        <p className="eyebrow">{t("storyEyebrow")}</p>
        <p className="mt-4 font-accent text-3xl leading-snug text-wine italic">{t("quote")}</p>
        <p className="mt-6 text-left text-lg">{t("story")}</p>
      </Container>

      <Band tone="paper" labelledBy="brio-process">
        <Container className="py-16">
          <SectionHeading id="brio-process" title={t("processTitle")} />
          <ul className="mt-8 grid gap-8 md:grid-cols-3">
            {PROCESS.map((step) => (
              <li key={step} className="flex flex-col gap-4">
                <Photo name={`site/brio-${step}`} className="aspect-[4/3]">
                  <div role="img" aria-label={home("placeholder")} className="aspect-[4/3] bg-sand outline outline-1 -outline-offset-8 outline-champagne-deep/40" />
                </Photo>
                <h3 className="font-display text-xl font-semibold">{t(`process.${step}.title`)}</h3>
                <p>{t(`process.${step}.body`)}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Band>

      <Container className="grid items-start gap-10 py-16 md:grid-cols-2 md:gap-16">
        <div>
          <SectionHeading id="brio-specs" eyebrow={t("specsEyebrow")} title={t("specsTitle", { name: wine.name, vintage: v.year === null ? p("nv") : String(v.year) })} />
          <p className="mt-2 text-muted">{t("specsLead")}</p>
          <Link href={`/ruou-vang/${BRIO_SLUG}`} className="btn btn-ghost mt-6">
            {t("productLink")}
          </Link>
        </div>
        <dl className="border-t border-line" data-testid="brio-specs">
          {specs.map(([id, label, value]) => (
            <div key={id} data-spec={id} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-4 border-b border-line py-4">
              <dt className="text-sm font-medium text-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Container>

      <Band tone="wine" labelledBy="brio-cta">
        <Container className="flex flex-wrap items-center justify-between gap-8 py-16">
          <div className="max-w-2xl">
            <h2 id="brio-cta" className="font-display text-3xl font-semibold text-champagne">
              {t("ctaTitle")}
            </h2>
            <p className="mt-2 text-lg text-ivory">{t("ctaLead")}</p>
          </div>
          <Link href="/qua-tang" className="btn btn-champagne">
            {t("ctaButton")}
          </Link>
        </Container>
      </Band>
    </>
  );
}
