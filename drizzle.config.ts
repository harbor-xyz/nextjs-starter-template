import { defineConfig } from "drizzle-kit";
export default defineConfig({
  schema: "./db/schema",
  out: "./migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: 'file:./db/sqlite.db',
  },
});