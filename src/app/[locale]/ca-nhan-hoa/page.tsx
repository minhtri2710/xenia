import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { QUOTE_PATH } from "@/lib/quote";

import { Band, Container, PageHero, SectionHeading } from "../page-parts";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Personalise" });
  return { title: t("nav") };
}

const OPTIONS = ["box", "logo", "card", "mix"] as const;
const PROCESS = ["listen", "select", "personalise", "deliver"] as const;
const FAQ = ["minimum", "lead", "invoice", "delivery"] as const;

/** Line icons for the options, drawn inline in the wine ink; decorative only. */
const ICONS: Record<(typeof OPTIONS)[number], React.ReactNode> = {
  box: <><rect x="3" y="8" width="18" height="13" /><path d="M3 8h18M12 8v13" /></>,
  logo: <path d="M12 3l2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9 5.5-.8z" />,
  card: <><rect x="3" y="5" width="18" height="14" /><path d="M3 5l9 7 9-7" /></>,
  mix: <path d="M4 6h16M4 12h16M4 18h10" />,
};

/** The corporate personalisation service. It names no wine and no product, so it promotes none. */
export default async function PersonalisePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("Personalise");

  return (
    <>
      <PageHero tone="olive" eyebrow={t("eyebrow")} title={t("title")} lead={t("lead")} center>
        <p className="mt-4 font-accent text-2xl text-champagne italic">{t("accent")}</p>
      </PageHero>

      <Container className="py-16">
        <SectionHeading id="personalise-options" eyebrow={t("optionsEyebrow")} title={t("optionsTitle")} />
        <ul className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4" aria-labelledby="personalise-options">
          {OPTIONS.map((option) => (
            <li key={option} className="card flex flex-col gap-3 p-6">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="square" className="text-wine" aria-hidden="true">
                {ICONS[option]}
              </svg>
              <h3 className="font-display text-xl font-semibold">{t(`options.${option}.title`)}</h3>
              <p>{t(`options.${option}.body`)}</p>
            </li>
          ))}
        </ul>
        <p className="notice mt-8 max-w-3xl" data-testid="personalise-paid">
          {t("paid")}
        </p>
      </Container>

      <Band tone="paper" labelledBy="personalise-process">
        <Container className="grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16">
          <div aria-hidden="true" className="aspect-[4/3] bg-sand outline outline-1 -outline-offset-8 outline-champagne-deep/40" />
          <div>
            <SectionHeading id="personalise-process" title={t("processTitle")} />
            <ol className="mt-6 border-t border-line">
              {PROCESS.map((step, i) => (
                <li key={step} className="flex gap-6 border-b border-line py-5">
                  <span className="step-number min-w-8" aria-hidden="true">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <h3 className="font-semibold text-ink">{t(`process.${step}.title`)}</h3>
                    <p className="mt-1 text-muted">{t(`process.${step}.body`)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </Container>
      </Band>

      <Container width="text" className="py-16">
        <SectionHeading id="personalise-faq" title={t("faqTitle")} />
        <div className="mt-6 border-t border-line" data-testid="personalise-faq">
          {FAQ.map((item) => (
            <details key={item} className="group border-b border-line">
              <summary className="flex min-h-14 cursor-pointer items-center justify-between gap-4 py-3 font-medium">
                {t(`faq.${item}.q`)}
                <span aria-hidden="true" className="text-champagne-deep transition-transform group-open:rotate-45">
                  +
                </span>
              </summary>
              <p className="pb-5 text-muted">{t(`faq.${item}.a`)}</p>
            </details>
          ))}
        </div>
      </Container>

      <Band tone="wine" labelledBy="personalise-cta">
        <Container className="flex flex-wrap items-center justify-between gap-6 py-12">
          <h2 id="personalise-cta" className="font-display text-3xl font-semibold text-champagne">
            {t("ctaTitle")}
          </h2>
          <Link href={QUOTE_PATH} className="btn btn-champagne">
            {t("ctaButton")}
          </Link>
        </Container>
      </Band>
    </>
  );
}
