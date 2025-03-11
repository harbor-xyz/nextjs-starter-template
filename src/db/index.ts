import 'dotenv/config';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';

import { eq } from 'drizzle-orm';
import { usersTable } from './schema';

const client = new PGlite(process.env.DATABASE_URL!);
const db = drizzle({ client });

async function main() {
  const user: typeof usersTable.$inferInsert = {
    name: 'Avinash',
    age: 30,
    email: 'avinash@example.com',
  };
  await db.insert(usersTable).values(user);
  console.log('New user created!')
  const users = await db.select().from(usersTable);
  console.log('Getting all users from the database: ', users)
  /*
  const users: {
    id: number;
    name: string;
    age: number;
    email: string;
  }[]
  */
  await db
    .update(usersTable)
    .set({
      age: 31,
    })
    .where(eq(usersTable.email, user.email));
  console.log('User info updated!')
  // await db.delete(usersTable).where(eq(usersTable.email, user.email));
  // console.log('User deleted!')
}
main();

export default db;
