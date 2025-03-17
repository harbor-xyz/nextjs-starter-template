import 'dotenv/config';

import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePgLite } from 'drizzle-orm/pglite';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http'

function getDb() {
  if (process.env.NODE_ENV === 'production') {
    return drizzleNeon(process.env.DATABASE_URL!)
  }
  const client = new PGlite(process.env.DATABASE_URL!);
  return drizzlePgLite({ client });
}

const db = getDb()

export { db };
