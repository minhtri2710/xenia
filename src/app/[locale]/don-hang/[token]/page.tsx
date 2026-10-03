import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { isStatusToken, PAYMENT_METHODS } from "@/lib/order";
import { VND_FORMAT } from "@/lib/order-totals";
import { loadOrder } from "@/lib/shop-data";

import { Container, PageHero } from "../../page-parts";
import { payOrder } from "./actions";

type Props = {
  params: Promise<{ locale: string; token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Order" });
  // The path is the secret: keep it out of indexes and out of Referer headers.
  return { title: t("title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

export default async function OrderPage({ params, searchParams }: Props) {
  const { locale, token } = await params;
  setRequestLocale(locale);
  const order = isStatusToken(token) ? await loadOrder(token) : null;
  if (!order) notFound();

  const { payment: paymentQuery } = await searchParams;
  const t = await getTranslations("Order");
  const p = await getTranslations("Product");
  const z = await getTranslations("Zones");
  const w = await getTranslations("Checkout.delivery");
  const g = await getTranslations("Checkout.gift");
  const gift = order.gift ?? {};
  const format = await getFormatter();
  const vnd = (n: number) => format.number(n, VND_FORMAT);
  const payable = order.status === "placed" && order.payment.status !== "paid";
  const path = `/don-hang/${token}`;

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} title={t("heading", { number: order.number })} width="narrow">
        <p className="mt-4 text-lg">
          {t("statusLabel")}{" "}
          <strong className="font-medium text-wine" data-testid="order-status">
            {t(`statuses.${order.status}`)}
          </strong>
        </p>
        <p className="mt-4 text-sm">
          {t("keepLink")}{" "}
          <Link href={path} className="break-all text-wine underline underline-offset-4" data-testid="status-link">
            {path}
          </Link>
        </p>
        {order.status === "expired" && (
          <p role="status" className="notice mt-6 max-w-2xl text-wine" data-testid="payment-expired">{t("payment.expired")}</p>
        )}
      </PageHero>

      <Container width="narrow" className="grid items-start gap-6 pt-10 lg:grid-cols-2">
        {payable && (
          <section className="card border-wine/40 p-6 sm:p-8 lg:col-span-2" aria-labelledby="payment">
            <h2 id="payment" className="font-display text-2xl font-semibold">
              {t("payment.title")}
            </h2>
            {order.payment.status === "failed" && (
              <p role="alert" className="mt-3 text-wine" data-testid="payment-failed">
                {t("payment.failed")}
              </p>
            )}
            {paymentQuery === "invalid" && (
              <p role="alert" className="mt-3 text-wine">
                {t("payment.invalid")}
              </p>
            )}
            <p className="mt-3 text-sm text-muted">{t("payment.mockNote")}</p>
            <p className="mt-3 text-sm" data-testid="payment-deadline">{t("payment.deadline", { deadline: format.dateTime(new Date(order.paymentDueAt), { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Ho_Chi_Minh" }) })}</p>
            <form action={payOrder} className="mt-4 grid gap-4">
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="token" value={token} />
              <fieldset>
                <legend className="text-sm font-medium">{t("payment.method")}</legend>
                <div className="mt-3 grid gap-3">
                  {PAYMENT_METHODS.map((m, i) => (
                    <label key={m} className="flex items-center gap-3">
                      <input type="radio" name="method" value={m} defaultChecked={i === 0} required className="accent-wine" />
                      {t(`payment.methods.${m}`)}
                    </label>
                  ))}
                </div>
              </fieldset>
              <div className="flex flex-wrap gap-3">
                <button type="submit" name="outcome" value="success" className="btn btn-primary">
                  {t("payment.succeed")}
                </button>
                <button type="submit" name="outcome" value="failure" className="btn border-ink/40 hover:border-wine hover:text-wine">
                  {t("payment.fail")}
                </button>
              </div>
            </form>
          </section>
        )}

        <section className="card p-6 sm:p-8 lg:col-span-2" aria-labelledby="lines">
          <h2 id="lines" className="font-display text-2xl font-semibold">
            {t("lines")}
          </h2>
          <ul className="mt-3 divide-y divide-line" data-testid="order-lines">
            {order.lines.map((l) => (
              <li key={l.id} className="flex justify-between gap-4 py-2">
                <span>
                  {t("line", {
                    qty: l.qty,
                    name: locale === "en" ? l.wineNameEn : l.wineNameVi,
                    vintage: l.year == null ? p("nv") : String(l.year),
                    size: p("volumeValue", { ml: l.bottleMl }),
                    abv: format.number(l.abvPct, { maximumFractionDigits: 2 }),
                    price: vnd(l.unitPriceVnd),
                  })}
                </span>
                <span className="font-medium">{vnd(l.qty * l.unitPriceVnd)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="card bg-paper p-6 sm:p-8" aria-labelledby="order-totals">
          <h2 id="order-totals" className="font-display text-2xl font-semibold">
            {t("totals")}
          </h2>
          <dl className="mt-3 grid grid-cols-[1fr_auto] gap-y-2" data-testid="order-totals-list">
            <dt>{t("goods")}</dt>
            <dd data-total="goods" className="text-right">
              {vnd(order.totals.goodsVnd)}
            </dd>
            <dt>{t("wrap")}</dt>
            <dd data-total="wrap" className="text-right">
              {vnd(order.totals.wrapVnd)}
            </dd>
            <dt>{t("shipping")}</dt>
            <dd data-total="shipping" className="text-right">
              {vnd(order.totals.shippingVnd)}
            </dd>
            <dt className="border-t border-line pt-3 text-lg font-medium">{t("total")}</dt>
            <dd data-total="total" className="border-t border-line pt-3 text-right font-display text-2xl font-semibold">
              {vnd(order.totals.totalVnd)}
            </dd>
            <dt className="text-sm text-muted">{t("vatIncluded")}</dt>
            <dd data-total="vat" className="text-right text-sm text-muted">
              {vnd(order.totals.vatIncludedVnd)}
            </dd>
          </dl>
        </section>

        <section className="card p-6 sm:p-8" aria-labelledby="delivery">
          <h2 id="delivery" className="font-display text-2xl font-semibold">
            {t("delivery")}
          </h2>
          <p className="mt-3" data-testid="order-delivery">
            {order.delivery.mode === "gift" && order.delivery.recipient
              ? t("deliveryGift", {
                  name: order.delivery.recipient.name ?? "",
                  phone: order.delivery.recipient.phone ?? "",
                  address: order.delivery.recipient.address ?? "",
                  zone: z(order.delivery.zone),
                })
              : t("deliveryTo", { name: order.buyer.name, address: order.buyer.address, zone: z(order.delivery.zone) })}
          </p>
          <p className="mt-2" data-testid="order-date">
            {t("deliveryTime", {
              date: format.dateTime(new Date(`${order.delivery.date}T00:00:00Z`), { dateStyle: "full", timeZone: "UTC" }),
              window: w(`windows.${order.delivery.window}`),
            })}
          </p>
          <p className="mt-2 text-sm text-muted">{order.delivery.mode === "gift" ? w("recipient.idCheck") : t("idCheck")}</p>
        </section>

        <section className="card p-6 sm:p-8 lg:col-span-2" aria-labelledby="gift">
          <h2 id="gift" className="font-display text-2xl font-semibold">
            {t("gift")}
          </h2>
          <p className="mt-3" data-testid="order-wrap">
            {gift.packagingCode
              ? t("wrapLine", {
                  units: gift.packagingUnits ?? 0,
                  name: (locale === "en" ? gift.packagingNameEn : gift.packagingNameVi) ?? "",
                  amount: vnd(order.totals.wrapVnd),
                })
              : t("noWrap")}
          </p>
          {gift.cardCode && (
            <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2" data-testid="order-gift">
              <dt className="text-muted">{g("card")}</dt>
              <dd>{locale === "en" ? gift.cardNameEn : gift.cardNameVi}</dd>
              <dt className="text-muted">{g("message")}</dt>
              <dd className="whitespace-pre-line break-words">{gift.message || t("noMessage")}</dd>
              <dt className="text-muted">{g("sender")}</dt>
              <dd>{gift.anonymous ? g("anonymous") : gift.sender}</dd>
              <dt className="text-muted">{g("hidePrices")}</dt>
              <dd>{gift.hidePrices ? t("yes") : t("no")}</dd>
            </dl>
          )}
        </section>
      </Container>
    </>
  );
}
