import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { VND_FORMAT } from "@/lib/order-totals";
import { loadZones } from "@/lib/shop-data";

import { requireCheckout, Steps } from "../steps";
import { DeliveryForm } from "./delivery-form";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Checkout" });
  return { title: t("delivery.title") };
}

export default async function DeliveryStep({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { checkout } = await requireCheckout(locale, "delivery");
  const zones = await loadZones();
  const t = await getTranslations("Checkout");
  const z = await getTranslations("Zones");
  const format = await getFormatter();

  return (
    <section className="max-w-3xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      <Steps current="delivery" />
      <h2 className="mt-10 font-display text-3xl font-medium">{t("delivery.title")}</h2>
      <p className="mt-2">{t("delivery.toBuyer", { name: checkout!.buyer!.name, address: checkout!.buyer!.address })}</p>
      <p className="mt-4 border-l-2 border-wine pl-4" data-testid="id-check">
        {t("delivery.idCheck")}
      </p>
      <DeliveryForm
        locale={locale}
        current={checkout?.zone}
        zones={[...zones].map(([zone, fee]) => ({ zone, label: z(zone), fee: format.number(fee, VND_FORMAT) }))}
      />
    </section>
  );
}
