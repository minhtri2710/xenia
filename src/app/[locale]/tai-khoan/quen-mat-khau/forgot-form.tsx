"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { type ForgotState, forgotAction } from "../actions";
import { BUTTON, TextField } from "../form-parts";

export function ForgotForm({ locale }: { locale: string }) {
  const t = useTranslations("Account.forgot");
  const [state, formAction, pending] = useActionState(forgotAction, { email: "" } as ForgotState);
  return (
    <form action={formAction} noValidate className="mt-8 grid max-w-md gap-6">
      <input type="hidden" name="locale" value={locale} />
      <TextField
        id="forgot-email"
        name="email"
        label={t("email")}
        type="email"
        autoComplete="email"
        defaultValue={state.email}
        error={state.error ? t(`errors.${state.error}`) : undefined}
      />
      <button type="submit" disabled={pending} className={BUTTON}>
        {t("submit")}
      </button>
    </form>
  );
}
