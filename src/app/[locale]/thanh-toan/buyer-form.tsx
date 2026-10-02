"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { Buyer } from "@/lib/buyer";

import { type BuyerState, saveBuyer } from "./actions";

const INPUT = "border border-ink/40 bg-raised px-3 py-2 focus:outline-2 focus:outline-wine";

type Name = keyof BuyerState["values"];

const FIELDS: { name: Name; type: string; autoComplete: string }[] = [
  { name: "name", type: "text", autoComplete: "name" },
  { name: "dob", type: "date", autoComplete: "bday" },
  { name: "phone", type: "tel", autoComplete: "tel" },
  { name: "email", type: "email", autoComplete: "email" },
  { name: "address", type: "textarea", autoComplete: "street-address" },
];

export function BuyerForm({ locale, buyer }: { locale: string; buyer?: Buyer }) {
  const t = useTranslations("Checkout.buyer");
  const initial: BuyerState = { errors: {}, values: { dob: "", ...(buyer ?? { name: "", phone: "", email: "", address: "" }) } };
  const [state, formAction, pending] = useActionState(saveBuyer, initial);

  return (
    <form action={formAction} noValidate className="mt-8 grid max-w-md gap-6">
      <input type="hidden" name="locale" value={locale} />
      {FIELDS.map(({ name, type, autoComplete }) => {
        const error = state.errors[name];
        const props = {
          id: `buyer-${name}`,
          name,
          autoComplete,
          required: true,
          defaultValue: state.values[name],
          "aria-invalid": error ? true : undefined,
          "aria-describedby": error ? `buyer-${name}-error` : undefined,
          className: INPUT,
        };
        return (
          <div key={name} className="grid gap-2">
            <label htmlFor={props.id} className="text-sm font-medium">
              {t(`fields.${name}`)}
            </label>
            {type === "textarea" ? <textarea rows={3} {...props} /> : <input type={type} {...props} />}
            {error && (
              <p id={`buyer-${name}-error`} className="text-sm text-wine">
                {t(`errors.${error}`)}
              </p>
            )}
          </div>
        );
      })}
      <p className="text-sm text-muted">{t("privacy")}</p>
      <button type="submit" disabled={pending} className="justify-self-start bg-wine px-6 py-3 font-medium text-ivory hover:bg-wine-deep disabled:opacity-60">
        {t("submit")}
      </button>
    </form>
  );
}
