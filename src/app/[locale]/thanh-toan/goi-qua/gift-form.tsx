"use client";

import { useTranslations } from "next-intl";
import { useActionState, useState } from "react";

import { MAX_MESSAGE_CODE_POINTS } from "@/lib/gift";

import { type GiftState, saveGift } from "../actions";

const INPUT = "border border-ink/40 bg-raised px-3 py-2 focus:outline-2 focus:outline-wine";

type PackagingOption = { code: string; label: string; description: string; line: string };

/** Remaining characters, counted like the server: code points after NFC. Progressive enhancement only. */
const remaining = (text: string) => MAX_MESSAGE_CODE_POINTS - [...text.replace(/\r\n?/g, "\n").normalize("NFC")].length;

export function GiftForm({
  locale,
  isGift,
  packaging,
  someHidden,
  cards,
  initial,
}: {
  locale: string;
  isGift: boolean;
  packaging: PackagingOption[];
  someHidden: boolean;
  cards: { code: string; label: string }[];
  initial: GiftState;
}) {
  const t = useTranslations("Checkout.gift");
  const [state, formAction, pending] = useActionState(saveGift, initial);
  const { errors, values } = state;
  const [message, setMessage] = useState(values.message);
  const [card, setCard] = useState(values.card);

  return (
    <form action={formAction} noValidate className="mt-8 grid max-w-xl gap-8">
      <input type="hidden" name="locale" value={locale} />
      {errors.form && (
        <p role="alert" className="text-wine">
          {t(`errors.${errors.form}`)}
        </p>
      )}

      <fieldset aria-describedby={errors.packaging ? "packaging-error" : undefined} data-testid="packaging-options">
        <legend className="text-sm font-medium">{t("packaging")}</legend>
        <div className="mt-3 grid gap-4">
          <label className="flex items-center gap-3">
            <input type="radio" name="packaging" value="none" defaultChecked={values.packaging === "none"} className="accent-wine" />
            {t("noPackaging")}
          </label>
          {packaging.map((p) => (
            <label key={p.code} className="flex items-start gap-3">
              <input type="radio" name="packaging" value={p.code} defaultChecked={values.packaging === p.code} className="mt-1 accent-wine" />
              <span className={`packaging-swatch packaging-${p.code}`} aria-hidden="true" />
              <span>
                <span className="font-medium">{p.label}</span>
                <span className="block text-sm text-muted">{p.description}</span>
                <span className="block text-sm">{p.line}</span>
              </span>
            </label>
          ))}
        </div>
        {packaging.length === 0 ? (
          <p className="mt-3 text-sm text-muted" data-testid="packaging-none-fits">
            {t("noneFits")}
          </p>
        ) : (
          someHidden && <p className="mt-3 text-sm text-muted">{t("someHidden")}</p>
        )}
        {errors.packaging && (
          <p id="packaging-error" className="mt-2 text-sm text-wine">
            {t(`errors.${errors.packaging}`)}
          </p>
        )}
      </fieldset>

      {isGift && (
        <>
          <fieldset aria-describedby={errors.card ? "card-error" : undefined}>
            <legend className="text-sm font-medium">{t("card")}</legend>
            <div className="mt-3 grid grid-cols-2 gap-4">
              {cards.map((c) => (
                <label key={c.code} className="grid gap-2">
                  <span className={`card-preview card-${c.code}`} aria-hidden="true" />
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="card"
                      value={c.code}
                      defaultChecked={values.card === c.code}
                      onChange={() => setCard(c.code)}
                      className="accent-wine"
                    />
                    {c.label}
                  </span>
                </label>
              ))}
            </div>
            {errors.card && (
              <p id="card-error" className="mt-2 text-sm text-wine">
                {t(`errors.${errors.card}`)}
              </p>
            )}
          </fieldset>

          <div className="grid gap-2">
            <label htmlFor="gift-message" className="text-sm font-medium">
              {t("message")}
            </label>
            <div className={`card-preview card-${card || "plain"} p-4`}>
              <textarea
                id="gift-message"
                name="message"
                rows={5}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                aria-invalid={errors.message ? true : undefined}
                aria-describedby={`gift-message-hint${errors.message ? " gift-message-error" : ""}`}
                className={`${INPUT} w-full`}
              />
            </div>
            <p id="gift-message-hint" className="text-sm text-muted" aria-live="polite" data-testid="message-remaining">
              {t("messageHint", { max: MAX_MESSAGE_CODE_POINTS, remaining: remaining(message) })}
            </p>
            {errors.message && (
              <p id="gift-message-error" className="text-sm text-wine">
                {t(`errors.${errors.message}`, { max: MAX_MESSAGE_CODE_POINTS })}
              </p>
            )}
          </div>

          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium">{t("sender")}</legend>
            <label htmlFor="gift-sender" className="text-sm">
              {t("senderName")}
            </label>
            <input
              id="gift-sender"
              name="sender"
              defaultValue={values.sender}
              autoComplete="name"
              aria-invalid={errors.sender ? true : undefined}
              aria-describedby={errors.sender ? "gift-sender-error" : undefined}
              className={INPUT}
            />
            <label className="flex items-center gap-3">
              <input type="checkbox" name="anonymous" defaultChecked={values.anonymous} className="accent-wine" />
              {t("anonymous")}
            </label>
            {errors.sender && (
              <p id="gift-sender-error" className="text-sm text-wine">
                {t(`errors.${errors.sender}`)}
              </p>
            )}
          </fieldset>

          <label className="flex items-start gap-3">
            <input type="checkbox" name="hidePrices" defaultChecked={values.hidePrices} className="mt-1 accent-wine" />
            <span>
              {t("hidePrices")}
              <span className="block text-sm text-muted">{t("hidePricesHint")}</span>
            </span>
          </label>
        </>
      )}

      <button type="submit" disabled={pending} className="justify-self-start bg-wine px-6 py-3 font-medium text-ivory hover:bg-wine-deep disabled:opacity-60">
        {t("submit")}
      </button>
    </form>
  );
}
