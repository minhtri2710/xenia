import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres/drizzle";
import { check } from "@payloadcms/db-postgres/drizzle/pg-core";
import { buildConfig } from "payload";

import { Producers, Vintages, Wines } from "./collections/catalogue";
import { Orders } from "./collections/orders";
import { SiteSettings } from "./globals/site-settings";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.`);
  return value;
}

export default buildConfig({
  secret: requiredEnv("PAYLOAD_SECRET"),
  admin: {
    user: "users",
    // Payload defaults to Gravatar, a third-party request carrying a hash of the admin email.
    avatar: "default",
    importMap: { baseDir: dirname },
  },
  collections: [
    {
      slug: "users",
      auth: true,
      admin: { useAsTitle: "email" },
      fields: [],
    },
    Producers,
    Wines,
    Vintages,
    Orders,
  ],
  globals: [SiteSettings],
  localization: {
    locales: [
      { code: "vi", label: "Tiếng Việt" },
      { code: "en", label: "English" },
    ],
    defaultLocale: "vi",
    // A missing translation is a content error the seed tests catch, not something to paper over.
    fallback: false,
  },
  // Pre-launch: Payload pushes the schema in development; no migrations until first deploy.
  db: postgresAdapter({
    pool: { connectionString: requiredEnv("DATABASE_URI") },
    afterSchemaInit: [
      // Stock never goes negative, even under concurrent orders: placement decrements it
      // atomically (`$inc`) and this constraint refuses an oversell (src/lib/place-order.ts).
      ({ schema, extendTable }) => {
        extendTable({
          table: schema.tables.vintages,
          extraConfig: (t) => ({ stockNonNegative: check("vintages_stock_non_negative", sql`${t.stock} >= 0`) }),
        });
        return schema;
      },
    ],
  }),
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
