import type { CollectionConfig, SelectField, Validate } from "payload";

import { adminOnlyAccess } from "@/lib/access";
import { BOTTLE_SIZES, COUNTRIES, isAdRestricted, OCCASIONS, PAIRINGS, STATUSES, WINE_TYPES } from "@/lib/catalogue";

// Access: every operation is `adminOnly` (a signed-in customer gets nothing either). `/api` is
// exempt from the age gate, so a public `read` would hand product information to an undeclared
// visitor (Decree 24/2020 Art. 6.1). The storefront reads through the Local API on the server.
// `lockDocuments: false`: Payload's lock collection admits any signed-in user, customers included.

const integerIn =
  (min: number, max: number): Validate<number | null | undefined> =>
  (value) =>
    value === null || value === undefined || (Number.isInteger(value) && value >= min && value <= max)
      ? true
      : `Must be a whole number from ${min} to ${max}.`;

const status: SelectField = {
  name: "status",
  type: "select",
  required: true,
  defaultValue: "draft",
  options: [...STATUSES],
  index: true,
};

const countryField: SelectField = { name: "country", type: "select", required: true, options: [...COUNTRIES] };

export const Producers: CollectionConfig = {
  slug: "producers",
  admin: { useAsTitle: "name", defaultColumns: ["name", "country", "region"] },
  access: adminOnlyAccess,
  lockDocuments: false,
  fields: [
    { name: "name", type: "text", required: true },
    countryField,
    { name: "region", type: "text", required: true },
    { name: "story", type: "textarea", required: true, localized: true },
  ],
};

export const Wines: CollectionConfig = {
  slug: "wines",
  admin: { useAsTitle: "name", defaultColumns: ["name", "producer", "type", "status"] },
  access: adminOnlyAccess,
  lockDocuments: false,
  fields: [
    {
      name: "slug",
      type: "text",
      required: true,
      unique: true,
      admin: { description: "Shared by both locales: /ruou-vang/<slug> and /en/ruou-vang/<slug>." },
      validate: (value: string | null | undefined) =>
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value ?? "") || "Lowercase letters, digits and single hyphens.",
    },
    { name: "producer", type: "relationship", relationTo: "producers", required: true },
    { name: "name", type: "text", required: true, localized: true },
    { name: "type", type: "select", required: true, options: [...WINE_TYPES] },
    countryField,
    { name: "region", type: "text", required: true },
    { name: "appellation", type: "text" },
    {
      name: "grapes",
      type: "array",
      required: true,
      minRows: 1,
      fields: [
        { name: "grape", type: "text", required: true },
        { name: "pct", type: "number", validate: integerIn(1, 100) },
      ],
    },
    {
      name: "tasting",
      type: "group",
      fields: [
        { name: "nose", type: "textarea", required: true, localized: true },
        { name: "palate", type: "textarea", required: true, localized: true },
        { name: "finish", type: "textarea", required: true, localized: true },
      ],
    },
    {
      name: "profile",
      type: "group",
      admin: { description: "Each axis from 1 (low) to 5 (high)." },
      fields: (["body", "tannin", "sweetness", "acidity"] as const).map((name) => ({
        name,
        type: "number" as const,
        required: true,
        validate: integerIn(1, 5),
      })),
    },
    { name: "pairings", type: "select", hasMany: true, options: [...PAIRINGS] },
    { name: "servingTempC", type: "number", required: true, validate: integerIn(4, 20) },
    { name: "occasions", type: "select", hasMany: true, options: [...OCCASIONS] },
    status,
  ],
};

export const Vintages: CollectionConfig = {
  slug: "vintages",
  admin: { defaultColumns: ["wine", "year", "bottleMl", "abvPct", "adRestricted", "priceVnd", "stock", "status"] },
  access: adminOnlyAccess,
  lockDocuments: false,
  fields: [
    { name: "wine", type: "relationship", relationTo: "wines", required: true, index: true },
    {
      name: "year",
      type: "number",
      admin: { description: "Leave empty for a non-vintage (NV) wine." },
      validate: integerIn(1900, 2100),
    },
    { name: "bottleMl", type: "select", required: true, options: BOTTLE_SIZES.map(String) },
    {
      name: "abvPct",
      type: "number",
      required: true,
      admin: { step: 0.1, description: "% vol." },
      validate: (value: number | null | undefined) =>
        (typeof value === "number" && value > 0 && value < 100) || "ABV must be above 0 and below 100.",
    },
    {
      // Derived on read from abvPct by `isAdRestricted`; `virtual` keeps it out of the database.
      name: "adRestricted",
      label: "No advertising or promotion (ABV ≥ 15%)",
      type: "checkbox",
      virtual: true,
      admin: {
        readOnly: true,
        description: "Law 44/2019 Art. 5.7 and 5.9. Derived from ABV; never stored.",
      },
      hooks: {
        afterRead: [({ siblingData }) => (typeof siblingData?.abvPct === "number" ? isAdRestricted(siblingData.abvPct) : undefined)],
      },
    },
    {
      name: "priceVnd",
      type: "number",
      required: true,
      admin: { description: "Whole VND, VAT included." },
      validate: integerIn(1, 1_000_000_000),
    },
    { name: "stock", type: "number", required: true, defaultValue: 0, validate: integerIn(0, 1_000_000) },
    { name: "drinkFrom", type: "number", validate: integerIn(1900, 2100) },
    {
      name: "drinkTo",
      type: "number",
      validate: ((value, { siblingData }) => {
        if (value == null) return true;
        if (!Number.isInteger(value) || value < 1900 || value > 2100) return "Must be a whole number from 1900 to 2100.";
        const from = siblingData.drinkFrom;
        return from == null || value >= from || "Must not be before drink-from.";
      }) satisfies Validate<number | null | undefined, unknown, { drinkFrom?: number | null }>,
    },
    { name: "importer", type: "text", required: true },
    status,
  ],
};
