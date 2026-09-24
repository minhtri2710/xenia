import config from "@payload-config";
import { getPayload } from "payload";

import type { BottleSize, CatalogueWine } from "@/lib/catalogue";

/**
 * Published wines with their published vintages, read through the Local API. The catalogue
 * collections are admin-only over `/api`; this server-side read is the storefront's only path.
 */
export async function loadCatalogue(locale: "vi" | "en"): Promise<CatalogueWine[]> {
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
        vintages: own.map((x) => ({ priceVnd: x.priceVnd, bottleMl: Number(x.bottleMl) as BottleSize, stock: x.stock })),
      },
    ];
  });
}
