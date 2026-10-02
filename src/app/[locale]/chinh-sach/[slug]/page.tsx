import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getFormatter, getTranslations, setRequestLocale } from "next-intl/server";

import {
  ACCOUNT_COOKIE, LOCK_MINUTES, MAX_LOGIN_ATTEMPTS, OUTBOX_TTL_HOURS, PASSWORD_MAX_CODE_POINTS, PASSWORD_MIN_CODE_POINTS, RESET_EXPIRY_MINUTES, SESSION_SECONDS,
} from "@/lib/accounts";
import { LEGAL_AGE } from "@/lib/age";
import { AGE_COOKIE } from "@/lib/gate";
import { DELIVERY_WINDOWS, HORIZON_DAYS } from "@/lib/delivery";
import { MAX_MESSAGE_CODE_POINTS } from "@/lib/gift";
import { CART_COOKIE } from "@/lib/cart";
import { DRAFT_TTL_HOURS } from "@/lib/checkout-drafts";
import { ORDER_RETENTION_YEARS, PAYMENT_HOLD_MINUTES, PAYMENT_METHODS } from "@/lib/order";
import { isPolicySlug, policyPath } from "@/lib/policies";
import { VAT_RATE_PCT, VND_FORMAT } from "@/lib/order-totals";
import { CHECKOUT_COOKIE } from "@/lib/checkout";
import { loadSiteSettings } from "@/lib/shop-data";

import { Link as LocalizedLink } from "@/i18n/navigation";

import { Container, PageHero } from "../../page-parts";

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug } = await params;
  if (!isPolicySlug(slug)) return {};
  const t = await getTranslations({ locale, namespace: `Policy.pages.${slug}` });
  return { title: t("title") };
}

export default async function PolicyPage({ params }: Props) {
  const { locale, slug } = await params;
  if (!isPolicySlug(slug)) notFound();
  setRequestLocale(locale);
  await connection();
  const settings = await loadSiteSettings();
  const owner = settings.owner;
  const t = await getTranslations("Policy");
  const p = await getTranslations(`Policy.pages.${slug}`);
  const z = await getTranslations("Zones");
  const d = await getTranslations("Checkout.delivery");
  const order = await getTranslations("Order.payment.methods");
  const format = await getFormatter();
  const vnd = (amount: number) => format.number(amount, VND_FORMAT);
  const zones = (settings.zones ?? []).map((row) => ({ zone: z(row.zone), fee: vnd(row.feeVnd), lead: row.leadDays }));
  const methods = format.list(PAYMENT_METHODS.map((method) => order(method)), { type: "conjunction" });
  const windows = format.list(DELIVERY_WINDOWS.map((window) => d(`windows.${window}`)));
  const sections = p.raw("sections") as Record<string, string>;
  const copy = (key: string, values?: Record<string, string | number>) => t(`copy.${key}`, values);
  const field = (value: string | null | undefined) => value || "—";
  const policyFields = owner ?? ({} as NonNullable<typeof owner>);
  // The account's enforced values come from their constants, never from message text.
  const accountFacts = [
    copy("accountData"),
    copy("accountCookie", { name: ACCOUNT_COOKIE }),
    copy("accountPassword", { min: PASSWORD_MIN_CODE_POINTS, max: PASSWORD_MAX_CODE_POINTS, attempts: MAX_LOGIN_ATTEMPTS, minutes: LOCK_MINUTES }),
    copy("accountReset", { minutes: RESET_EXPIRY_MINUTES, hours: SESSION_SECONDS / 3600 }),
    copy("accountMail", { hours: OUTBOX_TTL_HOURS }),
    copy("accountDelete"),
  ];
  const factList = (label: string, values: string[]) => (
    <section key={`${label}-${values.join("|")}`} className="mt-10 border-t border-line pt-6" aria-label={label}>
      <h2 className="font-display text-2xl font-semibold">{label}</h2>
      <ul className="mt-3 grid list-disc gap-2 pl-5 marker:text-champagne-deep">{values.map((value) => <li key={value}>{value}</li>)}</ul>
    </section>
  );

  let content: React.ReactNode;
  switch (slug) {
    case "thong-tin-doanh-nghiep":
      content = <>
        <p className="mt-4">{copy("bizOwner")}</p>
        {factList(sections.owner, [
          copy("ownerFacts", {
            legalName: field(policyFields.legalName), headOffice: field(policyFields.headOffice), representative: field(policyFields.legalRepresentative),
            registrationNumber: field(policyFields.businessRegistration?.number), registrationDate: field(policyFields.businessRegistration?.date), registrationPlace: field(policyFields.businessRegistration?.place),
          }),
          copy("contactFacts", { email: field(policyFields.contactEmail), phone: field(policyFields.contactPhone) }),
        ])}
        {factList(sections.licence, [copy("bizLicence"), copy("licenceFacts", {
          licenceNumber: field(policyFields.alcoholLicence?.number), licenceIssuer: field(policyFields.alcoholLicence?.issuer), licenceDate: field(policyFields.alcoholLicence?.date),
        })])}
        {factList(sections.notification, [policyFields.notificationLink ? copy("noticeFact", { url: policyFields.notificationLink }) : copy("bizNotice")])}
      </>;
      break;
    case "bao-mat":
      content = <>
        {factList(sections.purpose, [copy("privacyPurpose")])}
        {factList(sections.flows, [copy("privacyFlows"), copy("cookieAge", { name: AGE_COOKIE }), copy("cookieCart", { name: CART_COOKIE }), copy("cookieCheckout", { name: CHECKOUT_COOKIE }), copy("messageFact", { max: MAX_MESSAGE_CODE_POINTS })])}
        {factList(sections.retention, [copy("privacyRetention"), copy("retentionFact", { years: ORDER_RETENTION_YEARS }), copy("draftFact", { hours: DRAFT_TTL_HOURS }), copy("privacyPending")])}
        {factList(sections.account, accountFacts)}
        {factList(sections.access, [copy("privacyAccess")])}
        {factList(sections.rights, [copy("privacyRights")])}
      </>;
      break;
    case "dieu-khoan":
      content = <>
        {factList(sections.parties, [copy("termsParties"), copy("ageFact", { age: LEGAL_AGE }), copy("cookieAge", { name: AGE_COOKIE })])}
        {factList(sections.account, accountFacts)}
        {factList(sections.order, [copy("termsOrder")])}
        {factList(sections.delivery, [copy("termsDelivery")])}
        {factList(sections.payment, [copy("termsPayment", { minutes: PAYMENT_HOLD_MINUTES }), copy("paymentList", { methods }), copy("retentionFact", { years: ORDER_RETENTION_YEARS })])}
        {factList(sections.retention, [copy("retentionFact", { years: ORDER_RETENTION_YEARS })])}
        {factList(sections.pending, [copy("termsPending")])}
      </>;
      break;
    case "khieu-nai":
      content = <>
        {factList(sections.channel, [copy("complaintChannel", { email: field(policyFields.contactEmail) })])}
        {factList(sections.timeline, [copy("complaintTimeline")])}
        {factList(sections.scope, [copy("complaintScope")])}
      </>;
      break;
    case "gia":
      content = <>
        {factList(sections.display, [copy("priceDisplay"), copy("vatFact", { rate: VAT_RATE_PCT })])}
        {factList(sections.delivery, zones.map((zone) => copy("deliveryFact", zone)))}
        {factList(sections.wrap, [copy("wrapPaid"), copy("messageFact", { max: MAX_MESSAGE_CODE_POINTS })])}
        {factList(sections.other, [copy("noOtherFee")])}
      </>;
      break;
    case "dieu-kien-ban-hang":
      content = <>
        {factList(sections.age, [copy("ageLimit"), copy("ageFact", { age: LEGAL_AGE })])}
        {factList(sections.areas, [copy("geoLimit"), ...zones.map((zone) => copy("deliveryFact", zone))])}
        {factList(sections.availability, [copy("stockRule")])}
      </>;
      break;
    case "thanh-toan":
      content = <>
        {factList(sections.methods, [copy("paymentMethods", { minutes: PAYMENT_HOLD_MINUTES }), copy("paymentList", { methods })])}
        {factList(sections.refund, [copy("refundMethod"), copy("retentionFact", { years: ORDER_RETENTION_YEARS })])}
        {factList(sections.security, [copy("paymentSecurity")])}
      </>;
      break;
    case "giao-hang":
      content = <>
        {factList(sections.method, [copy("shippingMethod"), copy("geoLimit"), ...zones.map((zone) => copy("deliveryFact", zone))])}
        {factList(sections.timing, [copy("horizonFact", { days: HORIZON_DAYS }), copy("windowFact", { windows }), copy("draftFact", { hours: DRAFT_TTL_HOURS })])}
        {factList(sections.age, [copy("deliveryAge")])}
        {factList(sections.inspection, [copy("inspection")])}
      </>;
      break;
    case "doi-tra-hoan-tien":
      content = <>
        {factList(sections.mismatch, [copy("returnMismatch")])}
        {factList(sections.returns, [copy("returnRequest")])}
        {factList(sections.refund, [copy("returnRefund")])}
        {factList(sections.failedId, [copy("failedId"), t("pending")])}
      </>;
      break;
  }

  return (
    <article data-testid="policy-page" data-policy={slug}>
      <PageHero eyebrow={t("eyebrow")} title={p("title")} lead={p("intro")} width="text">
        <p className="notice mt-6 text-sm" data-testid="policy-draft">{t("draft")}</p>
      </PageHero>
      <Container width="text" className="pt-4">
        {content}
        <p className="notice mt-10 text-sm text-wine">{t("pending")}</p>
        <p className="mt-6"><LocalizedLink href={policyPath("thong-tin-doanh-nghiep")} className="text-wine underline underline-offset-4">{t("links.thong-tin-doanh-nghiep")}</LocalizedLink></p>
      </Container>
    </article>
  );
}
