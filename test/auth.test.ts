import { describe, it, expect, beforeAll } from "vitest";
import { makeJWT, validateJWT } from "../src/auth";

describe("JWT", () => {
  const secret = "test-secret-123";
  let validToken: string;
  const userID = "user-456";

  beforeAll(() => {
    validToken = makeJWT(userID, 60, secret);
  });

  it("should create and validate a jwt successfully", () => {
    const result = validateJWT(validToken, secret);
    expect(result).toBe(userID);
  });

  it("should reject an expired token", () => {
    const expiredToken = makeJWT(userID, -10, secret);
    expect(() => validateJWT(expiredToken, secret)).toThrow();
  });

  it("should reject a token signed with wrong secret", () => {
    const wrongSecret = "wrong-secret-456";
    expect(() => validateJWT(validToken, wrongSecret)).toThrow();
  });

  it("should reject malformed token", () => {
    expect(() => validateJWT("not.a.real.token", secret)).toThrow();
  });
});
