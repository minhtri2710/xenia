import type { Metadata } from "next";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { Link } from "@/i18n/navigation";
import { wrapLine } from "@/lib/gift";
import { VND_FORMAT } from "@/lib/order-totals";
import { loadCards, loadPackaging } from "@/lib/shop-data";

import { Container } from "../../page-parts";
import type { GiftErrors } from "../actions";
import { CheckoutHero, requireCheckout } from "../steps";
import { GiftForm } from "./gift-form";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Checkout" });
  return { title: t("gift.title") };
}

export default async function GiftStep({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { items, checkout } = await requireCheckout(locale, "gift");
  const l = locale === "en" ? "en" : "vi";
  const t = await getTranslations("Checkout");
  const format = await getFormatter();
  const vnd = (n: number) => format.number(n, VND_FORMAT);
  const isGift = checkout!.delivery!.mode === "gift";

  const active = await loadPackaging({ activeOnly: true });
  // Offered: only packaging that fits every bottle size in the cart, with this cart's units and amount.
  const packaging = active.flatMap((p) => {
    const line = wrapLine(p, items);
    if (line === "unavailable") return [];
    return [
      {
        code: p.code,
        label: t("gift.packagingOption", { name: p.name[l], capacity: p.capacity, price: vnd(p.priceVnd) }),
        description: p.description[l],
        line: t("gift.wrapLine", { units: line.units, name: p.name[l], amount: vnd(line.units * line.unitPriceVnd) }),
      },
    ];
  });
  const cards = isGift ? (await loadCards({ activeOnly: true })).map((c) => ({ code: c.code, label: c.name[l] })) : [];

  const { invalid } = await searchParams;
  const errors: GiftErrors = {};
  if (invalid === "packaging") errors.packaging = "packagingUnavailable";
  if (invalid === "card") errors.card = "cardRequired";

  const g = checkout!.gift;
  return (
    <>
      <CheckoutHero current="gift" />
      <Container width="narrow" className="pt-10">
        <div className="card p-6 sm:p-8">
          <h2 className="font-display text-3xl font-semibold">{t("gift.title")}</h2>
          <p className="mt-2 text-muted">
            {t("gift.intro")}{" "}
            <Link href="/dich-vu-goi-qua" className="text-wine underline underline-offset-4">
              {t("gift.serviceLink")}
            </Link>
          </p>
          <GiftForm
            locale={locale}
            isGift={isGift}
            packaging={packaging}
            someHidden={packaging.length < active.length}
            cards={cards}
            initial={{
              errors,
              values: {
                packaging: g?.packaging ?? "none",
                card: g?.card ?? "",
                message: g?.message ?? "",
                sender: g?.sender ?? checkout!.buyer!.name,
                anonymous: isGift && g !== undefined && g.sender === null,
                hidePrices: g ? g.hidePrices : isGift,
              },
            }}
          />
        </div>
      </Container>
    </>
  );
}
