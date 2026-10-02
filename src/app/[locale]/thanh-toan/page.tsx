import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { currentCustomer } from "@/lib/account-data";

import { Container } from "../page-parts";
import { BuyerForm } from "./buyer-form";
import { CheckoutHero, requireCheckout } from "./steps";

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
  // A signed-in buyer starts from the profile and the account email; every field stays editable
  // and the date of birth is asked again on every order.
  const account = await currentCustomer();
  const buyer =
    checkout?.buyer ?? (account ? { name: account.name ?? "", phone: account.phone ?? "", email: account.email, address: account.address ?? "" } : undefined);

  return (
    <>
      <CheckoutHero current="buyer" />
      <Container width="narrow" className="pt-10">
        <div className="card p-6 sm:p-8">
          <h2 className="font-display text-3xl font-semibold">{t("buyer.title")}</h2>
          <p className="mt-2 text-muted">{t("buyer.intro")}</p>
          <BuyerForm locale={locale} buyer={buyer} />
        </div>
      </Container>
    </>
  );
}
