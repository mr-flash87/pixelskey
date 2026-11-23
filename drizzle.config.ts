import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dbCredentials: {
    // Chaîne de connexion Postgres directe (Supabase > Project Settings > Database)
    url: process.env.DATABASE_URL ?? "",
  },
});
