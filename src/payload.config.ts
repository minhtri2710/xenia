import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { sql } from "@payloadcms/db-postgres/drizzle";
import { check } from "@payloadcms/db-postgres/drizzle/pg-core";
import { buildConfig } from "payload";

import { Producers, Vintages, Wines } from "./collections/catalogue";
import { CheckoutDrafts } from "./collections/checkout-drafts";
import { Customers } from "./collections/customers";
import { CardDesigns, Packaging } from "./collections/gift";
import { Orders } from "./collections/orders";
import { MockOutbox } from "./collections/outbox";
import { QuoteRequests } from "./collections/quotes";
import { SiteSettings } from "./globals/site-settings";
import { adminOnlyAuthAccess } from "./lib/access";
import { mockEmailAdapter } from "./lib/outbox";
import { productionEnvProblems } from "./lib/production";

const dirname = path.dirname(fileURLToPath(import.meta.url));

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set. Copy .env.example to .env.`);
  return value;
}

// A production server refuses to serve with the dev placeholders (src/lib/production.ts).
const problems = productionEnvProblems(process.env);
if (problems.length > 0) throw new Error(`Refusing to serve in production:\n- ${problems.join("\n- ")}`);

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
      access: adminOnlyAuthAccess,
      lockDocuments: false,
      fields: [],
    },
    Customers,
    MockOutbox,
    Producers,
    Wines,
    Vintages,
    Packaging,
    CardDesigns,
    Orders,
    CheckoutDrafts,
    QuoteRequests,
  ],
  // All Payload mail (account verification and reset, the admin's forgot-password) is written to
  // the mock outbox; nothing is sent and it refuses in production (src/lib/outbox.ts).
  email: mockEmailAdapter,
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
  // Pre-launch: Payload pushes the schema in development; no migrations until the first deploy
  // creates the baseline in src/migrations (AGENTS.md, "Deployment").
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
