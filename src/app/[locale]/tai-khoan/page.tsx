import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import { getPathname, Link } from "@/i18n/navigation";
import { currentCustomer, loadOrdersOf } from "@/lib/account-data";
import { ACCOUNT_ROUTES } from "@/lib/accounts";
import { VND_FORMAT } from "@/lib/order-totals";

import { DeleteForm, PasswordForm, ProfileForm, SignOutForm } from "./account-forms";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account.page" });
  return { title: t("title"), robots: { index: false, follow: false } };
}

export default async function AccountPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const customer = await currentCustomer();
  if (!customer) redirect(getPathname({ href: ACCOUNT_ROUTES.signIn, locale }));
  const orders = await loadOrdersOf(customer);
  const t = await getTranslations("Account.page");
  const s = await getTranslations("Order.statuses");
  const format = await getFormatter();

  return (
    <div className="max-w-3xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      <p className="mt-2 text-muted" data-testid="account-email">
        {t("signedInAs", { email: customer.email })}
      </p>

      <section className="mt-10 border-t border-ink/15 pt-6" aria-labelledby="account-profile">
        <h2 id="account-profile" className="font-display text-2xl font-medium">
          {t("profile.title")}
        </h2>
        <ProfileForm locale={locale} profile={{ name: customer.name ?? "", phone: customer.phone ?? "", address: customer.address ?? "" }} />
      </section>

      <section className="mt-10 border-t border-ink/15 pt-6" aria-labelledby="account-orders">
        <h2 id="account-orders" className="font-display text-2xl font-medium">
          {t("orders.title")}
        </h2>
        {orders.length === 0 ? (
          <p className="mt-3 text-muted" data-testid="account-no-orders">
            {t("orders.none")}
          </p>
        ) : (
          <ul className="mt-3 divide-y divide-ink/10" data-testid="account-orders">
            {orders.map((order) => (
              <li key={order.id} data-order={order.number} className="flex flex-wrap justify-between gap-4 py-2">
                <Link href={`/don-hang/${order.token}`} className="text-wine underline underline-offset-4">
                  {order.number}
                </Link>
                <span>{s(order.status)}</span>
                <span>{format.number(order.totals.totalVnd, VND_FORMAT)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10 border-t border-ink/15 pt-6" aria-labelledby="account-password">
        <h2 id="account-password" className="font-display text-2xl font-medium">
          {t("password.title")}
        </h2>
        <PasswordForm locale={locale} />
      </section>

      <section className="mt-10 border-t border-ink/15 pt-6" aria-labelledby="account-sign-out">
        <h2 id="account-sign-out" className="font-display text-2xl font-medium">
          {t("signOut")}
        </h2>
        <SignOutForm locale={locale} />
      </section>

      <section className="mt-10 border-t border-ink/15 pt-6" aria-labelledby="account-delete">
        <h2 id="account-delete" className="font-display text-2xl font-medium">
          {t("delete.title")}
        </h2>
        <DeleteForm locale={locale} />
      </section>
    </div>
  );
}
