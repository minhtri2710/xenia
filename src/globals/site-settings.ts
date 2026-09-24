import type { GlobalConfig } from "payload";

import { wholeVnd } from "@/collections/orders";
import { ZONES } from "@/lib/order";

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  // Admin-only like the catalogue: the storefront reads it through the Local API.
  fields: [
    {
      name: "zones",
      type: "array",
      admin: { description: "Delivery zones and their flat fee (whole VND, VAT included)." },
      validate: (rows: unknown) => {
        const zones = Array.isArray(rows) ? rows.map((r: { zone?: string }) => r.zone) : [];
        return new Set(zones).size === zones.length || "Each zone may appear only once.";
      },
      fields: [
        { name: "zone", type: "select", required: true, options: [...ZONES] },
        { name: "feeVnd", type: "number", required: true, validate: wholeVnd },
      ],
    },
  ],
};
