"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { DELIVERY_MODES, DELIVERY_WINDOWS } from "@/lib/delivery";
import type { Zone } from "@/lib/order";

import { type DeliveryState, saveDelivery } from "../actions";

const INPUT = "border border-ink/40 bg-white px-3 py-2 focus:outline-2 focus:outline-wine";

type ZoneOption = { zone: Zone; label: string; fee: string; earliest: string };

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-sm text-wine">
      {message}
    </p>
  ) : null;
}

export function DeliveryForm({
  locale,
  buyer,
  zones,
  range,
  initial,
}: {
  locale: string;
  buyer: string;
  zones: ZoneOption[];
  range: { min: string; max: string };
  initial: DeliveryState;
}) {
  const t = useTranslations("Checkout.delivery");
  const [state, formAction, pending] = useActionState(saveDelivery, initial);
  const { errors, values } = state;
  const r = errors.recipient ?? {};
  const described = (id: string, error: unknown) => (error ? { "aria-invalid": true as const, "aria-describedby": id } : {});

  return (
    <form action={formAction} noValidate className="mt-8 grid max-w-xl gap-8">
      <input type="hidden" name="locale" value={locale} />

      <fieldset aria-describedby={errors.mode ? "mode-error" : undefined} className="grid gap-4">
        <legend className="text-sm font-medium">{t("mode")}</legend>
        {DELIVERY_MODES.map((mode) => (
          <div key={mode}>
            <label className="flex items-center gap-3">
              <input type="radio" name="mode" value={mode} defaultChecked={values.mode === mode} required className="accent-wine" />
              {t(`modes.${mode}`)}
            </label>
            {mode === "self" && <p className="ml-7 mt-1 text-sm text-muted">{buyer}</p>}
          </div>
        ))}
        <FieldError id="mode-error" message={errors.mode && t(`errors.${errors.mode}`)} />
      </fieldset>

      <p className="border-l-2 border-wine pl-4" data-testid="id-check">
        {t("idCheck")}
      </p>

      <fieldset className="grid gap-4 border border-ink/15 p-5">
        <legend className="px-1 text-sm font-medium">{t("recipient.legend")}</legend>
        <p className="border-l-2 border-wine pl-4" data-testid="recipient-id-check">
          {t("recipient.idCheck")}
        </p>
        {(
          [
            ["recipientName", "name", "text", "name"],
            ["recipientPhone", "phone", "tel", "tel"],
            ["recipientAddress", "address", "textarea", "street-address"],
          ] as const
        ).map(([name, key, type, autoComplete]) => {
          const error = r[key];
          const props = {
            id: `delivery-${name}`,
            name,
            autoComplete: `section-recipient ${autoComplete}`,
            defaultValue: values[name],
            className: INPUT,
            ...described(`delivery-${name}-error`, error),
          };
          return (
            <div key={name} className="grid gap-2">
              <label htmlFor={props.id} className="text-sm font-medium">
                {t(`recipient.${key}`)}
              </label>
              {type === "textarea" ? <textarea rows={3} {...props} /> : <input type={type} {...props} />}
              <FieldError id={`delivery-${name}-error`} message={error && t(`errors.recipient.${error}`)} />
            </div>
          );
        })}
      </fieldset>

      <fieldset aria-describedby={errors.zone ? "zone-error" : undefined}>
        <legend className="text-sm font-medium">{t("zone")}</legend>
        <div className="mt-3 grid gap-3">
          {zones.map(({ zone, label, fee, earliest }) => (
            <label key={zone} className="flex items-center gap-3">
              <input type="radio" name="zone" value={zone} defaultChecked={zone === values.zone} required className="accent-wine" />
              {t("zoneOption", { zone: label, fee, earliest })}
            </label>
          ))}
        </div>
        <FieldError id="zone-error" message={errors.zone && t(`errors.${errors.zone}`)} />
      </fieldset>

      <div className="grid gap-2">
        <label htmlFor="delivery-date" className="text-sm font-medium">
          {t("date")}
        </label>
        <input
          id="delivery-date"
          type="date"
          name="date"
          min={range.min}
          max={range.max}
          required
          defaultValue={values.date}
          className={`${INPUT} justify-self-start`}
          {...described("delivery-date-error", errors.date)}
        />
        <p className="text-sm text-muted">{t("dateHint")}</p>
        <FieldError id="delivery-date-error" message={errors.date && t(`errors.${errors.date}`)} />
      </div>

      <fieldset aria-describedby={errors.window ? "window-error" : undefined}>
        <legend className="text-sm font-medium">{t("window")}</legend>
        <div className="mt-3 grid gap-3">
          {DELIVERY_WINDOWS.map((w) => (
            <label key={w} className="flex items-center gap-3">
              <input type="radio" name="window" value={w} defaultChecked={values.window === w} required className="accent-wine" />
              {t(`windows.${w}`)}
            </label>
          ))}
        </div>
        <FieldError id="window-error" message={errors.window && t(`errors.${errors.window}`)} />
      </fieldset>

      <button type="submit" disabled={pending} className="justify-self-start bg-wine px-6 py-3 font-medium text-ivory hover:bg-ink disabled:opacity-60">
        {t("submit")}
      </button>
    </form>
  );
}
