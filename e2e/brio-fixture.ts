/**
 * `BRIO_ABV=<abv|absent> pnpm payload run e2e/brio-fixture.ts`: puts a published `brio` wine with
 * one published 750 ml vintage at that ABV in the catalogue, or removes it (and its test producer).
 * The next `pnpm seed` would delete it too: it is not in the seed and no order refers to it.
 */
import { getPayload } from "payload";

import config from "../src/payload.config";

const PRODUCER = "Brio Test Producer (E2E)";
const abv = process.env.BRIO_ABV ?? "absent";
const payload = await getPayload({ config });

const wine = (await payload.find({ collection: "wines", where: { slug: { equals: "brio" } }, depth: 0, limit: 1 })).docs[0];
if (wine) {
  await payload.delete({ collection: "vintages", where: { wine: { equals: wine.id } } });
  await payload.delete({ collection: "wines", id: wine.id });
}
await payload.delete({ collection: "producers", where: { name: { equals: PRODUCER } } });

if (abv !== "absent") {
  const producer = await payload.create({ collection: "producers", locale: "vi", data: { name: PRODUCER, country: "VN", region: "Ninh Thuận", story: "Nhà sản xuất thử nghiệm." } });
  await payload.update({ collection: "producers", id: producer.id, locale: "en", data: { story: "A test producer." } });
  const tasting = { nose: "Nho chín.", palate: "Nhẹ, tươi.", finish: "Gọn." };
  const created = await payload.create({
    collection: "wines",
    locale: "vi",
    data: {
      slug: "brio",
      producer: producer.id,
      name: "Brio",
      type: "white",
      country: "VN",
      region: "Ninh Thuận",
      grapes: [{ grape: "Muscat", pct: 100 }],
      tasting,
      profile: { body: 2, tannin: 1, sweetness: 3, acidity: 3 },
      pairings: [],
      servingTempC: 8,
      occasions: ["gift"],
      featured: false,
      status: "published",
    },
  });
  await payload.update({ collection: "wines", id: created.id, locale: "en", data: { name: "Brio", tasting: { nose: "Ripe grapes.", palate: "Light and fresh.", finish: "Clean." } } });
  await payload.create({
    collection: "vintages",
    data: { wine: created.id, year: 2026, bottleMl: "750", abvPct: Number(abv), priceVnd: 450_000, stock: 10, importer: "Brio (E2E)", status: "published" },
  });
}
await payload.destroy();
process.exit(0);
