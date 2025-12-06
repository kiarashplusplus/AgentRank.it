import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

/**
 * Create a Drizzle database client from the D1 binding
 *
 * In Cloudflare Workers/Pages, the D1 binding is available via env
 * For local development, use wrangler or libsql
 */
export function createDb(d1: D1Database) {
    return drizzle(d1, { schema });
}

export type Database = ReturnType<typeof createDb>;
export { schema };
