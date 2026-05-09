import express from "express";
import { Request, Response, NextFunction } from "express";
import { apiConfig, dbConfig } from "./config.js";
import type { MigrationConfig } from "drizzle-orm/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createUser, deleteAllUsers, getUserByEmail, updateUsers } from "./db/queries/users.js";
import { createChirp, deleteChirp, getAllChirps, getChirpById, getChirpByUserId } from "./db/queries/chirps.js";
import { User } from "./db/schema.js";
import { checkPasswordHash, getBearerToken, hashPassword, makeJWT, validateJWT } from "./auth.js";
import { createRefreshToken, getUserFromRefreshToken, revokeRefreshToken } from "./db/queries/tokens.js";

export type APIConfig = {
  fileserverHits: number;
  platform: string;
  jwtSecret: string;
};

export type DBConfig = {
  url: string;
  migrationConfig: MigrationConfig
};

type UserResponse = Omit<User, 'hashed_password'>;

const app = express();
const PORT = 8080;

const migrationClient = postgres(dbConfig.url, { max: 1 });
await migrate(drizzle(migrationClient), dbConfig.migrationConfig);

app.use(express.json());

// custom error classes
class BadRequestError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = "BadRequestError";
  }
}

class UnauthorizedError extends Error {
  statusCode = 401;
  constructor(message: string) {
    super(message);
    this.name = "UnauthorizedError";
  }
}

class ForbiddenError extends Error {
  statusCode = 403;
  constructor(message: string) {
    super(message);
    this.name = "ForbiddenError";
  }
}

class NotFoundError extends Error {
  statusCode = 404;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}

const handlerReadiness = (_req: Request, res: Response) => {
  res.set("Content-Type", "text/plain");
  res.send("OK");
}

// middleware that logs non-ok
const middlewareLogging = (req: Request, res: Response, next: NextFunction) => {
  res.on("finish", () => {
    if (res.statusCode !== 200) {
      console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`)
    }
  });
  next();
}

const middlewareMetricsInc = (_req: Request, _res: Response, next: NextFunction) => {
  apiConfig.fileserverHits += 1;
  next();
}

const handlerMetrics = (_req: Request, res: Response) => {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`
  <html>
    <body>
      <h1>Welcome, Chirpy Admin</h1>
      <p>Chirpy has been visited ${apiConfig.fileserverHits} times!</p>
    </body>
  </html>
    `.trim()
  );
};

const handlerReset = async (_req: Request, res: Response) => {
  if (apiConfig.platform !== "dev") {
    res.status(403).json({ error: "forbidden" });
    return;
  }

  apiConfig.fileserverHits = 0;
  await deleteAllUsers();
  res.set("Content-Type", "text/plain");
  res.send(`hits reset to 0`);
};

const handlerCreateChirp = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const userID = validateJWT(token, apiConfig.jwtSecret);
    const { body } = req.body;

    if (!body || typeof body !== "string") {
      res.status(400).json({ error: "body is required" });
      return;
    }

    if (body.length > 140) {
      res.status(400).json({ error: "chirp is too long" });
      return;
    }

    const blackList = ["kerfuffle", "sharbert", "fornax"];
    let cleanedBody = body;
    blackList.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      cleanedBody = cleanedBody.replace(regex, "****");
    });

    if (!userID || typeof userID !== "string") {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const chirp = await createChirp({
      body: cleanedBody,
      userId: userID,
    });

    res.status(201).json({
      id: chirp.id,
      body: chirp.body,
      createdAt: chirp.createdAt,
      updatedAt: chirp.updatedAt,
      userId: userID
    });
  } catch (error: any) {
    if (error.message.includes("invalid") || error.message.includes("no authorization")) {
      res.status(401).json({ error: "invalid token" });
      return;
    }
    res.status(500).json({ error: "something went wrong" });
  }
};


const handlerGetChirps = async (_req: Request, res: Response) => {
  try {
    const chirps = await getAllChirps();
    res.status(200).json(chirps);
  } catch (error) {
    res.status(500).json({ error: "something went wrong" });
  }
}

const handlerGetChirp = async (req: Request, res: Response) => {
  try {
    const { chirpId } = req.params;

    if (!chirpId) {
      res.status(400).json({ error: "chirpId is required" });
      return;
    }

    if (typeof chirpId !== "string") {
      return;
    }

    const chirp = await getChirpById(chirpId);

    if (!chirp) {
      res.status(404).json({ error: "chirp not found" });
      return;
    }

    res.status(200).json(chirp);
  } catch (error) {
    res.status(500).json({ error: "something went wrong" });
  }
}

const handlerCreateUser = async (req: Request, res: Response) => {
  try {
    const { password, email } = req.body;

    if (!email || typeof email !== "string" || !password || typeof password !== "string") {
      res.status(400).json({ error: "email and password are required" });
      return;
    }

    const hashedPasswordHandler = await hashPassword(password);

    const user = await createUser(email, hashedPasswordHandler);

    const { hashedPassword, ...userResponse } = user;

    if (!user) {
      res.status(400).json({ error: "user already exists" });
      return;
    }

    res.status(201).json(userResponse);
  } catch (error) {
    res.status(500).json({ error: "something went wrong" });
  }
};

const handlerLogin = async (req: Request, res: Response) => {
  try {
    const { password, email } = req.body;

    if (!password || !email) {
      res.status(400).json({ error: "password and email are required" });
      return;
    }

    const user = await getUserByEmail(email);

    if (!user || !(await checkPasswordHash(password, user.hashedPassword))) {
      res.status(401).json({ error: "incorrect email or password" });
      return;
    }

    // 1 hour default
    const accessToken = makeJWT(user.id, 3600, apiConfig.jwtSecret);
    const refreshRecord = await createRefreshToken(user.id);

    // return without password
    const userResponse: UserResponse = user
    const { hashedPassword, ...response } = userResponse;

    res.status(200).json({
      response,
      token: accessToken,
      refreshToken: refreshRecord.token
    });
  } catch (error) {
    res.status(401).json({ error: "incorrect email or password" });
  }
};

const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.log(err);

  if (err instanceof BadRequestError) {
    res.status(400).json({ error: err.message });
    return;
  }
  if (err instanceof UnauthorizedError) {
    res.status(401).json({ error: err.message });
    return;
  }
  if (err instanceof ForbiddenError) {
    res.status(403).json({ error: err.message });
    return;
  }
  if (err instanceof NotFoundError) {
    res.status(404).json({ error: err.message });
    return;
  }

  // fallback for unknown errors
  res.status(500).json({
    error: "Something went wrong on our end"
  });
};

const handlerRefresh = async (req: Request, res: Response) => {
  try {
    const refreshTokenStr = getBearerToken(req);
    const userID = await getUserFromRefreshToken(refreshTokenStr);

    if (!userID) {
      res.status(401).json({ error: "invalid refresh token" });
      return;
    }

    const newAccessToken = makeJWT(userID, 3600, apiConfig.jwtSecret);

    res.status(200).json({ token: newAccessToken });
  } catch (error: any) {
    res.status(401).json({ error: "invalid refresh token" });
  }
};

const handlerRevoke = async (req: Request, res: Response) => {
  try {
    const refreshTokenStr = getBearerToken(req);
    await revokeRefreshToken(refreshTokenStr);
    res.status(204).end();
  } catch (error) {
    res.status(401).json({ error: "invalid refresh token" });
  }
};

const handlerUpdateUser = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const userID = validateJWT(token, apiConfig.jwtSecret);

    const { email, password } = req.body;

    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "email is required" });
      return;
    }

    if (!password || typeof password !== "string") {
      res.status(400).json({ error: "password is required" });
      return;
    }

    const hashedPassword = await hashPassword(password);

    // update only the authenticated user
    const updatedUser = await updateUsers(email, hashedPassword, userID)

    if (!updatedUser) {
      res.status(404).json({ error: "user not found" });
      return;
    }

    res.status(200).json({
      id: updatedUser.id,
      email: updatedUser.email,
      createdAt: updatedUser.createdAt,
      updatedAt: updatedUser.updatedAt
    });
  } catch (error: any) {
    if (error.message.includes("invalid") || error.message.includes("no authorization")) {
      res.status(401).json({ error: "invalid token" });
      return;
    }
    res.status(500).json({ error: "something went wrong" });
  }
};

const handlerDeleteChirp = async (req: Request, res: Response) => {
  try {
    const token = getBearerToken(req);
    const userID = validateJWT(token, apiConfig.jwtSecret);

    const chirpId = req.params.chirpId;

    if (!chirpId || typeof chirpId !== "string") {
      res.status(400).json({ error: "chirp id is required" });
      return;
    }

    // check if chirp exists and belongs to the user
    const chirp = await getChirpByUserId(chirpId);

    if (!chirp) {
      res.status(404).json({ error: "chirp not found" });
      return;
    }

    if (chirp.userId !== userID) {
      res.status(403).json({ error: "you can only delete your own chirps" });
      return;
    }

    // delete the chirp
    await deleteChirp(chirpId)
    res.status(204).end();
  } catch (error: any) {
    if (error.message?.includes("invalid") || error.message?.includes("authorization")) {
      res.status(401).json({ error: "invalid token" });
      return;
    }
    console.error(error);
    res.status(500).json({ error: "something went wrong" });
  }
};

// start the server and listen for incoming connections on the specified port
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

// MIDDLEWARES

// increment metrics for fileserver hits
app.use("/app", middlewareMetricsInc);
// serve static files from the current directory
app.use("/app", express.static("./src/app"));
// use the middleware handler to log non-ok responses
app.use(middlewareLogging);

// ENDPOINTS 

// add 1 to apiConfig.fileserverHits
app.get("/admin/metrics", handlerMetrics);
// resets to 0 apiConfig.fileserverHits
app.post("/admin/reset", handlerReset);
// check if the server is ready
app.get("/api/healthz", handlerReadiness);
// create users
app.post("/api/users", handlerCreateUser);
// update user
app.put("/api/users", handlerUpdateUser);
// login
app.post("/api/login", handlerLogin);
// create chirps
app.post("/api/chirps", handlerCreateChirp);
// get all chirps
app.get("/api/chirps", handlerGetChirps);
// get a single chirp
app.get("/api/chirps/:chirpId", handlerGetChirp);
// delete chirp
app.delete("/api/chirps/:chirpId", handlerDeleteChirp);

app.post("/api/refresh", handlerRefresh);
app.post("/api/revoke", handlerRevoke);


// error handling middleware must be last
app.use(errorHandler);
