import type { CollectionConfig, Field, FieldAccess } from "payload";

import { adminOnlyAccess } from "@/lib/access";
import { MAX_NAME_LENGTH } from "@/lib/age";
import { MAX_EMAIL_LENGTH } from "@/lib/buyer";
import { PRICE_BANDS } from "@/lib/catalogue";
import { MAX_COMPANY_LENGTH, MAX_QUANTITY, MAX_QUOTE_MESSAGE_CODE_POINTS, QUOTE_OCCASIONS, QUOTE_SLUG, QUOTE_STATUSES } from "@/lib/quote";

// Corporate gift quote requests from `/lien-he`. Like orders: `adminOnly` for every operation,
// nobody creates one over `/api` or in the admin (the storefront's server action writes through
// the Local API), and what the visitor sent is never edited afterwards; the admin only moves the
// status along. An admin may delete a request, for example when its sender asks.

const neverUpdate: FieldAccess = () => false;
const sent = <F extends Field>(field: F): F => ({ ...field, access: { update: neverUpdate }, admin: { readOnly: true } }) as F;

export const QuoteRequests: CollectionConfig = {
  slug: QUOTE_SLUG,
  admin: {
    useAsTitle: "company",
    defaultColumns: ["company", "name", "occasion", "quantity", "status", "createdAt"],
    description: "Quote requests from the contact page. Only the status can be changed here.",
  },
  defaultSort: "-createdAt",
  access: { ...adminOnlyAccess, create: () => false },
  lockDocuments: false,
  fields: [
    sent({ name: "company", type: "text", required: true, maxLength: MAX_COMPANY_LENGTH }),
    sent({ name: "name", type: "text", required: true, maxLength: MAX_NAME_LENGTH }),
    sent({ name: "email", type: "email", required: true, maxLength: MAX_EMAIL_LENGTH }),
    sent({ name: "phone", type: "text", required: true }),
    sent({ name: "occasion", type: "select", required: true, options: [...QUOTE_OCCASIONS] }),
    sent({ name: "quantity", type: "number", required: true, min: 1, max: MAX_QUANTITY }),
    sent({ name: "budget", type: "select", options: PRICE_BANDS.map((b) => b.id) }),
    sent({ name: "message", type: "textarea", maxLength: MAX_QUOTE_MESSAGE_CODE_POINTS * 4 }),
    sent({ name: "privacyAcceptedAt", type: "date", required: true, admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } }),
    { name: "status", type: "select", required: true, defaultValue: "new", options: [...QUOTE_STATUSES], index: true },
  ],
};
