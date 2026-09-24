import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { getPathname, Link } from "@/i18n/navigation";
import { reviewOrder } from "@/lib/order-review";
import { VND_FORMAT } from "@/lib/order-totals";
import { loadCards, loadDeliverySettings, loadPackaging } from "@/lib/shop-data";

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
  const { buyer, delivery, gift, clientKey } = checkout! as Required<NonNullable<typeof checkout>>;
  const settings = await loadDeliverySettings();
  const isGift = delivery.mode === "gift";
  // Exactly what placement will compute and store; its digest binds the consent to this page.
  const review = reviewOrder({
    lines: items.map((i) => ({ vintageId: i.vintageId, qty: i.qty, unitPriceVnd: i.priceVnd, bottleMl: i.bottleMl })),
    buyer,
    delivery,
    gift,
    zone: settings.zones.get(delivery.zone),
    blackoutDates: settings.blackoutDates,
    packaging: gift.packaging === null ? undefined : (await loadPackaging({ code: gift.packaging }))[0],
    card: isGift && gift.card !== null ? (await loadCards({ code: gift.card }))[0] : undefined,
    now: new Date(),
  });
  if (!review.ok) {
    const step = review.step === "delivery" ? "/thanh-toan/giao-hang" : "/thanh-toan/goi-qua";
    redirect(getPathname({ href: `${step}?invalid=${review.error}`, locale }));
  }
  const { totals, wrap, card, digest } = review;
  const l = locale === "en" ? "en" : "vi";
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
        <p data-testid="review-delivery">
          {delivery.recipient
            ? t("review.deliveryGift", { zone: z(delivery.zone), name: delivery.recipient.name, phone: delivery.recipient.phone, address: delivery.recipient.address })
            : t("review.deliveryMethod", { zone: z(delivery.zone), address: buyer.address })}
        </p>
        <p className="mt-2" data-testid="review-date">
          {t("review.deliveryTime", {
            date: format.dateTime(new Date(`${delivery.date}T00:00:00Z`), { dateStyle: "full", timeZone: "UTC" }),
            window: t(`delivery.windows.${delivery.window}`),
          })}
        </p>
        <p className="mt-2 text-sm text-muted" data-testid="review-id-check">
          {isGift ? t("delivery.recipient.idCheck") : t("delivery.idCheck")}
        </p>
      </Section>

      <Section title={t("review.gift")} edit="/thanh-toan/goi-qua" editLabel={t("review.editGift")}>
        <p data-testid="review-wrap">
          {wrap ? t("review.wrapLine", { units: wrap.units, name: l === "en" ? wrap.nameEn : wrap.nameVi, amount: vnd(wrap.units * wrap.unitPriceVnd) }) : t("review.noWrap")}
        </p>
        {card && (
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2" data-testid="review-gift">
            <dt className="text-muted">{t("gift.card")}</dt>
            <dd data-gift="card">{card.name[l]}</dd>
            <dt className="text-muted">{t("gift.message")}</dt>
            <dd data-gift="message" className="whitespace-pre-line break-words">
              {gift.message || t("review.noMessage")}
            </dd>
            <dt className="text-muted">{t("gift.sender")}</dt>
            <dd data-gift="sender">{gift.sender ?? t("gift.anonymous")}</dd>
            <dt className="text-muted">{t("gift.hidePrices")}</dt>
            <dd data-gift="hide-prices">{gift.hidePrices ? t("review.yes") : t("review.no")}</dd>
          </dl>
        )}
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
          <dt>{t("totals.wrap")}</dt>
          <dd data-total="wrap" className="text-right">
            {vnd(totals.wrapVnd)}
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

      <ReviewForm locale={locale} clientKey={clientKey} digest={digest} names={Object.fromEntries(items.map((i) => [i.vintageId, i.wineName]))} />
    </div>
  );
}
