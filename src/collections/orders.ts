import type { CollectionConfig, Field, FieldAccess, Validate } from "payload";

import { MAX_NAME_LENGTH } from "@/lib/age";
import { MAX_ADDRESS_LENGTH, MAX_EMAIL_LENGTH } from "@/lib/buyer";
import { BOTTLE_SIZES } from "@/lib/catalogue";
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, ZONES } from "@/lib/order";

// Access: like the catalogue, Payload's default applies (every operation needs an authenticated
// admin) with two narrowings. Nobody creates an order over `/api` or in the admin: placement is a
// storefront server action through the Local API. Nobody deletes an order, admin included, and
// the Local API neither (Law 122 Art. 16.2b retention): `beforeDelete` refuses every delete.

const neverUpdate: FieldAccess = () => false;

/** A snapshot field: written once at placement (Local API), never edited afterwards. */
const snapshot = <F extends Field>(field: F): F => ({ ...field, access: { update: neverUpdate } }) as F;

export const wholeVnd: Validate<number | null | undefined> = (value) =>
  value === null || value === undefined || (Number.isSafeInteger(value) && value >= 0) || "Must be a whole number of VND.";

const vnd = (name: string): Field => ({ name, type: "number", required: true, validate: wholeVnd });

export const Orders: CollectionConfig = {
  slug: "orders",
  admin: {
    useAsTitle: "number",
    defaultColumns: ["number", "status", "createdAt"],
    description: "Orders are never deleted. Only the status can be changed here.",
  },
  access: {
    create: () => false,
    delete: () => false,
  },
  hooks: {
    beforeDelete: [
      () => {
        throw new Error("Orders are never deleted.");
      },
    ],
  },
  fields: [
    snapshot({ name: "number", type: "text", required: true, unique: true, admin: { readOnly: true } }),
    { name: "status", type: "select", required: true, defaultValue: "placed", options: [...ORDER_STATUSES], index: true },
    // The status link's secret: shown to nobody in the admin, never logged.
    snapshot({ name: "token", type: "text", required: true, unique: true, admin: { hidden: true } }),
    // Idempotency: one order per checkout key, enforced by the unique index.
    snapshot({ name: "clientKey", type: "text", required: true, unique: true, admin: { hidden: true } }),
    snapshot({
      name: "buyer",
      type: "group",
      admin: { readOnly: true },
      fields: [
        { name: "name", type: "text", required: true, maxLength: MAX_NAME_LENGTH },
        { name: "phone", type: "text", required: true },
        { name: "email", type: "email", required: true, maxLength: MAX_EMAIL_LENGTH },
        { name: "address", type: "textarea", required: true, maxLength: MAX_ADDRESS_LENGTH },
      ],
    }),
    // Decree 24/2020 Art. 6.1: the age check passed at this instant. The date of birth itself is never stored.
    snapshot({ name: "ageAttestedAt", type: "date", required: true, admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } }),
    snapshot({
      name: "delivery",
      type: "group",
      admin: { readOnly: true, description: "Delivered to the buyer at the buyer's address." },
      fields: [{ name: "zone", type: "select", required: true, options: [...ZONES] }],
    }),
    snapshot({
      name: "lines",
      type: "array",
      required: true,
      minRows: 1,
      admin: { readOnly: true },
      fields: [
        { name: "vintage", type: "relationship", relationTo: "vintages" },
        { name: "wineNameVi", type: "text", required: true },
        { name: "wineNameEn", type: "text", required: true },
        { name: "year", type: "number", admin: { description: "Empty for NV." } },
        { name: "bottleMl", type: "select", required: true, options: BOTTLE_SIZES.map(String) },
        { name: "abvPct", type: "number", required: true },
        vnd("unitPriceVnd"),
        { name: "qty", type: "number", required: true },
      ],
    }),
    snapshot({
      name: "totals",
      type: "group",
      admin: { readOnly: true, description: "Whole VND, VAT included." },
      fields: [vnd("goodsVnd"), vnd("shippingVnd"), vnd("vatIncludedVnd"), vnd("totalVnd")],
    }),
    snapshot({
      name: "consents",
      type: "group",
      admin: { readOnly: true },
      fields: [
        { name: "terms", type: "checkbox", required: true },
        { name: "privacy", type: "checkbox", required: true },
        { name: "at", type: "date", required: true, admin: { date: { pickerAppearance: "dayAndTime" } } },
      ],
    }),
    snapshot({
      name: "payment",
      type: "group",
      admin: { readOnly: true, description: "Mock payment only: no provider, no card or account number." },
      fields: [
        { name: "method", type: "select", options: [...PAYMENT_METHODS] },
        { name: "status", type: "select", required: true, defaultValue: "unpaid", options: [...PAYMENT_STATUSES] },
        { name: "paidAt", type: "date", admin: { date: { pickerAppearance: "dayAndTime" } } },
      ],
    }),
  ],
};
