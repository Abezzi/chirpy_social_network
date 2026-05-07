import express from "express";
import { Request, Response, NextFunction } from "express";
import { apiConfig } from "./config.js";

const app = express();
const PORT = 8080;

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

const handlerReset = (_req: Request, res: Response) => {
  apiConfig.fileserverHits = 0;
  res.set("Content-Type", "text/plain");
  res.send(`Hits reset to 0`);
};

const handlerValidateChirp = (req: Request, res: Response) => {
  try {
    const { body } = req.body;
    const blackList = ["kerfuffle", "sharbert", "fornax"];

    if (!body || typeof body !== "string") {
      res.status(400).json({ error: "Chirp is required" });
      return;
    }

    if (body.length > 140) {
      throw new BadRequestError("Chirp is too long. Max length is 140");
    }

    // remove bad words
    let cleanedBody = body;
    blackList.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, "gi");
      cleanedBody = cleanedBody.replace(regex, "****");
    });

    res.status(200).json({ cleanedBody });
  } catch (error) {
    throw error;
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
// validate chirp length
app.post("/api/validate_chirp", handlerValidateChirp);

// error handling middleware must be last
app.use(errorHandler);
