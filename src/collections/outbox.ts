import type { CollectionConfig } from "payload";

import { adminOnly } from "@/lib/access";
import { OUTBOX_SLUG } from "@/lib/outbox";

// The dev-only mock outbox (F8 D3): the only place account mail goes (src/lib/outbox.ts). Written
// only by the email adapter through the Local API, and read-only for everyone, admin included:
// nothing here can be created, edited or deleted over REST or in the admin. Messages hold a
// verification or reset link, so they are `adminOnly` to read and expire by the adapter's TTL.
export const MockOutbox: CollectionConfig = {
  slug: OUTBOX_SLUG,
  admin: {
    useAsTitle: "subject",
    defaultColumns: ["sentAt", "to", "subject"],
    description: "Pre-launch mock: account mail is written here and sent nowhere. Read-only.",
  },
  defaultSort: "-sentAt",
  access: { read: adminOnly, readVersions: adminOnly, create: () => false, update: () => false, delete: () => false },
  lockDocuments: false,
  fields: [
    { name: "to", type: "text", required: true, admin: { readOnly: true } },
    { name: "subject", type: "text", required: true, admin: { readOnly: true } },
    { name: "body", type: "textarea", required: true, admin: { readOnly: true } },
    { name: "sentAt", type: "date", required: true, index: true, admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } },
  ],
};
