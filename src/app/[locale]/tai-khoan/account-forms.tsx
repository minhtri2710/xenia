"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { PASSWORD_MAX_CODE_POINTS, PASSWORD_MIN_CODE_POINTS } from "@/lib/accounts";

import {
  changePasswordAction,
  deleteAccountAction,
  type DeleteState,
  type PasswordState,
  type ProfileState,
  saveProfile,
  signOutAction,
} from "./actions";
import { BUTTON, TextField } from "./form-parts";

const RULE = { min: PASSWORD_MIN_CODE_POINTS, max: PASSWORD_MAX_CODE_POINTS };

export function ProfileForm({ locale, profile }: { locale: string; profile: { name: string; phone: string; address: string } }) {
  const t = useTranslations("Account.page.profile");
  const [state, formAction, pending] = useActionState(saveProfile, { errors: {}, saved: false } as ProfileState);
  const { errors } = state;
  return (
    <form action={formAction} noValidate className="mt-4 grid max-w-md gap-6">
      <input type="hidden" name="locale" value={locale} />
      {state.saved && (
        <p role="status" data-testid="profile-saved">
          {t("saved")}
        </p>
      )}
      <TextField id="profile-name" name="name" label={t("name")} autoComplete="name" defaultValue={profile.name} required={false} error={errors.name && t(`errors.${errors.name}`)} />
      <TextField id="profile-phone" name="phone" label={t("phone")} type="tel" autoComplete="tel" defaultValue={profile.phone} required={false} error={errors.phone && t(`errors.${errors.phone}`)} />
      <TextField
        id="profile-address"
        name="address"
        label={t("address")}
        type="textarea"
        autoComplete="street-address"
        defaultValue={profile.address}
        required={false}
        error={errors.address && t(`errors.${errors.address}`)}
      />
      <button type="submit" disabled={pending} className={BUTTON}>
        {t("submit")}
      </button>
    </form>
  );
}

export function PasswordForm({ locale }: { locale: string }) {
  const t = useTranslations("Account.page.password");
  const [state, formAction, pending] = useActionState(changePasswordAction, { changed: false } as PasswordState);
  return (
    <form action={formAction} noValidate className="mt-4 grid max-w-md gap-6">
      <input type="hidden" name="locale" value={locale} />
      {state.changed && (
        <p role="status" data-testid="password-changed">
          {t("changed")}
        </p>
      )}
      <TextField
        id="password-current"
        name="currentPassword"
        label={t("current")}
        type="password"
        autoComplete="current-password"
        error={state.error === "wrongPassword" ? t("errors.wrongPassword") : undefined}
      />
      <TextField
        id="password-new"
        name="newPassword"
        label={t("next")}
        type="password"
        autoComplete="new-password"
        hint={t("hint", RULE)}
        error={state.error && state.error !== "wrongPassword" ? t(`errors.${state.error}`, RULE) : undefined}
      />
      <button type="submit" disabled={pending} className={BUTTON}>
        {t("submit")}
      </button>
    </form>
  );
}

export function SignOutForm({ locale }: { locale: string }) {
  const t = useTranslations("Account.page");
  return (
    <form action={signOutAction} className="mt-4">
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className={BUTTON}>
        {t("signOut")}
      </button>
    </form>
  );
}

export function DeleteForm({ locale }: { locale: string }) {
  const t = useTranslations("Account.page.delete");
  const [state, formAction, pending] = useActionState(deleteAccountAction, {} as DeleteState);
  return (
    <form action={formAction} noValidate className="mt-4 grid max-w-md gap-6">
      <input type="hidden" name="locale" value={locale} />
      <p className="text-muted">{t("intro")}</p>
      <TextField id="delete-password" name="password" label={t("password")} type="password" autoComplete="current-password" error={state.error && t(`errors.${state.error}`)} />
      <button type="submit" disabled={pending} className={BUTTON}>
        {t("submit")}
      </button>
    </form>
  );
}
