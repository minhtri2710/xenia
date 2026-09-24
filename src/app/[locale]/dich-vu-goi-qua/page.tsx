import type { Metadata } from "next";
import { connection } from "next/server";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { MAX_MESSAGE_CODE_POINTS } from "@/lib/gift";
import { VND_FORMAT } from "@/lib/order-totals";
import { loadCards, loadPackaging } from "@/lib/shop-data";

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
    <div className="max-w-3xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      <p className="mt-4 text-lg">{t("intro")}</p>
      <p className="mt-4 border-l-2 border-wine pl-4" data-testid="paid-service">
        {t("paid")}
      </p>

      <section className="mt-10" aria-labelledby="packaging">
        <h2 id="packaging" className="font-display text-3xl font-medium">
          {t("packaging")}
        </h2>
        <ul className="mt-4 grid gap-6" data-testid="service-packaging">
          {packaging.map((p) => (
            <li key={p.code} data-packaging={p.code} className="flex gap-4">
              <span className={`packaging-swatch packaging-${p.code}`} aria-hidden="true" />
              <div>
                <h3 className="font-medium">{p.name[l]}</h3>
                <p className="text-sm text-muted">{p.description[l]}</p>
                <p className="mt-1 text-sm">
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
      </section>

      <section className="mt-10" aria-labelledby="cards">
        <h2 id="cards" className="font-display text-3xl font-medium">
          {t("cards")}
        </h2>
        <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4" data-testid="service-cards">
          {cards.map((c) => (
            <li key={c.code} data-card={c.code} className="grid gap-2">
              <span className={`card-preview card-${c.code}`} aria-hidden="true" />
              {c.name[l]}
            </li>
          ))}
        </ul>
        <p className="mt-4">{t("message", { max: MAX_MESSAGE_CODE_POINTS })}</p>
        <p className="mt-2">{t("sender")}</p>
        <p className="mt-2">{t("hidePrices")}</p>
      </section>

      <section className="mt-10" aria-labelledby="recipient">
        <h2 id="recipient" className="font-display text-3xl font-medium">
          {t("recipientTitle")}
        </h2>
        <p className="mt-4 border-l-2 border-wine pl-4" data-testid="service-recipient-rule">
          {t("recipient")}
        </p>
        <p className="mt-2">{t("delivery")}</p>
      </section>
    </div>
  );
}
