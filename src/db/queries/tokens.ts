import { db } from "../index.js"; // adjust path
import { refreshTokens } from "../schema.js";
import { eq, and, gt, isNull } from "drizzle-orm";
import { makeRefreshToken } from "../../auth.js";

export async function createRefreshToken(userId: string) {
  const token = makeRefreshToken();
  // 60 days
  const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);

  const [result] = await db.insert(refreshTokens).values({
    token,
    userId,
    expiresAt,
    revokedAt: null,
  }).returning();

  return result;
}

export async function getUserFromRefreshToken(tokenString: string) {
  const now = new Date();

  const [tokenRecord] = await db
    .select()
    .from(refreshTokens)
    .where(
      and(
        eq(refreshTokens.token, tokenString),
        gt(refreshTokens.expiresAt, now),
        isNull(refreshTokens.revokedAt)
      )
    );

  return tokenRecord?.userId || null;
}

export async function revokeRefreshToken(tokenString: string) {
  const now = new Date();

  await db
    .update(refreshTokens)
    .set({
      revokedAt: now,
      updatedAt: now,
    })
    .where(eq(refreshTokens.token, tokenString));
}
