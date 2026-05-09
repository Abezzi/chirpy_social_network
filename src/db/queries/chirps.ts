import { eq } from "drizzle-orm";
import { db } from "../index.js";
import { NewChirp, chirps } from "../schema.js";

export async function createChirp(chirp: NewChirp) {
  const [result] = await db
    .insert(chirps)
    .values(chirp)
    .returning();
  return result;
}

export async function getAllChirps() {
  return await db
    .select()
    .from(chirps)
    .orderBy(chirps.createdAt);
}

export async function getChirpById(id: string) {
  const result = await db
    .select()
    .from(chirps)
    .where(eq(chirps.id, id))
    .limit(1);

  return result[0];
}

export async function getChirpByUserId(id: string) {
  const [chirp] = await db
    .select({ userId: chirps.userId })
    .from(chirps)
    .where(eq(chirps.id, id));

  return chirp;
}

export async function deleteChirp(id: string) {
  const [result] = await db
    .delete(chirps)
    .where(eq(chirps.id, id));

  return result;
}
