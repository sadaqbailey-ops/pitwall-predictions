import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set. Run `neon env pull` or copy .env.example.");

// HTTP driver over the pooled connection string: one request per query,
// no sockets to manage, which suits serverless functions on Vercel.
export const db = drizzle(neon(url), { schema });
export { schema };
