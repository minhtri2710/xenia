import type { GlobalConfig } from "payload";

import { wholeVnd } from "@/collections/orders";
import { adminOnlyGlobalAccess } from "@/lib/access";
import { isIsoDate } from "@/lib/delivery";
import { ZONES } from "@/lib/order";
import { validateContactEmail, validateContactPhone, validateOptionalHttpsUrl, validateRequiredText, validateSettingsDate } from "@/lib/site-settings";

export const SiteSettings: GlobalConfig = {
  slug: "site-settings",
  // `adminOnly` like the catalogue: the storefront reads it through the Local API.
  access: adminOnlyGlobalAccess,
  lockDocuments: false,
  fields: [
    {
      name: "owner",
      type: "group",
      fields: [
        { name: "legalName", type: "text", required: true, validate: validateRequiredText },
        { name: "headOffice", type: "textarea", required: true, validate: validateRequiredText },
        { name: "legalRepresentative", type: "text", required: true, validate: validateRequiredText },
        {
          name: "businessRegistration",
          type: "group",
          fields: [
            { name: "number", type: "text", required: true, validate: validateRequiredText },
            { name: "date", type: "text", required: true, validate: validateSettingsDate },
            { name: "place", type: "text", required: true, validate: validateRequiredText },
          ],
        },
        {
          name: "alcoholLicence",
          type: "group",
          fields: [
            { name: "number", type: "text", required: true, validate: validateRequiredText },
            { name: "issuer", type: "text", required: true, validate: validateRequiredText },
            { name: "date", type: "text", required: true, validate: validateSettingsDate },
          ],
        },
        { name: "contactEmail", type: "text", required: true, validate: validateContactEmail },
        { name: "contactPhone", type: "text", required: true, validate: validateContactPhone },
        { name: "notificationLink", type: "text", validate: validateOptionalHttpsUrl },
      ],
    },
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
