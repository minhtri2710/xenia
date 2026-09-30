import config from "@payload-config";
import { getPayload } from "payload";

import type { BottleSize, CatalogueWine } from "@/lib/catalogue";
import { releaseExpiredOrders } from "@/lib/order-expiry";
import type { Producer, Vintage, Wine } from "@/payload-types";

/**
 * Published wines with their published vintages, read through the Local API. The catalogue
 * collections are admin-only over `/api`; this server-side read is the storefront's only path.
 */
export async function loadCatalogue(locale: "vi" | "en"): Promise<CatalogueWine[]> {
  await releaseExpiredOrders(new Date());
  const payload = await getPayload({ config });
  const [wines, vintages] = await Promise.all([
    payload.find({ collection: "wines", where: { status: { equals: "published" } }, locale, depth: 1, pagination: false }),
    payload.find({ collection: "vintages", where: { status: { equals: "published" } }, depth: 0, pagination: false }),
  ]);
  return wines.docs.flatMap((w) => {
    const own = vintages.docs.filter((x) => x.wine === w.id);
    if (own.length === 0 || typeof w.producer !== "object") return [];
    return [
      {
        slug: w.slug,
        name: w.name,
        producer: w.producer.name,
        type: w.type,
        country: w.country,
        region: w.region,
        grapes: w.grapes.map((g) => g.grape),
        occasions: w.occasions ?? [],
        vintages: own.map((x) => ({ priceVnd: x.priceVnd, bottleMl: Number(x.bottleMl) as BottleSize, stock: x.stock, abvPct: x.abvPct })),
      },
    ];
  });
}

export type ProductVintage = Omit<Vintage, "year" | "bottleMl"> & { year: number | null; bottleMl: BottleSize };

/**
 * A published wine by slug with its producer and every vintage, drafts included: the pure
 * `selectVintage` is the one place that drops draft vintages. `null` for a draft or unknown slug.
 */
export async function loadWine(
  slug: string,
  locale: "vi" | "en",
): Promise<{ wine: Wine & { producer: Producer }; vintages: ProductVintage[] } | null> {
  await releaseExpiredOrders(new Date());
  const payload = await getPayload({ config });
  const { docs } = await payload.find({
    collection: "wines",
    where: { and: [{ slug: { equals: slug } }, { status: { equals: "published" } }] },
    locale,
    depth: 1,
    limit: 1,
  });
  const wine = docs[0];
  if (!wine || typeof wine.producer !== "object") return null;
  const vintages = await payload.find({ collection: "vintages", where: { wine: { equals: wine.id } }, depth: 0, pagination: false });
  return {
    wine: { ...wine, producer: wine.producer },
    vintages: vintages.docs.map((x) => ({ ...x, year: x.year ?? null, bottleMl: Number(x.bottleMl) as BottleSize })),
  };
}
