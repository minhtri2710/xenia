import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { MAX_MESSAGE_CODE_POINTS } from "@/lib/gift";
import { VND_FORMAT } from "@/lib/order-totals";
import { loadCards, loadPackaging } from "@/lib/shop-data";

import { Band, Container, PageHero, SectionHeading } from "../page-parts";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "GiftService" });
  return { title: t("title") };
}

/** The gift service: packaging, cards and the rules. No wine and no product appears here. */
export default async function GiftServicePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Rendered per request from the Local API, never prerendered at build.
  await connection();
  const l = locale === "en" ? "en" : "vi";
  const t = await getTranslations("GiftService");
  const format = await getFormatter();
  const [packaging, cards] = await Promise.all([loadPackaging({ activeOnly: true }), loadCards({ activeOnly: true })]);

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} title={t("title")} lead={t("intro")}>
        <p className="notice mt-6 max-w-2xl" data-testid="paid-service">
          {t("paid")}
        </p>
      </PageHero>

      <Container className="py-16">
        <SectionHeading id="packaging" title={t("packaging")} />
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3" data-testid="service-packaging" aria-labelledby="packaging">
          {packaging.map((p) => (
            <li key={p.code} data-packaging={p.code} className="card flex gap-4 p-6">
              <span className={`packaging-swatch packaging-${p.code}`} aria-hidden="true" />
              <div>
                <h3 className="font-display text-xl font-semibold">{p.name[l]}</h3>
                <p className="mt-1 text-sm text-muted">{p.description[l]}</p>
                <p className="mt-3 text-sm">
                  {t("packagingFacts", {
                    capacity: p.capacity,
                    sizes: p.fits.map((ml) => format.number(ml)).join(", "),
                    price: format.number(p.priceVnd, VND_FORMAT),
                  })}
                </p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted">{t("units")}</p>
      </Container>

      <Band tone="paper" labelledBy="cards">
        <Container className="grid gap-10 py-16 lg:grid-cols-2 lg:gap-16">
          <div>
            <SectionHeading id="cards" title={t("cards")} />
            <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2" data-testid="service-cards">
              {cards.map((c) => (
                <li key={c.code} data-card={c.code} className="grid gap-2">
                  <span className={`card-preview card-${c.code}`} aria-hidden="true" />
                  {c.name[l]}
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3 lg:pt-14">
            <p>{t("message", { max: MAX_MESSAGE_CODE_POINTS })}</p>
            <p>{t("sender")}</p>
            <p>{t("hidePrices")}</p>
          </div>
        </Container>
      </Band>

      <Band tone="olive" labelledBy="recipient">
        <Container className="py-16">
          <SectionHeading id="recipient" title={<span className="text-ivory">{t("recipientTitle")}</span>} />
          <p className="notice mt-6 max-w-3xl" data-testid="service-recipient-rule">
            {t("recipient")}
          </p>
          <p className="mt-4 max-w-3xl">{t("delivery")}</p>
        </Container>
      </Band>
    </>
  );
}
