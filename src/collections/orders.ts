import type { CollectionConfig, Field, FieldAccess, Option, Validate } from "payload";

import { adminOnlyAccess } from "@/lib/access";
import { MAX_NAME_LENGTH } from "@/lib/age";
import { MAX_ADDRESS_LENGTH, MAX_EMAIL_LENGTH } from "@/lib/buyer";
import { BOTTLE_SIZES } from "@/lib/catalogue";
import { DELIVERY_MODES, DELIVERY_WINDOWS } from "@/lib/delivery";
import { MAX_MESSAGE_CODE_POINTS } from "@/lib/gift";
import { ORDER_STATUSES, PAYMENT_METHODS, PAYMENT_STATUSES, ZONES } from "@/lib/order";

// Access: like the catalogue, every operation is `adminOnly` (a signed-in customer gets nothing,
// not even their own orders: the storefront reads them through the Local API) with two
// narrowings. Nobody creates an order over `/api` or in the admin: placement is a storefront
// server action through the Local API. Nobody deletes an order, admin included, and the Local API
// neither (Law 122 Art. 16.2b retention): `beforeDelete` refuses every delete. Deleting a customer
// sets `customer` empty in the database; the order and its snapshots stay.

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
    ...adminOnlyAccess,
    create: () => false,
    delete: () => false,
  },
  lockDocuments: false,
  hooks: {
    beforeChange: [({ originalDoc }) => {
      if (originalDoc?.status === "expired") {
        throw new Error("An expired order cannot be changed.");
      }
    }],
    beforeDelete: [
      () => {
        throw new Error("Orders are never deleted.");
      },
    ],
  },
  fields: [
    snapshot({ name: "number", type: "text", required: true, unique: true, admin: { readOnly: true } }),
    {
      name: "status",
      type: "select",
      required: true,
      defaultValue: "placed",
      options: [...ORDER_STATUSES],
      filterOptions: ({ options }) => options.filter((option: Option) => (typeof option === "string" ? option : option.value) !== "expired"),
      index: true,
    },
    // The status link's secret: shown to nobody in the admin, never logged.
    snapshot({ name: "token", type: "text", required: true, unique: true, admin: { hidden: true } }),
    // Idempotency: one order per checkout key, enforced by the unique index.
    snapshot({ name: "clientKey", type: "text", required: true, unique: true, admin: { hidden: true } }),
    snapshot({ name: "paymentDueAt", type: "date", required: true, index: true, admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } }),
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
    // The account the order was placed under: set only when the buyer was signed in at placement,
    // never by matching emails (G82). Empty for a guest order and after the account is deleted.
    snapshot({ name: "customer", type: "relationship", relationTo: "customers", index: true, admin: { readOnly: true } }),
    // Decree 24/2020 Art. 6.1: the age check passed at this instant. The date of birth itself is never stored.
    snapshot({ name: "ageAttestedAt", type: "date", required: true, admin: { readOnly: true, date: { pickerAppearance: "dayAndTime" } } }),
    snapshot({
      name: "delivery",
      type: "group",
      admin: { readOnly: true, description: "Self: to the buyer at the buyer's address. Gift: to the recipient, who must be 18 or over and show ID." },
      fields: [
        { name: "zone", type: "select", required: true, options: [...ZONES] },
        { name: "mode", type: "select", required: true, options: [...DELIVERY_MODES] },
        {
          name: "recipient",
          type: "group",
          admin: { condition: (data) => data?.delivery?.mode === "gift" },
          fields: [
            { name: "name", type: "text", maxLength: MAX_NAME_LENGTH },
            { name: "phone", type: "text" },
            { name: "address", type: "textarea", maxLength: MAX_ADDRESS_LENGTH },
          ],
        },
        { name: "date", type: "text", required: true, admin: { description: "YYYY-MM-DD, Asia/Ho_Chi_Minh." } },
        { name: "window", type: "select", required: true, options: [...DELIVERY_WINDOWS] },
      ],
    }),
    snapshot({
      name: "gift",
      type: "group",
      admin: { readOnly: true, description: "Packaging for any order; card, message, sender and hide prices for a gift." },
      fields: [
        { name: "packagingCode", type: "text", admin: { description: "Empty: no packaging." } },
        { name: "packagingNameVi", type: "text" },
        { name: "packagingNameEn", type: "text" },
        { name: "packagingUnits", type: "number" },
        { name: "packagingUnitPriceVnd", type: "number", validate: wholeVnd },
        { name: "cardCode", type: "text" },
        { name: "cardNameVi", type: "text" },
        { name: "cardNameEn", type: "text" },
        { name: "message", type: "textarea", admin: { description: `Plain text, NFC, at most ${MAX_MESSAGE_CODE_POINTS} code points.` } },
        { name: "sender", type: "text", maxLength: MAX_NAME_LENGTH },
        { name: "anonymous", type: "checkbox" },
        { name: "hidePrices", type: "checkbox", admin: { description: "Packing instruction: no price or receipt in the parcel." } },
      ],
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
      fields: [vnd("goodsVnd"), vnd("wrapVnd"), vnd("shippingVnd"), vnd("vatIncludedVnd"), vnd("totalVnd")],
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
