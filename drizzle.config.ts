import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './drizzle',
  schema: './db/schema',
  dialect: 'postgresql',
  ...(process.env.NODE_ENV !== 'production' && {
    driver: 'pglite',
  }),
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
