import { expect, test } from "@playwright/test";

import { CARD_DESIGNS, PACKAGING, producers as seedProducers, wines as seedWines } from "../src/seed/data";
import { seedCatalogue, sql } from "./support";

const ADMIN_EMAIL = "admin@xenia.test";
const ADMIN_PASSWORD = "e2e-dev-only-password";

/** Every seeded vintage as `slug|year|ml` → id. */
function seededIds(): string {
  return sql(
    `SELECT string_agg(concat_ws('|', w.slug, coalesce(v.year::text, 'nv'), v.bottle_ml, v.id), ',' ORDER BY w.slug, v.year, v.bottle_ml) FROM vintages v JOIN wines w ON w.id = v.wine_id WHERE w.slug IN (${seedWines.map((w) => `'${w.slug}'`).join(",")})`,
  );
}

// Orders are never deleted and their numbers, tokens and keys are unique: each run has its own.
const RUN = `XN-SEED-${Date.now()}`;

/** The lines of this run's fixture orders only. */
function orderLines(): string {
  return sql(`SELECT string_agg(concat_ws(':', _parent_id, id, vintage_id), ',' ORDER BY _parent_id, id) FROM orders_lines WHERE _parent_id IN (SELECT id FROM orders WHERE number LIKE '${RUN}-%')`);
}

/** An order in a terminal status with one line on `vintage`: nothing in the app touches it. */
function insertOrder(n: number, vintage: number) {
  sql(
    `WITH o AS (INSERT INTO orders (number, status, token, client_key, payment_due_at, buyer_name, buyer_phone, buyer_email, buyer_address, age_attested_at, delivery_zone, delivery_mode, delivery_date, delivery_window, totals_goods_vnd, totals_wrap_vnd, totals_shipping_vnd, totals_vat_included_vnd, totals_total_vnd, consents_terms, consents_privacy, consents_at) VALUES ('${RUN}-${n}', 'cancelled', '${RUN}-token-${n}', '${RUN}-key-${n}', NOW(), 'An', '0901234567', 'an@example.test', 'HCMC', NOW(), 'hcmc', 'self', '2030-01-01', 'morning', 1000, 0, 0, 91, 1000, true, true, NOW()) RETURNING id) INSERT INTO orders_lines (_order, _parent_id, id, vintage_id, wine_name_vi, wine_name_en, year, bottle_ml, abv_pct, unit_price_vnd, qty) SELECT 1, o.id, '${RUN}-line-${n}', ${vintage}, 'Kiểm thử', 'Test', 2019, '750', 13, 1000, 1 FROM o`,
  );
}

test("the seed upserts: seeded ids and order lines stay, referenced non-seed rows are archived, the rest is removed, the published catalogue equals data.ts", async ({ request }) => {
  test.setTimeout(600_000);
  await seedCatalogue(request);
  const stamp = Date.now();
  const admin = request;

  sql("TRUNCATE users CASCADE");
  try {
    const registration = await admin.post("/api/users/first-register", {
      data: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, "confirm-password": ADMIN_PASSWORD },
    });
    expect(registration.ok(), `admin registration ${registration.status()}`).toBe(true);

    const create = async (path: string, data: object) => {
      const response = await admin.post(path, { data });
      expect(response.ok(), `${path} ${response.status()}`).toBe(true);
      return (await response.json()).doc.id as number;
    };
    const producer = (name: string) => create("/api/producers?locale=vi", { name, country: "FR", region: "Test", story: "Test." });
    const wine = (slug: string, producerId: number) =>
      create("/api/wines?locale=vi", {
        slug,
        producer: producerId,
        name: slug,
        type: "red",
        country: "FR",
        region: "Test",
        grapes: [{ grape: "Test", pct: 100 }],
        tasting: { nose: "x", palate: "x", finish: "x" },
        profile: { body: 3, tannin: 3, sweetness: 1, acidity: 3 },
        servingTempC: 16,
        status: "published",
      });
    const vintage = (wineId: number, year: number) =>
      create("/api/vintages", { wine: wineId, year, bottleMl: "750", abvPct: 13, priceVnd: 700_000, stock: 5, importer: "Test importer", status: "published" });

    // Non-seed rows: an ordered vintage (its wine and producer must stay), and rows nothing refers to.
    const keptProducer = await producer(`Seed test kept ${stamp}`);
    const orderedWine = await wine(`seed-test-ordered-${stamp}`, keptProducer);
    const orderedVintage = await vintage(orderedWine, 2020);
    const spareVintage = await vintage(orderedWine, 2019);
    const spareProducer = await producer(`Seed test spare ${stamp}`);
    const spareWine = await wine(`seed-test-spare-${stamp}`, spareProducer);
    const spareWineVintage = await vintage(spareWine, 2021);
    const lonelyProducer = await producer(`Seed test lonely ${stamp}`);

    // An order on a seeded vintage and one on the non-seed vintage.
    const lune2019 = (ml: number) => Number(sql(`SELECT v.id FROM vintages v JOIN wines w ON w.id = v.wine_id WHERE w.slug = 'lune-grise-rouge' AND v.year = 2019 AND v.bottle_ml = '${ml}'`));
    insertOrder(1, lune2019(750));
    insertOrder(2, orderedVintage);
    const linesBefore = orderLines();
    expect(linesBefore.split(",")).toHaveLength(2);

    // Drift from data.ts: the two sizes of one year swap rows, and price, stock and status change.
    sql(`UPDATE vintages SET bottle_ml = (CASE id WHEN ${lune2019(750)} THEN '1500' ELSE '750' END)::enum_vintages_bottle_ml WHERE id IN (${lune2019(750)}, ${lune2019(1500)})`);
    sql(`UPDATE vintages SET price_vnd = 1, stock = 0, status = 'draft' WHERE wine_id IN (SELECT id FROM wines WHERE slug IN (${seedWines.map((w) => `'${w.slug}'`).join(",")}))`);
    sql("UPDATE wines SET status = 'draft', region = 'drift' WHERE slug = 'lune-grise-rouge'");
    // Stale English copy on a seeded wine and producer.
    const driftWine = seedWines[0];
    const driftProducer = seedProducers.find((p) => p.key === driftWine.producer)!;
    sql(`UPDATE wines_locales SET name = 'stale', tasting_nose = 'stale', tasting_palate = 'stale', tasting_finish = 'stale' WHERE _locale = 'en' AND _parent_id = (SELECT id FROM wines WHERE slug = '${driftWine.slug}')`);
    sql(`UPDATE producers_locales SET story = 'stale' WHERE _locale = 'en' AND _parent_id = (SELECT id FROM producers WHERE name = '${driftProducer.name.replaceAll("'", "''")}')`);
    const idsBefore = seededIds();
    expect(idsBefore.split(",")).toHaveLength(seedWines.flatMap((w) => w.vintages).length);

    for (const run of [1, 2]) {
      await seedCatalogue(request);

      expect(seededIds(), `seeded ids after run ${run}`).toBe(idsBefore);
      expect(orderLines(), `order lines after run ${run}`).toBe(linesBefore);
      expect(sql("SELECT count(*) FROM orders_lines WHERE vintage_id IS NULL")).toBe("0");

      // Archived, not deleted: the ordered vintage and its wine are draft, its producer stays.
      expect(sql(`SELECT status FROM vintages WHERE id = ${orderedVintage}`)).toBe("draft");
      expect(sql(`SELECT status FROM wines WHERE id = ${orderedWine}`)).toBe("draft");
      expect(sql(`SELECT count(*) FROM producers WHERE id = ${keptProducer}`)).toBe("1");
      // Removed: nothing refers to them.
      expect(sql(`SELECT count(*) FROM vintages WHERE id IN (${spareVintage}, ${spareWineVintage})`)).toBe("0");
      expect(sql(`SELECT count(*) FROM wines WHERE id = ${spareWine}`)).toBe("0");
      expect(sql(`SELECT count(*) FROM producers WHERE id IN (${spareProducer}, ${lonelyProducer})`)).toBe("0");

      // The published catalogue is data.ts: slug, year, size, price and stock.
      const expected = seedWines
        .filter((w) => w.status === "published")
        .flatMap((w) => w.vintages.filter((x) => x.status === "published").map((x) => `${w.slug}|${x.year ?? "nv"}|${x.bottleMl}|${x.priceVnd}|${x.stock}`))
        .sort();
      const published = sql(
        "SELECT concat_ws('|', w.slug, coalesce(v.year::text, 'nv'), v.bottle_ml, v.price_vnd, v.stock) FROM vintages v JOIN wines w ON w.id = v.wine_id WHERE w.status = 'published' AND v.status = 'published'",
      )
        .split("\n")
        .filter(Boolean)
        .sort();
      expect(published, `published catalogue after run ${run}`).toEqual(expected);
      expect(sql("SELECT status || '|' || region FROM wines WHERE slug = 'lune-grise-rouge'")).toBe(
        `${seedWines.find((w) => w.slug === "lune-grise-rouge")!.status}|${seedWines.find((w) => w.slug === "lune-grise-rouge")!.region}`,
      );
      // Every field is refreshed in English too.
      expect(
        sql(`SELECT concat_ws('|', name, tasting_nose, tasting_palate, tasting_finish) FROM wines_locales WHERE _locale = 'en' AND _parent_id = (SELECT id FROM wines WHERE slug = '${driftWine.slug}')`),
        `English wine copy after run ${run}`,
      ).toBe([driftWine.name.en, driftWine.tasting.nose.en, driftWine.tasting.palate.en, driftWine.tasting.finish.en].join("|"));
      expect(
        sql(`SELECT story FROM producers_locales WHERE _locale = 'en' AND _parent_id = (SELECT id FROM producers WHERE name = '${driftProducer.name.replaceAll("'", "''")}')`),
        `English producer story after run ${run}`,
      ).toBe(driftProducer.story.en);
      expect(sql("SELECT count(*) FROM packaging")).toBe(String(PACKAGING.length));
      expect(sql("SELECT count(*) FROM card_designs")).toBe(String(CARD_DESIGNS.length));
    }
  } finally {
    sql("TRUNCATE users CASCADE");
  }
});
