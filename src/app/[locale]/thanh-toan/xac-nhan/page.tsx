import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { getPathname, Link } from "@/i18n/navigation";
import { orderDigest } from "@/lib/order-digest";
import { computeTotals, VND_FORMAT } from "@/lib/order-totals";
import { loadZones } from "@/lib/shop-data";

import { requireCheckout, Steps } from "../steps";
import { ReviewForm } from "./review-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Checkout" });
  return { title: t("review.title") };
}

function Section({ title, edit, editLabel, children }: { title: string; edit: string; editLabel: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-ink/15 pt-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-2xl font-medium">{title}</h2>
        <Link href={edit} className="text-sm text-wine underline underline-offset-4">
          {editLabel}
        </Link>
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

export default async function ReviewStep({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { items, checkout } = await requireCheckout(locale, "review");
  const zones = await loadZones();
  const zone = checkout!.zone;
  const fee = zone && zones.get(zone);
  if (!zone || fee === undefined) redirect(getPathname({ href: "/thanh-toan/giao-hang", locale }));
  const buyer = checkout!.buyer!;

  const totals = computeTotals(
    items.map((i) => ({ qty: i.qty, unitPriceVnd: i.priceVnd })),
    fee,
  );
  // The digest of exactly what this page shows; placement refuses an order that differs.
  const digest = orderDigest({
    lines: items.map((i) => ({ vintageId: i.vintageId, qty: i.qty, unitPriceVnd: i.priceVnd })),
    zone,
    feeVnd: fee,
    totals,
  });
  const { changed } = await searchParams;
  const t = await getTranslations("Checkout");
  const p = await getTranslations("Product");
  const z = await getTranslations("Zones");
  const format = await getFormatter();
  const vnd = (n: number) => format.number(n, VND_FORMAT);

  return (
    <div className="max-w-3xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      <Steps current="review" />
      <p className="mt-6 text-muted">{t("review.intro")}</p>
      {changed === "1" && (
        <p role="alert" className="mt-4 border border-wine/40 p-4 text-wine" data-testid="review-changed">
          {t("review.changed")}
        </p>
      )}

      <Section title={t("review.goods")} edit="/gio-hang" editLabel={t("review.editGoods")}>
        <ul className="divide-y divide-ink/10" data-testid="review-lines">
          {items.map((i) => (
            <li key={i.vintageId} data-vintage={i.vintageId} className="flex justify-between gap-4 py-2">
              <span>
                {t("review.line", {
                  qty: i.qty,
                  name: i.wineName,
                  vintage: i.year === null ? p("nv") : String(i.year),
                  size: p("volumeValue", { ml: i.bottleMl }),
                  price: vnd(i.priceVnd),
                })}
              </span>
              <span className="font-medium">{vnd(i.qty * i.priceVnd)}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section title={t("review.buyer")} edit="/thanh-toan" editLabel={t("review.editBuyer")}>
        <p data-testid="review-buyer">
          {buyer.name} · {buyer.phone} · {buyer.email}
        </p>
      </Section>

      <Section title={t("review.delivery")} edit="/thanh-toan/giao-hang" editLabel={t("review.editDelivery")}>
        <p data-testid="review-delivery">{t("review.deliveryMethod", { zone: z(zone), address: buyer.address })}</p>
        <p className="mt-2 text-sm text-muted">{t("delivery.idCheck")}</p>
      </Section>

      <section className="mt-10 border-t border-ink/15 pt-6">
        <h2 className="font-display text-2xl font-medium">{t("review.payment")}</h2>
        <p className="mt-3">{t("review.paymentMethods")}</p>
      </section>

      <section className="mt-10 border-t border-ink/15 pt-6" aria-labelledby="totals">
        <h2 id="totals" className="font-display text-2xl font-medium">
          {t("review.totals")}
        </h2>
        <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-2" data-testid="review-totals">
          <dt>{t("totals.goods")}</dt>
          <dd data-total="goods" className="text-right">
            {vnd(totals.goodsVnd)}
          </dd>
          <dt>{t("totals.shipping")}</dt>
          <dd data-total="shipping" className="text-right">
            {vnd(totals.shippingVnd)}
          </dd>
          <dt className="text-lg font-medium">{t("totals.total")}</dt>
          <dd data-total="total" className="text-right text-lg font-medium">
            {vnd(totals.totalVnd)}
          </dd>
          <dt className="text-sm text-muted">{t("totals.vatIncluded")}</dt>
          <dd data-total="vat" className="text-right text-sm text-muted">
            {vnd(totals.vatIncludedVnd)}
          </dd>
        </dl>
      </section>

      <ReviewForm locale={locale} clientKey={checkout!.key} digest={digest} names={Object.fromEntries(items.map((i) => [i.vintageId, i.wineName]))} />
    </div>
  );
}
