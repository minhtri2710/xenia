"use server";

import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";

import { getPathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { addLine, parseQuantity, removeLine, setLine } from "@/lib/cart";
import { readCartLines, vintageStock, writeCart } from "@/lib/shop-data";

const localeOf = (formData: FormData) => {
  const value = formData.get("locale");
  return hasLocale(routing.locales, value) ? value : routing.defaultLocale;
};

const toCart = (formData: FormData, error?: "quantity" | "unavailable"): never =>
  redirect(getPathname({ href: { pathname: "/gio-hang", query: error ? { error } : {} }, locale: localeOf(formData) }));

/** Adds the product page's current selection. Only a published vintage of a published wine with stock. */
export async function addToCart(formData: FormData) {
  const id = parseQuantity(formData.get("vintageId"));
  const qty = parseQuantity(formData.get("qty"));
  if (!qty) toCart(formData, "quantity");
  const stock = id ? await vintageStock(id) : undefined;
  if (!id || !stock?.purchasable || stock.stock <= 0) toCart(formData, "unavailable");
  await writeCart(addLine(await readCartLines(), id!, qty!, stock!.stock));
  toCart(formData);
}

/** Sets a line's quantity, capped at stock. A non-positive or fractional quantity changes nothing. */
export async function updateCartLine(formData: FormData) {
  const id = parseQuantity(formData.get("vintageId"));
  const qty = parseQuantity(formData.get("qty"));
  if (!id || !qty) toCart(formData, "quantity");
  const stock = await vintageStock(id!);
  const lines = await readCartLines();
  if (!stock?.purchasable || stock.stock <= 0) {
    await writeCart(removeLine(lines, id!));
    toCart(formData, "unavailable");
  }
  await writeCart(setLine(lines, id!, qty!, stock!.stock));
  toCart(formData);
}

export async function removeCartLine(formData: FormData) {
  const id = parseQuantity(formData.get("vintageId"));
  if (id) await writeCart(removeLine(await readCartLines(), id));
  toCart(formData);
}
