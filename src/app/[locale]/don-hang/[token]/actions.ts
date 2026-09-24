"use server";

import config from "@payload-config";
import { notFound, redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { getPayload } from "payload";

import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { isPaymentMethod, isStatusToken } from "@/lib/order";

/**
 * The mock payment (Law 44/2019 Art. 16.4: cashless only). No provider, no key, no network call,
 * no card or account number: the buyer picks a method and a simulated outcome. Success marks a
 * placed order paid; failure records the attempt and leaves the order placed, so the buyer can retry.
 * Stock was reserved at placement and stays reserved after a failure.
 */
export async function payOrder(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const method = formData.get("method");
  const outcome = formData.get("outcome");
  const locale = hasLocale(routing.locales, formData.get("locale")) ? (formData.get("locale") as string) : routing.defaultLocale;
  if (!isStatusToken(token)) notFound();
  const back = getPathname({ href: `/don-hang/${token}`, locale });
  if (!isPaymentMethod(method) || (outcome !== "success" && outcome !== "failure")) {
    redirect(`${back}?payment=invalid`);
  }

  const payload = await getPayload({ config });
  await payload.update({
    collection: "orders",
    where: { and: [{ token: { equals: token } }, { status: { equals: "placed" } }, { "payment.status": { not_equals: "paid" } }] },
    data:
      outcome === "success"
        ? { status: "paid", payment: { method, status: "paid", paidAt: new Date().toISOString() } }
        : { payment: { method, status: "failed" } },
    depth: 0,
  });
  redirect(back);
}
