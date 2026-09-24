import path from "node:path";
import { fileURLToPath } from "node:url";

import { postgresAdapter } from "@payloadcms/db-postgres";
import { buildConfig } from "payload";

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
    importMap: { baseDir: dirname },
  },
  collections: [
    {
      slug: "users",
      auth: true,
      admin: { useAsTitle: "email" },
      fields: [],
    },
  ],
  // Pre-launch: Payload pushes the schema in development; no migrations until first deploy.
  db: postgresAdapter({
    pool: { connectionString: requiredEnv("DATABASE_URI") },
  }),
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
