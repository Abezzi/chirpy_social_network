import { MigrationConfig } from "drizzle-orm/migrator";
import { APIConfig, DBConfig } from "./index.js";

process.loadEnvFile();

const envOrThrow = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`environment variable ${key} is not set`);
  }
  return value;
};

const migrationConfig: MigrationConfig = {
  migrationsFolder: "./src/db/migrations",
};

export const apiConfig: APIConfig = {
  fileserverHits: 0,
  platform: envOrThrow("PLATFORM"),
  jwtSecret: envOrThrow("JWT_SECRET"),
  polkaKey: envOrThrow("POLKA_KEY")
};

export const dbConfig: DBConfig = {
  url: envOrThrow("DB_URL"),
  migrationConfig,
};
