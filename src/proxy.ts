import { type NextRequest, NextResponse } from "next/server";
import createMiddleware from "next-intl/middleware";

import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { AGE_COOKIE, AGE_COOKIE_VALUE, GATE_PATH, UNGATED_PATHS } from "@/lib/gate";

const intlMiddleware = createMiddleware(routing);

/**
 * The age gate (Decree 24/2020 Art. 6.1). Every storefront request without the
 * verification marker is redirected to the gate before any page renders; the
 * requested path travels in `next`. Everything else is next-intl's routing.
 */
export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  // Strip any locale prefix, including a redundant `/vi` that next-intl redirects away.
  const prefixed = routing.locales.find((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  const locale = prefixed ?? routing.defaultLocale;
  const path = prefixed ? pathname.slice(prefixed.length + 1) || "/" : pathname;

  const verified = request.cookies.get(AGE_COOKIE)?.value === AGE_COOKIE_VALUE;
  if (!verified && !UNGATED_PATHS.has(path)) {
    const gate = new URL(getPathname({ href: GATE_PATH, locale }), request.url);
    gate.searchParams.set("next", pathname + search);
    return NextResponse.redirect(gate);
  }
  return intlMiddleware(request);
}

export const config = {
  // Exempt: Payload admin and API, and Next's own assets. Everything else,
  // including paths with a file extension, goes through the gate.
  matcher: ["/((?!(?:admin|api|_next|_vercel)(?:/|$)).*)"],
};
