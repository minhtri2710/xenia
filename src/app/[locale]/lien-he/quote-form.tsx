"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Link } from "@/i18n/navigation";
import { policyPath } from "@/lib/policies";

import { BUTTON, Consent, INPUT, TextField } from "../tai-khoan/form-parts";
import { type QuoteState, sendQuote } from "./actions";

const EMPTY: QuoteState = { errors: {}, values: { company: "", name: "", email: "", phone: "", occasion: "", quantity: "", budget: "", message: "" } };

type Option = { value: string; label: string };

/** The quote request form; every rule is checked again on the server (`checkQuote`). */
export function QuoteForm({
  locale,
  occasions,
  budgets,
  maxQuantity,
  maxMessage,
}: {
  locale: string;
  occasions: Option[];
  budgets: Option[];
  maxQuantity: number;
  maxMessage: number;
}) {
  const t = useTranslations("Quote");
  const [state, formAction, pending] = useActionState(sendQuote, EMPTY);
  const { errors, values } = state;
  const error = (key: keyof QuoteState["errors"]) => {
    const code = errors[key];
    return code ? t(`errors.${code}`, { max: key === "quantity" ? maxQuantity : maxMessage }) : undefined;
  };

  const select = (id: string, name: "occasion" | "budget", label: string, options: Option[], placeholder: string, required: boolean) => {
    const message = error(name);
    return (
      <div className="grid gap-2">
        <label htmlFor={id} className="text-sm font-medium">
          {label}
        </label>
        <select
          id={id}
          name={name}
          required={required}
          defaultValue={values[name]}
          aria-invalid={message ? true : undefined}
          aria-describedby={message ? `${id}-error` : undefined}
          className={`${INPUT} min-h-11 w-full min-w-0`}
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {message && (
          <p id={`${id}-error`} className="text-sm text-wine">
            {message}
          </p>
        )}
      </div>
    );
  };

  return (
    <form action={formAction} noValidate className="mt-6 grid gap-6" data-testid="quote-form">
      <input type="hidden" name="locale" value={locale} />
      <TextField id="quote-company" name="company" label={t("company")} autoComplete="organization" defaultValue={values.company} error={error("company")} />
      <div className="grid gap-6 sm:grid-cols-2">
        <TextField id="quote-name" name="name" label={t("name")} autoComplete="name" defaultValue={values.name} error={error("name")} />
        <TextField id="quote-phone" name="phone" label={t("phone")} type="tel" autoComplete="tel" defaultValue={values.phone} error={error("phone")} />
      </div>
      <TextField id="quote-email" name="email" label={t("email")} type="email" autoComplete="email" defaultValue={values.email} error={error("email")} />
      <div className="grid gap-6 sm:grid-cols-2">
        {select("quote-occasion", "occasion", t("occasion"), occasions, t("occasionPick"), true)}
        <TextField id="quote-quantity" name="quantity" label={t("quantity")} type="number" defaultValue={values.quantity} error={error("quantity")} />
      </div>
      {select("quote-budget", "budget", t("budget"), budgets, t("budgetNone"), false)}
      <TextField
        id="quote-message"
        name="message"
        label={t("message")}
        type="textarea"
        required={false}
        defaultValue={values.message}
        hint={t("messageHint", { max: maxMessage })}
        error={error("message")}
      />
      <Consent id="quote-privacy" name="privacy" error={error("privacy")}>
        {t.rich("privacy", {
          link: (chunks) => (
            <Link href={policyPath("bao-mat")} className="text-wine underline underline-offset-4">
              {chunks}
            </Link>
          ),
        })}
      </Consent>
      <button type="submit" disabled={pending} className={BUTTON}>
        {t("submit")}
      </button>
    </form>
  );
}
