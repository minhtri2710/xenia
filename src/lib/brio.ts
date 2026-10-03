/**
 * The Brio page (`/brio`) promotes one wine of the catalogue, the one with slug `brio`. It is a
 * promotional surface, so it shows only while that wine is promotable: published, with at least
 * one published vintage and none restricted (`isRestrictedWine`). Otherwise the page is a 404 and
 * nothing links to it.
 */
import { type CatalogueVintage, isRestrictedWine } from "./catalogue";

export const BRIO_SLUG = "brio";
export const BRIO_PATH = "/brio";

export function isBrioPromotable(vintages: (CatalogueVintage & { status: "draft" | "published" })[]): boolean {
  const published = vintages.filter((v) => v.status === "published");
  return published.length > 0 && !isRestrictedWine({ vintages: published });
}
