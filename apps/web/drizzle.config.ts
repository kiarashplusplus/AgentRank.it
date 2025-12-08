import "dotenv/config";
import type { Config } from "drizzle-kit";

// Load .env.local for local development
import { config } from "dotenv";
config({ path: ".env.local" });

// Cloudflare D1 HTTP driver for all environments
export default {
    schema: "./src/db/schema.ts",
    out: "./drizzle",
    dialect: "sqlite",
    driver: "d1-http",
    dbCredentials: {
        accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
        databaseId: process.env.CLOUDFLARE_D1_DATABASE_ID!,
        token: process.env.CLOUDFLARE_API_TOKEN!,
    },
} satisfies Config;
