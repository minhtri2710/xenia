import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { VND_FORMAT } from "@/lib/order-totals";
import { readCart } from "@/lib/shop-data";

import { removeCartLine, updateCartLine } from "./actions";

import { Container, PageHero } from "../page-parts";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Cart" });
  return { title: t("title") };
}

export default async function CartPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { error } = await searchParams;
  const items = await readCart(locale === "en" ? "en" : "vi");
  const t = await getTranslations("Cart");
  const p = await getTranslations("Product");
  const format = await getFormatter();
  const vnd = (n: number) => format.number(n, VND_FORMAT);
  const goods = items.reduce((sum, i) => sum + i.qty * i.priceVnd, 0);

  return (
    <>
      <PageHero eyebrow={t("eyebrow")} title={t("title")}>
        {(error === "quantity" || error === "unavailable") && (
          <p role="alert" className="notice mt-6 max-w-2xl text-wine" data-testid="cart-error">
            {t(`errors.${error}`)}
          </p>
        )}
      </PageHero>

      <Container className="pt-10">
        {items.length === 0 ? (
          <div className="card max-w-2xl p-8">
            <p className="text-lg">{t("empty")}</p>
            <Link href="/ruou-vang" className="btn btn-primary mt-6">
              {t("browse")}
            </Link>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
            <ul className="grid gap-4 self-start" data-testid="cart-lines">
              {items.map((item) => (
                <li key={item.vintageId} data-vintage={item.vintageId} className="card grid gap-4 p-6 sm:grid-cols-[1fr_auto]">
                  <div>
                    <Link href={`/ruou-vang/${item.slug}`} className="font-display text-2xl font-semibold text-wine hover:text-wine-deep hover:underline">
                      {item.wineName}
                    </Link>
                    <p className="mt-1 text-sm text-muted">
                      {item.year === null ? p("nv") : item.year} · {p("volumeValue", { ml: item.bottleMl })} ·{" "}
                      {t("unitPrice", { price: vnd(item.priceVnd) })}
                    </p>
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <form action={updateCartLine} className="flex items-end gap-2">
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="vintageId" value={item.vintageId} />
                        <label className="grid gap-1 text-sm">
                          {t("quantity")}
                          <input
                            name="qty"
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={item.stock}
                            step={1}
                            required
                            defaultValue={item.qty}
                            className="min-h-11 w-24 border border-ink/40 bg-raised px-3 py-2"
                          />
                        </label>
                        <button type="submit" className="min-h-11 border border-ink/40 px-4 py-2 text-sm hover:border-wine hover:text-wine">
                          {t("update")}
                        </button>
                      </form>
                      <form action={removeCartLine}>
                        <input type="hidden" name="locale" value={locale} />
                        <input type="hidden" name="vintageId" value={item.vintageId} />
                        <button type="submit" className="min-h-11 px-2 py-2 text-sm text-wine underline underline-offset-4">
                          {t("remove", { name: item.wineName })}
                        </button>
                      </form>
                    </div>
                  </div>
                  <p className="font-display text-xl font-semibold sm:text-right" data-testid="line-total">
                    {vnd(item.qty * item.priceVnd)}
                  </p>
                </li>
              ))}
            </ul>

            <aside aria-labelledby="cart-summary" className="card self-start p-6 sm:p-8">
              <h2 id="cart-summary" className="eyebrow">
                {t("summary")}
              </h2>
              <p className="mt-4 flex justify-between gap-4 text-lg">
                <span>{t("goods")}</span>
                <span className="font-display text-2xl font-semibold" data-testid="cart-goods">
                  {vnd(goods)}
                </span>
              </p>
              <p className="mt-1 text-sm text-muted">{t("vatNote")}</p>
              <Link href="/thanh-toan" className="btn btn-primary mt-6 w-full">
                {t("checkout")}
              </Link>
            </aside>
          </div>
        )}
      </Container>
    </>
  );
}
