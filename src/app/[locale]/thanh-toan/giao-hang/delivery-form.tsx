"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import type { Zone } from "@/lib/order";

import { type DeliveryState, saveDelivery } from "../actions";

export function DeliveryForm({ locale, current, zones }: { locale: string; current?: Zone; zones: { zone: Zone; label: string; fee: string }[] }) {
  const t = useTranslations("Checkout.delivery");
  const [state, formAction, pending] = useActionState(saveDelivery, {} as DeliveryState);

  return (
    <form action={formAction} noValidate className="mt-8 grid max-w-md gap-6">
      <input type="hidden" name="locale" value={locale} />
      <fieldset aria-describedby={state.error ? "zone-error" : undefined}>
        <legend className="text-sm font-medium">{t("zone")}</legend>
        <div className="mt-3 grid gap-3">
          {zones.map(({ zone, label, fee }) => (
            <label key={zone} className="flex items-center gap-3">
              <input type="radio" name="zone" value={zone} defaultChecked={zone === current} required className="accent-wine" />
              {t("zoneOption", { zone: label, fee })}
            </label>
          ))}
        </div>
      </fieldset>
      {state.error && (
        <p id="zone-error" className="text-sm text-wine">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <button type="submit" disabled={pending} className="justify-self-start bg-wine px-6 py-3 font-medium text-ivory hover:bg-ink disabled:opacity-60">
        {t("submit")}
      </button>
    </form>
  );
}
