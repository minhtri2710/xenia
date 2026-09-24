import type { GlobalConfig } from "payload";

import { wholeVnd } from "@/collections/orders";
import { isIsoDate } from "@/lib/delivery";
import { ZONES } from "@/lib/order";

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  // Admin-only like the catalogue: the storefront reads it through the Local API.
  fields: [
    {
      name: "zones",
      type: "array",
      admin: { description: "Delivery zones, their flat fee (whole VND, VAT included) and lead days (the earliest delivery date is today + lead days)." },
      validate: (rows: unknown) => {
        const zones = Array.isArray(rows) ? rows.map((r: { zone?: string }) => r.zone) : [];
        return new Set(zones).size === zones.length || "Each zone may appear only once.";
      },
      fields: [
        { name: "zone", type: "select", required: true, options: [...ZONES] },
        { name: "feeVnd", type: "number", required: true, validate: wholeVnd },
        {
          name: "leadDays",
          type: "number",
          required: true,
          validate: (value: unknown) => (Number.isSafeInteger(value) && (value as number) >= 1) || "Must be a whole number of at least 1.",
        },
      ],
    },
    {
      name: "blackoutDates",
      type: "array",
      admin: { description: "Dates with no delivery (for example a Tết cut-off), as YYYY-MM-DD on the Vietnamese calendar." },
      fields: [{ name: "date", type: "text", required: true, validate: (value: unknown) => isIsoDate(value) || "Use YYYY-MM-DD." }],
    },
  ],
};
