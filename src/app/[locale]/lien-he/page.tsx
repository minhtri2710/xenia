import type { Metadata } from "next";
import { connection } from "next/server";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { PRICE_BANDS } from "@/lib/catalogue";
import { MAX_QUANTITY, MAX_QUOTE_MESSAGE_CODE_POINTS, QUOTE_OCCASIONS, QUOTE_PATH } from "@/lib/quote";
import { loadSiteSettings } from "@/lib/shop-data";

import { Container, PageHero, SectionHeading } from "../page-parts";
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

const NEXT = ["read", "propose", "confirm"] as const;

/** Contact and corporate gift quote requests. The request is stored in `quote-requests` (admin-only). */
export default async function QuotePage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  await connection();
  const { sent } = await searchParams;
  const t = await getTranslations("Quote");
  const c = await getTranslations("Catalogue");
  const owner = (await loadSiteSettings()).owner;

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} />
      <Container className="grid grid-cols-1 items-start gap-10 pt-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-16">
        <div className="grid gap-10">
          <section aria-labelledby="quote-next">
            <SectionHeading id="quote-next" title={t("nextTitle")} size="md" />
            <ol className="mt-6 grid gap-0 border-t border-line">
              {NEXT.map((step, i) => (
                <li key={step} className="flex gap-6 border-b border-line py-5">
                  <span className="step-number min-w-8" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p>{t(`next.${step}`)}</p>
                </li>
              ))}
            </ol>
          </section>
          <section aria-labelledby="quote-contact" className="card p-6 sm:p-8">
            <h2 id="quote-contact" className="eyebrow">
              {t("contactTitle")}
            </h2>
            <p className="mt-4">
              <a className="break-all text-wine underline underline-offset-4" href={`mailto:${owner?.contactEmail}`}>
                {owner?.contactEmail}
              </a>
            </p>
            <p className="mt-2">
              <a className="text-wine underline underline-offset-4" href={`tel:${owner?.contactPhone}`}>
                {owner?.contactPhone}
              </a>
            </p>
          </section>
        </div>

        <section aria-labelledby="quote-form-title" className="card p-6 sm:p-8">
          <h2 id="quote-form-title" className="font-display text-3xl font-semibold">
            {t("formTitle")}
          </h2>
          {sent === "1" ? (
            <div className="mt-6">
              <p role="status" className="notice" data-testid="quote-sent">
                {t("sent")}
              </p>
              <Link href={QUOTE_PATH} className="btn btn-primary mt-6">
                {t("sendAnother")}
              </Link>
            </div>
          ) : (
            <QuoteForm
              locale={locale}
              occasions={QUOTE_OCCASIONS.map((o) => ({ value: o, label: t(`occasions.${o}`) }))}
              budgets={PRICE_BANDS.map((b) => ({ value: b.id, label: c(`priceBands.${b.id}`) }))}
              maxQuantity={MAX_QUANTITY}
              maxMessage={MAX_QUOTE_MESSAGE_CODE_POINTS}
            />
          )}
        </section>
      </Container>
    </>
  );
}
