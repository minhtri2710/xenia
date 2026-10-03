import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { BRIO_SLUG, isBrioPromotable } from "@/lib/brio";
import { loadWine } from "@/lib/catalogue-data";
import { QUOTE_PATH } from "@/lib/quote";
import { selectVintage } from "@/lib/vintage-selection";

import { Band, Container, PageHero, SectionHeading } from "../page-parts";

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
      <PageHero tone="wine" eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")}>
        <p className="notice mt-6 max-w-2xl" data-testid="brio-warning">
          <strong lang="vi" className="font-medium text-champagne">
            {g("warning")}
          </strong>
          {g.has("warningTranslation") && <span className="text-ivory"> — {g("warningTranslation")}</span>}
        </p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link href={`/ruou-vang/${BRIO_SLUG}`} className="btn btn-champagne">
            {t("productLink")}
          </Link>
          <Link href={QUOTE_PATH} className="btn btn-line">
            {t("quoteLink")}
          </Link>
        </div>
      </PageHero>

      <Container width="text" className="py-16 text-center">
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
                <div role="img" aria-label={home("placeholder")} className="aspect-[4/3] bg-sand outline outline-1 -outline-offset-8 outline-champagne-deep/40" />
                <h3 className="font-display text-xl font-semibold">{t(`process.${step}.title`)}</h3>
                <p>{t(`process.${step}.body`)}</p>
              </li>
            ))}
          </ul>
        </Container>
      </Band>

      <Container className="grid gap-10 py-16 md:grid-cols-2 md:gap-16">
        <SectionHeading id="brio-specs" eyebrow={t("specsEyebrow")} title={t("specsTitle")} />
        <dl className="border-t border-line" data-testid="brio-specs">
          {specs.map(([id, label, value]) => (
            <div key={id} data-spec={id} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)] gap-4 border-b border-line py-3">
              <dt className="text-muted">{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
      </Container>
    </>
  );
}
