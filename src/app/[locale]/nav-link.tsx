"use client";

import type { ReactNode } from "react";

import { Link, usePathname } from "@/i18n/navigation";

/**
 * A header link that marks itself `aria-current="page"` on its own page and on the pages under it
 * (a product page under `/ruou-vang`, the account pages under `/tai-khoan`).
 */
export function NavLink({ href, testId, children }: { href: string; testId?: string; children: ReactNode }) {
  const pathname = usePathname();
  const current = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link href={href} className="nav-link" aria-current={current ? "page" : undefined} data-testid={testId}>
      {children}
    </Link>
  );
}
