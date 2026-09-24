import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { BuyerForm } from "./buyer-form";
import { requireCheckout, Steps } from "./steps";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Checkout" });
  return { title: t("title") };
}

export default async function BuyerStep({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { checkout } = await requireCheckout(locale, "buyer");
  const t = await getTranslations("Checkout");

  return (
    <section className="max-w-3xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      <Steps current="buyer" />
      <h2 className="mt-10 font-display text-3xl font-medium">{t("buyer.title")}</h2>
      <p className="mt-2 text-muted">{t("buyer.intro")}</p>
      <BuyerForm locale={locale} buyer={checkout?.buyer} />
    </section>
  );
}
