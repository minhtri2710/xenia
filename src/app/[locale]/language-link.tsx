"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";

export function LanguageLink() {
  const locale = useLocale();
  const pathname = usePathname();
  const query = Object.fromEntries(useSearchParams().entries());
  const target = locale === "en" ? "vi" : "en";
  const t = useTranslations("Brand");

  return (
    <Link href={{ pathname, query }} locale={target} lang={target} hrefLang={target} className="nav-link">
      {t("switchLocale")}
    </Link>
  );
}
