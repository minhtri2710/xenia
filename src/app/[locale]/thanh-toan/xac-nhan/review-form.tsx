"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";

import { Link } from "@/i18n/navigation";

import { type ReviewState, submitOrder } from "../actions";

const CONSENTS = [
  { name: "terms", href: "/chinh-sach/dieu-khoan" },
  { name: "privacy", href: "/chinh-sach/bao-mat" },
] as const;

export function ReviewForm({
  locale,
  clientKey,
  digest,
  names,
}: {
  locale: string;
  clientKey: string;
  digest: string;
  names: Record<number, string>;
}) {
  const t = useTranslations("Checkout.review");
  const [state, formAction, pending] = useActionState(submitOrder, { errors: {} } as ReviewState);
  const { errors } = state;

  return (
    <form action={formAction} noValidate className="mt-10 grid gap-4 border-t border-ink/15 pt-6">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="clientKey" value={clientKey} />
      <input type="hidden" name="digest" value={digest} />
      {errors.problems && errors.problems.length > 0 && (
        <ul role="alert" className="grid gap-1 text-wine" data-testid="line-problems">
          {errors.problems.map((p) => (
            <li key={p.vintageId}>
              {p.problem === "stock" && p.stock > 0
                ? t("problems.stock", { name: names[p.vintageId] ?? t("problems.unknownItem"), stock: p.stock })
                : t("problems.unavailable", { name: names[p.vintageId] ?? t("problems.unknownItem") })}
            </li>
          ))}
        </ul>
      )}
      {errors.expired && (
        <p role="alert" className="text-wine">
          {t("expired")}
        </p>
      )}
      {CONSENTS.map(({ name, href }) => (
        <div key={name}>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              name={name}
              required
              aria-invalid={errors[name] ? true : undefined}
              aria-describedby={errors[name] ? `consent-${name}-error` : undefined}
              className="mt-1 accent-wine"
            />
            <span>
              {t.rich(`consent.${name}`, {
                link: (chunks) => (
                  <Link href={href} className="text-wine underline underline-offset-4">
                    {chunks}
                  </Link>
                ),
              })}
            </span>
          </label>
          {errors[name] && (
            <p id={`consent-${name}-error`} className="ml-7 text-sm text-wine">
              {t(`consent.${name}Required`)}
            </p>
          )}
        </div>
      ))}
      <button type="submit" disabled={pending} className="mt-4 justify-self-start bg-wine px-6 py-3 font-medium text-ivory hover:bg-ink disabled:opacity-60">
        {t("submit")}
      </button>
    </form>
  );
}
