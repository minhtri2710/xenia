import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { PRICE_BANDS } from "@/lib/catalogue";
import { MAX_QUANTITY, MAX_QUOTE_MESSAGE_CODE_POINTS, QUOTE_OCCASIONS, QUOTE_PATH } from "@/lib/quote";
import { loadSiteSettings } from "@/lib/shop-data";

import { Container } from "../page-parts";
import { QuoteForm } from "./quote-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Quote" });
  return { title: t("nav") };
}

/**
 * Contact and corporate gift quote requests, as in the design: the heading and a framed contact card
 * beside the form. The request is stored in `quote-requests` (admin-only).
 */
export default async function QuotePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await connection();
  const { sent } = await searchParams;
  const t = await getTranslations("Quote");
  const c = await getTranslations("Catalogue");
  const owner = (await loadSiteSettings()).owner;

  return (
    <Container className="grid grid-cols-1 items-start gap-10 py-16 lg:grid-cols-2 lg:gap-16">
      <div>
        <p className="eyebrow">{t("eyebrow")}</p>
        <h1 className="mt-3 font-display text-4xl leading-tight font-semibold">{t("title")}</h1>
        <p className="mt-4 max-w-xl text-lg">{t("lead")}</p>
        <section aria-labelledby="quote-contact" className="dark framed mt-8 bg-wine text-ivory">
          <div className="frame grid gap-5 p-6 sm:p-8">
            <h2 id="quote-contact" className="font-accent text-3xl text-champagne italic">
              {t("accent")}
            </h2>
            <dl className="grid gap-5">
              <div className="grid gap-1">
                <dt className="eyebrow">{t("hotline")}</dt>
                <dd>
                  <a className="text-ivory underline decoration-champagne/50 underline-offset-4 hover:text-champagne" href={`tel:${owner?.contactPhone}`}>
                    {owner?.contactPhone}
                  </a>
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="eyebrow">{t("emailLabel")}</dt>
                <dd>
                  <a className="break-all text-ivory underline decoration-champagne/50 underline-offset-4 hover:text-champagne" href={`mailto:${owner?.contactEmail}`}>
                    {owner?.contactEmail}
                  </a>
                </dd>
              </div>
              <div className="grid gap-1">
                <dt className="eyebrow">{t("office")}</dt>
                <dd>{owner?.headOffice}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>

      <section aria-labelledby="quote-form-title" className="card p-6 sm:p-8">
        {sent === "1" ? (
          <div role="status" className="flex flex-col items-center gap-3 py-8 text-center" data-testid="quote-sent">
            <p className="eyebrow">{t("sentEyebrow")}</p>
            <h2 id="quote-form-title" className="font-display text-3xl font-semibold">
              {t("sentTitle")}
            </h2>
            <p className="max-w-md">{t("sent")}</p>
            <Link href={QUOTE_PATH} className="btn btn-ghost mt-4">
              {t("sendAnother")}
            </Link>
          </div>
        ) : (
          <>
            <h2 id="quote-form-title" className="font-display text-2xl font-semibold">
              {t("formTitle")}
            </h2>
            <QuoteForm
              locale={locale}
              occasions={QUOTE_OCCASIONS.map((o) => ({ value: o, label: t(`occasions.${o}`) }))}
              budgets={PRICE_BANDS.map((b) => ({ value: b.id, label: c(`priceBands.${b.id}`) }))}
              maxQuantity={MAX_QUANTITY}
              maxMessage={MAX_QUOTE_MESSAGE_CODE_POINTS}
            />
          </>
        )}
      </section>
    </Container>
  );
}
