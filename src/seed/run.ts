/**
 * `pnpm seed`: replaces the catalogue (vintages, wines, producers) with the fictional seed in
 * `data.ts`. It never touches `users` or any other collection. Same data on every run.
 */
import { getPayload } from "payload";

import config from "../payload.config";
import { IMPORTER, producers, wines } from "./data";

const payload = await getPayload({ config });

for (const collection of ["vintages", "wines", "producers"] as const) {
  await payload.delete({ collection, where: { id: { exists: true } } });
}

const producerIds = new Map<string, number>();
for (const p of producers) {
  const doc = await payload.create({
    collection: "producers",
    locale: "vi",
    data: { name: p.name, country: p.country, region: p.region, story: p.story.vi },
  });
  await payload.update({ collection: "producers", id: doc.id, locale: "en", data: { story: p.story.en } });
  producerIds.set(p.key, doc.id);
}

for (const w of wines) {
  const tasting = (l: "vi" | "en") => ({ nose: w.tasting.nose[l], palate: w.tasting.palate[l], finish: w.tasting.finish[l] });
  const doc = await payload.create({
    collection: "wines",
    locale: "vi",
    data: {
      slug: w.slug,
      producer: producerIds.get(w.producer)!,
      name: w.name.vi,
      type: w.type,
      country: w.country,
      region: w.region,
      appellation: w.appellation,
      grapes: w.grapes,
      tasting: tasting("vi"),
      profile: w.profile,
      pairings: w.pairings,
      servingTempC: w.servingTempC,
      occasions: w.occasions,
      status: w.status,
    },
  });
  await payload.update({ collection: "wines", id: doc.id, locale: "en", data: { name: w.name.en, tasting: tasting("en") } });
  for (const x of w.vintages) {
    await payload.create({
      collection: "vintages",
      data: { ...x, wine: doc.id, bottleMl: String(x.bottleMl) as "375" | "750" | "1500", importer: IMPORTER },
    });
  }
}

const counts = await Promise.all(
  (["producers", "wines", "vintages"] as const).map(async (c) => `${c}=${(await payload.count({ collection: c })).totalDocs}`),
);
payload.logger.info(`seed: ${counts.join(" ")}`);
await payload.destroy();
process.exit(0);
