import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { getPathname, Link } from "@/i18n/navigation";
import type { Checkout } from "@/lib/checkout";
import { readCart, readCheckout } from "@/lib/shop-data";

import { PageHero } from "../page-parts";

const STEPS = [
  { key: "buyer", href: "/thanh-toan" },
  { key: "delivery", href: "/thanh-toan/giao-hang" },
  { key: "gift", href: "/thanh-toan/goi-qua" },
  { key: "review", href: "/thanh-toan/xac-nhan" },
] as const;

type Step = (typeof STEPS)[number]["key"];

/**
 * The cart and checkout state a step needs, or a redirect to where the visitor must go first:
 * an empty cart to `/gio-hang`, else the first earlier step the draft does not complete (buyer,
 * delivery, gift options).
 */
export async function requireCheckout(locale: string, step: Step) {
  const items = await readCart(locale === "en" ? "en" : "vi");
  if (items.length === 0) redirect(getPathname({ href: "/gio-hang", locale }));
  const checkout: Checkout | null = await readCheckout();
  const done = { buyer: !!checkout?.buyer, delivery: !!checkout?.delivery, gift: !!checkout?.gift };
  const index = STEPS.findIndex((s) => s.key === step);
  const missing = STEPS.slice(0, index).find((s) => s.key !== "review" && !done[s.key]);
  if (missing) redirect(getPathname({ href: missing.href, locale }));
  return { items, checkout };
}

export async function Steps({ current }: { current: Step }) {
  const t = await getTranslations("Checkout.steps");
  const index = STEPS.findIndex((s) => s.key === current);
  return (
    <nav aria-label={t("label")} className="mt-8 w-full">
      <ol className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.key} className={`flex flex-col gap-1 border-t pt-3 ${i <= index ? "border-wine" : "border-line"} ${i === index ? "font-medium text-wine" : "text-muted"}`}>
            <span className="step-number" aria-hidden="true">
              {String(i + 1).padStart(2, "0")}
            </span>
            {i < index ? (
              <Link href={s.href} className="underline underline-offset-4 hover:text-wine">
                {t(s.key)}
              </Link>
            ) : (
              <span aria-current={i === index ? "step" : undefined}>{t(s.key)}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/** The top of every checkout step: the step counter, the checkout title and the four steps. */
export async function CheckoutHero({ current }: { current: Step }) {
  const t = await getTranslations("Checkout");
  const index = STEPS.findIndex((s) => s.key === current);
  return (
    <PageHero eyebrow={t("steps.counter", { current: index + 1, total: STEPS.length })} title={t("title")} width="narrow">
      <Steps current={current} />
    </PageHero>
  );
}
