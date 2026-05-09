import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { users } from "../schema.js";

export async function createUser(email: string, hashedPassword: string) {
  const [result] = await db
    .insert(users)
    .values({ email, hashedPassword })
    .onConflictDoNothing()
    .returning();
  return result;
}

export async function deleteAllUsers() {
  await db.delete(users);
}

export async function getUserByEmail(email: string) {
  const result = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return result[0];
}
