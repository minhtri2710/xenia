"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Link } from "@/i18n/navigation";
import { ACCOUNT_ROUTES } from "@/lib/accounts";

import { resendAction, type SignInState, signInAction } from "../actions";
import { BUTTON, TextField } from "../form-parts";

export function SignInForm({ locale, next }: { locale: string; next: string }) {
  const t = useTranslations("Account.signIn");
  const [state, formAction, pending] = useActionState(signInAction, { failed: false, email: "" } as SignInState);

  return (
    <form action={formAction} className="mt-8 grid max-w-md gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />
      {state.failed && (
        <p role="alert" className="border border-wine/40 p-4 text-wine" data-testid="sign-in-failed">
          {t("failed")}
        </p>
      )}
      <TextField id="sign-in-email" name="email" label={t("fields.email")} type="email" autoComplete="email" defaultValue={state.email} />
      <TextField id="sign-in-password" name="password" label={t("fields.password")} type="password" autoComplete="current-password" />
      <button type="submit" disabled={pending} className={BUTTON}>
        {t("submit")}
      </button>
      <p className="text-sm">
        <Link href={ACCOUNT_ROUTES.forgot} className="text-wine underline underline-offset-4">
          {t("forgot")}
        </Link>
      </p>
    </form>
  );
}

/** Verification mail again: the answer is the same whatever the email and password are. */
export function ResendForm({ locale }: { locale: string }) {
  const t = useTranslations("Account.signIn.resend");
  return (
    <form action={resendAction} className="card mt-10 grid gap-6 p-6 sm:p-8">
      <h2 className="font-display text-2xl font-medium">{t("title")}</h2>
      <p className="text-muted">{t("intro")}</p>
      <input type="hidden" name="locale" value={locale} />
      <TextField id="resend-email" name="email" label={t("email")} type="email" autoComplete="email" />
      <TextField id="resend-password" name="password" label={t("password")} type="password" autoComplete="current-password" />
      <button type="submit" className={BUTTON}>
        {t("submit")}
      </button>
    </form>
  );
}
