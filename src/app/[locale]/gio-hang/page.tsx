import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { VND_FORMAT } from "@/lib/order-totals";
import { readCart } from "@/lib/shop-data";

import { removeCartLine, updateCartLine } from "./actions";

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
    <section className="max-w-4xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      {(error === "quantity" || error === "unavailable") && (
        <p role="alert" className="mt-4 text-wine" data-testid="cart-error">
          {t(`errors.${error}`)}
        </p>
      )}

      {items.length === 0 ? (
        <div className="mt-8">
          <p>{t("empty")}</p>
          <Link href="/ruou-vang" className="mt-4 inline-block text-wine underline underline-offset-4">
            {t("browse")}
          </Link>
        </div>
      ) : (
        <>
          <ul className="mt-8 divide-y divide-ink/10 border-y border-ink/10" data-testid="cart-lines">
            {items.map((item) => (
              <li key={item.vintageId} data-vintage={item.vintageId} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto]">
                <div>
                  <Link href={`/ruou-vang/${item.slug}`} className="font-display text-2xl font-medium hover:text-wine">
                    {item.wineName}
                  </Link>
                  <p className="text-sm text-muted">
                    {item.year === null ? p("nv") : item.year} · {p("volumeValue", { ml: item.bottleMl })} ·{" "}
                    {t("unitPrice", { price: vnd(item.priceVnd) })}
                  </p>
                  <div className="mt-3 flex flex-wrap items-end gap-3">
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
                          className="w-24 border border-ink/40 bg-white px-3 py-2"
                        />
                      </label>
                      <button type="submit" className="border border-ink/40 px-4 py-2 text-sm hover:border-wine hover:text-wine">
                        {t("update")}
                      </button>
                    </form>
                    <form action={removeCartLine}>
                      <input type="hidden" name="locale" value={locale} />
                      <input type="hidden" name="vintageId" value={item.vintageId} />
                      <button type="submit" className="px-2 py-2 text-sm text-wine underline underline-offset-4">
                        {t("remove", { name: item.wineName })}
                      </button>
                    </form>
                  </div>
                </div>
                <p className="font-medium sm:text-right" data-testid="line-total">
                  {vnd(item.qty * item.priceVnd)}
                </p>
              </li>
            ))}
          </ul>
          <p className="mt-6 flex justify-between text-lg">
            <span>{t("goods")}</span>
            <span className="font-medium" data-testid="cart-goods">
              {vnd(goods)}
            </span>
          </p>
          <p className="text-sm text-muted">{t("vatNote")}</p>
          <Link href="/thanh-toan" className="mt-8 inline-block bg-wine px-6 py-3 font-medium text-ivory hover:bg-ink">
            {t("checkout")}
          </Link>
        </>
      )}
    </section>
  );
}
