"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Link } from "@/i18n/navigation";
import { PASSWORD_MAX_CODE_POINTS, PASSWORD_MIN_CODE_POINTS } from "@/lib/accounts";
import { policyPath } from "@/lib/policies";

import { type RegisterState, register } from "../actions";
import { BUTTON, Consent, TextField } from "../form-parts";

const RULE = { min: PASSWORD_MIN_CODE_POINTS, max: PASSWORD_MAX_CODE_POINTS };

export function RegisterForm({ locale }: { locale: string }) {
  const t = useTranslations("Account.register");
  const [state, formAction, pending] = useActionState(register, { errors: {}, values: { name: "", dob: "", email: "" } } as RegisterState);
  const { errors, values } = state;
  const error = (key: keyof typeof errors) => (errors[key] ? t(`errors.${errors[key]}`, RULE) : undefined);
  return (
    <form action={formAction} noValidate className="mt-8 grid max-w-md gap-6">
      <input type="hidden" name="locale" value={locale} />
      <TextField id="register-name" name="name" label={t("fields.name")} autoComplete="name" defaultValue={values.name} error={error("name")} />
      <TextField id="register-dob" name="dob" label={t("fields.dob")} type="date" autoComplete="bday" defaultValue={values.dob} error={error("dob")} hint={t("dobNote")} />
      <TextField id="register-email" name="email" label={t("fields.email")} type="email" autoComplete="email" defaultValue={values.email} error={error("email")} />
      <TextField
        id="register-password"
        name="password"
        label={t("fields.password")}
        type="password"
        autoComplete="new-password"
        error={error("password")}
        hint={t("passwordHint", RULE)}
      />
      <Consent id="register-terms" name="terms" error={error("terms")}>
        {t.rich("consent.terms", {
          link: (chunks) => (
            <Link href={policyPath("dieu-khoan")} className="text-wine underline underline-offset-4">
              {chunks}
            </Link>
          ),
        })}
      </Consent>
      <Consent id="register-privacy" name="privacy" error={error("privacy")}>
        {t.rich("consent.privacy", {
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
