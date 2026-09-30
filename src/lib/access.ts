import type { PayloadRequest } from "payload";

/** The Payload collection whose users are the shop's administrators (`admin.user` in `src/payload.config.ts`). */
export const ADMIN_COLLECTION = "users";

/**
 * The one access rule (F8 D1): the request's user belongs to `users`. Payload's default is "any
 * signed-in user", which a second auth collection (`customers`) would satisfy. `/api` is exempt
 * from the age gate, so anything a customer's token could read or change there is exposed.
 */
export const adminOnly = ({ req }: { req: PayloadRequest }): boolean => req.user?.collection === ADMIN_COLLECTION;

/** Every operation Payload gates on a collection, on `adminOnly`. Spread it, then narrow with `false`. */
export const adminOnlyAccess = {
  create: adminOnly,
  read: adminOnly,
  update: adminOnly,
  delete: adminOnly,
  readVersions: adminOnly,
} as const;

/** An auth collection also gates the admin panel and unlocking a locked account. */
export const adminOnlyAuthAccess = { ...adminOnlyAccess, admin: adminOnly, unlock: adminOnly } as const;

/** The operations a global has. */
export const adminOnlyGlobalAccess = { read: adminOnly, update: adminOnly, readVersions: adminOnly } as const;
