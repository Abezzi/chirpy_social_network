import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema.js";
import { dbConfig } from "../config.js";

const conn = postgres(dbConfig.url);
export const db = drizzle(conn, { schema });
