/** The age marker, cart and checkout cookies: HttpOnly, SameSite=Lax, Path=/, Secure in production, browser session. */
export const cookieOptions = (production: boolean) => ({ httpOnly: true, sameSite: "lax", secure: production, path: "/" }) as const;
