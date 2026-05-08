import express from "express";
import { Request, Response, NextFunction } from "express";
import { apiConfig, dbConfig } from "./config.js";
import type { MigrationConfig } from "drizzle-orm/migrator";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { createUser, deleteAllUsers } from "./db/queries/users.js";
import { createChirp, getAllChirps, getChirpById } from "./db/queries/chirps.js";

export type APIConfig = {
  fileserverHits: number;
  platform: string;
};

export type DBConfig = {
  url: string;
  migrationConfig: MigrationConfig
};

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
    const { body, userId } = req.body;

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

    if (!userId || typeof userId !== "string") {
      res.status(400).json({ error: "userId is required" });
      return;
    }

    const chirp = await createChirp({
      body: cleanedBody,
      userId,
    });

    res.status(201).json(chirp);
  } catch (error) {
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
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      res.status(400).json({ error: "email is required" });
      return;
    }

    const user = await createUser({ email });

    if (!user) {
      res.status(400).json({ error: "user already exists" });
      return;
    }

    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: "something went wrong" });
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
// create chirps
app.post("/api/chirps", handlerCreateChirp);
// get all chirps
app.get("/api/chirps", handlerGetChirps);
// get a single chirp
app.get("/api/chirps/:chirpId", handlerGetChirp);


// error handling middleware must be last
app.use(errorHandler);
