import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { DATE_ERRORS, deliveryRange } from "@/lib/delivery";
import { VND_FORMAT } from "@/lib/order-totals";
import { loadDeliverySettings } from "@/lib/shop-data";

import { type DeliveryErrors } from "../actions";
import { requireCheckout, Steps } from "../steps";
import { DeliveryForm } from "./delivery-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Checkout" });
  return { title: t("delivery.title") };
}

export default async function DeliveryStep({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { checkout } = await requireCheckout(locale, "delivery");
  const settings = await loadDeliverySettings();
  const t = await getTranslations("Checkout");
  const z = await getTranslations("Zones");
  const format = await getFormatter();
  const now = new Date();
  const zones = [...settings.zones].map(([zone, { feeVnd, leadDays }]) => ({ zone, label: z(zone), fee: format.number(feeVnd, VND_FORMAT), ...deliveryRange(now, leadDays) }));
  const earliest = zones.map((o) => o.earliest).sort()[0] ?? "";
  const latest = zones.map((o) => o.latest).sort().at(-1) ?? "";

  // Placement or the review sent the visitor back: the stored date or zone is no longer valid.
  const { invalid } = await searchParams;
  const errors: DeliveryErrors = {};
  if (invalid === "zone") errors.zone = "zoneRequired";
  const dateError = DATE_ERRORS.find((e) => e === invalid);
  if (dateError) errors.date = dateError;

  const d = checkout!.delivery;
  const buyer = checkout!.buyer!;
  return (
    <section className="max-w-3xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      <Steps current="delivery" />
      <h2 className="mt-10 font-display text-3xl font-medium">{t("delivery.title")}</h2>
      <DeliveryForm
        locale={locale}
        buyer={t("delivery.toBuyer", { name: buyer.name, address: buyer.address })}
        zones={zones}
        range={{ min: earliest, max: latest }}
        initial={{
          errors,
          values: {
            zone: d?.zone ?? "",
            mode: d?.mode ?? "self",
            recipientName: d?.recipient?.name ?? "",
            recipientPhone: d?.recipient?.phone ?? "",
            recipientAddress: d?.recipient?.address ?? "",
            date: d?.date ?? earliest,
            window: d?.window ?? "",
          },
        }}
      />
    </section>
  );
}
