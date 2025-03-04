import { sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

// example schema

// export const users = sqliteTable("users", {
//   id: integer("id").primaryKey(),
//   name: text("name").notNull(),
//   email: text("email").unique().notNull(),
//   createdAt: integer("created_at", { mode: "timestamp" }).default(sql`CURRENT_TIMESTAMP`),
// });