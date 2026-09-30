import { APIError, type CollectionConfig, type PayloadRequest } from "payload";

import { accountMail, isMailLocale } from "@/lib/account-mail";
import { adminOnlyAuthAccess } from "@/lib/access";
import { checkPassword, LOCK_MINUTES, MAX_LOGIN_ATTEMPTS, RESET_EXPIRY_MINUTES, SESSION_SECONDS } from "@/lib/accounts";
import { MAX_NAME_LENGTH } from "@/lib/age";
import { MAX_ADDRESS_LENGTH } from "@/lib/buyer";

// The optional buyer account (F8). Payload auth owns the password hash, verification and reset
// tokens, lockout and sessions. Never a date of birth: registration reads it only to decide.
//
// - Nothing is served over REST or GraphQL (`endpoints: false`): the built-in login, reset and
//   verify routes would sit on the gate-exempt `/api` and tell an unknown email from an
//   unverified or locked one. The storefront uses the Local API on the server. Consequence: the
//   admin (which edits and deletes over REST) shows customers read-only.
// - `create` is closed everywhere: an account is only made by storefront registration (Local API).
// - Sessions: `useSessions` (Payload's default), so sign-out and a password reset can end them.

/** The storefront locale the account action put in the request context; mail defaults to Vietnamese. */
const localeOf = (req: Partial<PayloadRequest> | undefined) => {
  const locale = req?.context?.accountLocale;
  return isMailLocale(locale) ? locale : "vi";
};

export const Customers: CollectionConfig = {
  slug: "customers",
  admin: {
    useAsTitle: "email",
    defaultColumns: ["email", "name", "_verified", "createdAt"],
    description: "Buyer accounts. Read-only here; accounts are made and changed on the storefront.",
  },
  auth: {
    verify: {
      generateEmailSubject: (args) => accountMail("verify", localeOf(args?.req)).subject,
      generateEmailHTML: (args) => accountMail("verify", localeOf(args?.req), args?.token).html,
    },
    forgotPassword: {
      expiration: RESET_EXPIRY_MINUTES * 60 * 1000,
      generateEmailSubject: (args) => accountMail("reset", localeOf(args?.req)).subject,
      generateEmailHTML: (args) => accountMail("reset", localeOf(args?.req), args?.token).html,
    },
    maxLoginAttempts: MAX_LOGIN_ATTEMPTS,
    lockTime: LOCK_MINUTES * 60 * 1000,
    tokenExpiration: SESSION_SECONDS,
    useSessions: true,
  },
  access: { ...adminOnlyAuthAccess, create: () => false, update: () => false, delete: () => false, admin: () => false },
  endpoints: false,
  graphQL: false,
  lockDocuments: false,
  hooks: {
    beforeValidate: [
      ({ data }) => {
        if (typeof data?.password === "string" && checkPassword(data.password)) throw new APIError("The password does not meet the rule.", 400);
        return data;
      },
    ],
  },
  fields: [
    { name: "name", type: "text", maxLength: MAX_NAME_LENGTH, admin: { readOnly: true } },
    { name: "phone", type: "text", admin: { readOnly: true } },
    { name: "address", type: "textarea", maxLength: MAX_ADDRESS_LENGTH, admin: { readOnly: true } },
    {
      name: "consents",
      type: "group",
      admin: { readOnly: true },
      fields: [
        { name: "terms", type: "checkbox", required: true },
        { name: "privacy", type: "checkbox", required: true },
        { name: "at", type: "date", required: true, admin: { date: { pickerAppearance: "dayAndTime" } } },
      ],
    },
  ],
};
