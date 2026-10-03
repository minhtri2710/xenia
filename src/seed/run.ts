/**
 * `pnpm seed`: upserts the catalogue (producers, wines, vintages) to the fictional seed in `data.ts`,
 * replaces the packaging and the card designs, and sets the delivery zones (fee and lead days) and
 * an empty blackout list in the `site-settings` global. Seeded rows are matched by natural key
 * (producer by name, wine by slug, vintage by wine, year and bottle size; NV has no year) and
 * updated in both locales, so their ids stay the same from run to run. A catalogue row that is not
 * in the seed is deleted when nothing references it. A vintage with an order line, and its wine,
 * are set to draft instead; a producer that still has wines stays. The run never deletes a row an
 * order refers to and unlinks no order line. It writes no other collection and creates or deletes
 * no `users`, `orders` or `checkout-drafts` row. Same published catalogue on every run.
 */
import { getPayload } from "payload";

import config from "../payload.config";
import { CARD_DESIGNS, IMPORTER, PACKAGING, producers, SAMPLE_OWNER, wines, ZONE_FEES } from "./data";

const payload = await getPayload({ config });

const all = { depth: 0, limit: 0, pagination: false, sort: "id" } as const;

for (const collection of ["packaging", "card-designs"] as const) {
  await payload.delete({ collection, where: { id: { exists: true } } });
}

const producerIds = new Map<string, number>();
const seededProducers = new Set<number>();
const existingProducers = (await payload.find({ collection: "producers", ...all })).docs;
for (const p of producers) {
  const data = { name: p.name, country: p.country, region: p.region, story: p.story.vi };
  const found = existingProducers.find((x) => x.name === p.name && !seededProducers.has(x.id));
  const doc = found
    ? await payload.update({ collection: "producers", id: found.id, locale: "vi", data })
    : await payload.create({ collection: "producers", locale: "vi", data });
  await payload.update({ collection: "producers", id: doc.id, locale: "en", data: { story: p.story.en } });
  producerIds.set(p.key, doc.id);
  seededProducers.add(doc.id);
}

const seededWines = new Set<number>();
const seededVintages = new Set<number>();
const existingWines = (await payload.find({ collection: "wines", ...all })).docs;
for (const w of wines) {
  const tasting = (l: "vi" | "en") => ({ nose: w.tasting.nose[l], palate: w.tasting.palate[l], finish: w.tasting.finish[l] });
  const data = {
    slug: w.slug,
    producer: producerIds.get(w.producer)!,
    name: w.name.vi,
    type: w.type,
    country: w.country,
    region: w.region,
    appellation: w.appellation ?? null,
    grapes: w.grapes,
    tasting: tasting("vi"),
    profile: w.profile,
    pairings: w.pairings,
    servingTempC: w.servingTempC,
    occasions: w.occasions,
    featured: w.featured ?? false,
    status: w.status,
  };
  const found = existingWines.find((x) => x.slug === w.slug);
  const doc = found
    ? await payload.update({ collection: "wines", id: found.id, locale: "vi", data })
    : await payload.create({ collection: "wines", locale: "vi", data });
  await payload.update({ collection: "wines", id: doc.id, locale: "en", data: { name: w.name.en, tasting: tasting("en") } });
  seededWines.add(doc.id);

  const existingVintages = found
    ? (await payload.find({ collection: "vintages", where: { wine: { equals: doc.id } }, ...all })).docs
    : [];
  for (const x of w.vintages) {
    const vintage = { ...x, wine: doc.id, bottleMl: String(x.bottleMl) as "375" | "750" | "1500", drinkFrom: x.drinkFrom ?? null, drinkTo: x.drinkTo ?? null, importer: IMPORTER };
    const match = existingVintages.find((v) => v.year === x.year && v.bottleMl === vintage.bottleMl && !seededVintages.has(v.id));
    const saved = match
      ? await payload.update({ collection: "vintages", id: match.id, data: vintage })
      : await payload.create({ collection: "vintages", data: vintage });
    seededVintages.add(saved.id);
  }
}

// Everything the seed does not list: deleted when no order refers to it, else archived (draft).
const referencedBy = async (vintageId: number) =>
  (await payload.count({ collection: "orders", where: { "lines.vintage": { equals: vintageId } } })).totalDocs > 0;

for (const v of (await payload.find({ collection: "vintages", ...all })).docs) {
  if (seededVintages.has(v.id)) continue;
  if (await referencedBy(v.id)) await payload.update({ collection: "vintages", id: v.id, data: { status: "draft" } });
  else await payload.delete({ collection: "vintages", id: v.id });
}

for (const w of (await payload.find({ collection: "wines", ...all })).docs) {
  if (seededWines.has(w.id)) continue;
  const left = (await payload.count({ collection: "vintages", where: { wine: { equals: w.id } } })).totalDocs;
  if (left > 0) await payload.update({ collection: "wines", id: w.id, data: { status: "draft" } });
  else await payload.delete({ collection: "wines", id: w.id });
}

for (const p of (await payload.find({ collection: "producers", ...all })).docs) {
  if (seededProducers.has(p.id)) continue;
  const left = (await payload.count({ collection: "wines", where: { producer: { equals: p.id } } })).totalDocs;
  if (left === 0) await payload.delete({ collection: "producers", id: p.id });
}

for (const p of PACKAGING) {
  const doc = await payload.create({
    collection: "packaging",
    locale: "vi",
    data: { ...p, name: p.name.vi, description: p.description.vi, fits: p.fits.map((ml) => String(ml) as "375" | "750" | "1500"), active: true },
  });
  await payload.update({ collection: "packaging", id: doc.id, locale: "en", data: { name: p.name.en, description: p.description.en } });
}

for (const c of CARD_DESIGNS) {
  const doc = await payload.create({ collection: "card-designs", locale: "vi", data: { code: c.code, name: c.name.vi, active: true } });
  await payload.update({ collection: "card-designs", id: doc.id, locale: "en", data: { name: c.name.en } });
}

await payload.updateGlobal({ slug: "site-settings", data: { owner: SAMPLE_OWNER, zones: ZONE_FEES.map((z) => ({ ...z })), blackoutDates: [] } });

const counts = await Promise.all(
  (["producers", "wines", "vintages", "packaging", "card-designs"] as const).map(async (c) => `${c}=${(await payload.count({ collection: c })).totalDocs}`),
);
payload.logger.info(`seed: ${counts.join(" ")}`);
await payload.destroy();
process.exit(0);
