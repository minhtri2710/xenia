import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { verifyAction } from "../actions";
import { BUTTON } from "../form-parts";

type Props = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function generateMetadata({ params }: Pick<Props, "params">): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Account.verify" });
  // The token is in the URL: keep it out of indexes and out of Referer headers.
  return { title: t("title"), robots: { index: false, follow: false }, referrer: "no-referrer" };
}

/** The link only shows a button: a mail scanner that opens the link does not use the token up. */
export default async function VerifyPage({ params, searchParams }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { token, failed } = await searchParams;
  const t = await getTranslations("Account.verify");
  return (
    <section className="max-w-3xl pt-4">
      <h1 className="font-display text-5xl font-medium">{t("title")}</h1>
      {failed === "1" && (
        <p role="alert" className="mt-6 border border-wine/40 p-4 text-wine" data-testid="verify-failed">
          {t("failed")}
        </p>
      )}
      {typeof token === "string" && token !== "" ? (
        <form action={verifyAction} className="mt-8 grid max-w-md gap-6">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="token" value={token} />
          <p className="text-muted">{t("intro")}</p>
          <button type="submit" className={BUTTON}>
            {t("submit")}
          </button>
        </form>
      ) : (
        <p className="mt-6 text-muted">{t("noToken")}</p>
      )}
    </section>
  );
}
