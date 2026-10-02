"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { declareAge, type GateState } from "./actions";

const initialState: GateState = { errors: {}, name: "", dob: "" };

export function GateForm({ locale, next }: { locale: string; next: string }) {
  const t = useTranslations("Gate");
  const [state, formAction, pending] = useActionState(declareAge, initialState);
  const { errors } = state;

  return (
    <form action={formAction} noValidate className="mt-10 grid max-w-md gap-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="next" value={next} />

      <div className="grid gap-2">
        <label htmlFor="gate-name" className="text-sm font-medium">
          {t("name")}
        </label>
        <input
          id="gate-name"
          name="name"
          type="text"
          autoComplete="name"
          required
          defaultValue={state.name}
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "gate-name-error" : undefined}
          className="border border-ink/40 bg-raised px-3 py-2 focus:outline-2 focus:outline-wine"
        />
        {errors.name && (
          <p id="gate-name-error" className="text-sm text-wine">
            {t(`errors.${errors.name}`)}
          </p>
        )}
      </div>

      <div className="grid gap-2">
        <label htmlFor="gate-dob" className="text-sm font-medium">
          {t("dob")}
        </label>
        <input
          id="gate-dob"
          name="dob"
          type="date"
          autoComplete="bday"
          required
          defaultValue={state.dob}
          aria-invalid={errors.dob ? true : undefined}
          aria-describedby={errors.dob ? "gate-dob-error" : undefined}
          className="border border-ink/40 bg-raised px-3 py-2 focus:outline-2 focus:outline-wine"
        />
        {errors.dob && (
          <p id="gate-dob-error" className="text-sm text-wine">
            {t(`errors.${errors.dob}`)}
          </p>
        )}
      </div>

      <button
        type="submit"
        disabled={pending}
        className="justify-self-start bg-wine px-6 py-3 font-medium text-ivory hover:bg-wine-deep disabled:opacity-60"
      >
        {t("submit")}
      </button>
    </form>
  );
}
