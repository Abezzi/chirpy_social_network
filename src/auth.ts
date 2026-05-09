import * as argon2 from "argon2";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
import { Request } from "express";

type payload = Pick<JwtPayload, "iss" | "sub" | "iat" | "exp">;

export const hashPassword = async (password: string): Promise<string> => {
  return await argon2.hash(password);
};

export const checkPasswordHash = async (password: string, hash: string): Promise<boolean> => {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
};

// create a signed jwt for a user
export const makeJWT = (userID: string, expiresIn: number, secret: string): string => {
  const iat = Math.floor(Date.now() / 1000);
  const payload: payload = {
    iss: "chirpy",
    sub: userID,
    iat: iat,
    exp: iat + expiresIn,
  };

  return jwt.sign(payload, secret);
};

// validate a jwt and return the user id (sub) or throw
export const validateJWT = (tokenString: string, secret: string): string => {
  try {
    const decoded = jwt.verify(tokenString, secret) as JwtPayload;
    if (!decoded.sub) {
      throw new Error("missing sub in token");
    }
    return decoded.sub;
  } catch (error) {
    throw new Error("invalid token");
  }
};

// extract bearer token from authorization header or throw
export const getBearerToken = (req: Request): string => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new Error("no authorization header");
  }

  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    throw new Error("invalid authorization header");
  }

  return parts[1];
};
