import type { CollectionConfig } from "payload";

import { adminOnlyAccess } from "@/lib/access";
import { DELIVERY_MODES, DELIVERY_WINDOWS } from "@/lib/delivery";
import { ZONES } from "@/lib/order";

// The checkout state between steps (src/lib/checkout-drafts.ts). `adminOnly` access, and hidden in
// the admin. Holds personal data (buyer, recipient, message) for at most 24 h after its last
// write; it never holds a date of birth. Structured fields only.
export const CheckoutDrafts: CollectionConfig = {
  slug: "checkout-drafts",
  admin: { hidden: true },
  access: adminOnlyAccess,
  lockDocuments: false,
  fields: [
    // The cookie's bearer handle: 256 bits, looked up by equality only.
    { name: "handle", type: "text", required: true, unique: true },
    { name: "clientKey", type: "text", required: true },
    { name: "expiresAt", type: "date", required: true, index: true },
    {
      name: "buyer",
      type: "group",
      fields: [
        { name: "name", type: "text" },
        { name: "phone", type: "text" },
        { name: "email", type: "text" },
        { name: "address", type: "textarea" },
      ],
    },
    { name: "attestedAt", type: "date" },
    {
      name: "delivery",
      type: "group",
      fields: [
        { name: "zone", type: "select", options: [...ZONES] },
        { name: "mode", type: "select", options: [...DELIVERY_MODES] },
        {
          name: "recipient",
          type: "group",
          fields: [
            { name: "name", type: "text" },
            { name: "phone", type: "text" },
            { name: "address", type: "textarea" },
          ],
        },
        { name: "date", type: "text" },
        { name: "window", type: "select", options: [...DELIVERY_WINDOWS] },
      ],
    },
    {
      name: "gift",
      type: "group",
      fields: [
        { name: "saved", type: "checkbox" },
        { name: "packaging", type: "text" },
        { name: "card", type: "text" },
        { name: "message", type: "textarea" },
        { name: "sender", type: "text" },
        { name: "hidePrices", type: "checkbox" },
      ],
    },
  ],
};
