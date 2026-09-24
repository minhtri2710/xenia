import type { CollectionConfig, Validate } from "payload";

import { BOTTLE_SIZES } from "@/lib/catalogue";
import { isCode } from "@/lib/gift";

// Access: neither collection sets `access`, so Payload's default applies and every operation over
// `/api` needs an authenticated admin, like the catalogue. The storefront reads them through the
// Local API on the server.

const code: Validate<string | null | undefined> = (value) => isCode(value) || "Lower-case letters, digits and hyphens only.";

const atLeastOne: Validate<number | null | undefined> = (value) =>
  (Number.isSafeInteger(value) && (value as number) >= 1) || "Must be a whole number of at least 1.";

export const Packaging: CollectionConfig = {
  slug: "packaging",
  admin: { useAsTitle: "code", defaultColumns: ["code", "name", "capacity", "fits", "priceVnd", "active"] },
  fields: [
    { name: "code", type: "text", required: true, unique: true, validate: code },
    { name: "name", type: "text", required: true, localized: true },
    { name: "description", type: "textarea", required: true, localized: true },
    { name: "capacity", type: "number", required: true, validate: atLeastOne, admin: { description: "Bottles per unit." } },
    { name: "fits", type: "select", hasMany: true, required: true, options: BOTTLE_SIZES.map(String), admin: { description: "Bottle sizes (ml) it takes." } },
    // No free wrap (Law 44/2019 Art. 5.9): every price is at least 1 VND.
    { name: "priceVnd", type: "number", required: true, validate: atLeastOne, admin: { description: "Per unit, whole VND, VAT included. At least 1." } },
    { name: "active", type: "checkbox", required: true, defaultValue: true },
  ],
};

export const CardDesigns: CollectionConfig = {
  slug: "card-designs",
  admin: { useAsTitle: "code", defaultColumns: ["code", "name", "active"] },
  fields: [
    { name: "code", type: "text", required: true, unique: true, validate: code },
    { name: "name", type: "text", required: true, localized: true },
    { name: "active", type: "checkbox", required: true, defaultValue: true },
  ],
};
