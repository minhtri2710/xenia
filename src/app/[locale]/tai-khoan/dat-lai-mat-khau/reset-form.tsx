"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { PASSWORD_MAX_CODE_POINTS, PASSWORD_MIN_CODE_POINTS } from "@/lib/accounts";

import { type ResetState, resetAction } from "../actions";
import { BUTTON, TextField } from "../form-parts";

export function ResetForm({ locale, token }: { locale: string; token: string }) {
  const t = useTranslations("Account.reset");
  const [state, formAction, pending] = useActionState(resetAction, {} as ResetState);
  const rule = { min: PASSWORD_MIN_CODE_POINTS, max: PASSWORD_MAX_CODE_POINTS };
  return (
    <form action={formAction} noValidate className="mt-8 grid max-w-md gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="token" value={token} />
      {state.error === "tokenInvalid" && (
        <p role="alert" className="border border-wine/40 p-4 text-wine" data-testid="reset-invalid">
          {t("tokenInvalid")}
        </p>
      )}
      <TextField
        id="reset-password"
        name="password"
        label={t("password")}
        type="password"
        autoComplete="new-password"
        hint={t("passwordHint", rule)}
        error={state.error && state.error !== "tokenInvalid" ? t(`errors.${state.error}`, rule) : undefined}
      />
      <button type="submit" disabled={pending} className={BUTTON}>
        {t("submit")}
      </button>
    </form>
  );
}
