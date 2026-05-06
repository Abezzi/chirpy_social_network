import express from "express";
import { Request, Response, NextFunction } from "express";
import { apiConfig } from "./config.js";

const app = express();
const PORT = 8080;

const handlerReadiness = (req: Request, res: Response) => {
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

const middlewareMetricsInc = (req: Request, res: Response, next: NextFunction) => {
  apiConfig.fileserverHits += 1;
  next();
}

const handlerMetrics = (req: Request, res: Response) => {
  res.set("Content-Type", "text/plain");
  res.send(`Hits: ${apiConfig.fileserverHits}`);
};

const handlerReset = (req: Request, res: Response) => {
  apiConfig.fileserverHits = 0;
  res.set("Content-Type", "text/plain");
  res.send(`Hits reset to 0`);
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

// check if the server is ready
app.get("/api/healthz", handlerReadiness);
// add 1 to apiConfig.fileserverHits
app.get("/api/metrics", handlerMetrics);
// resets to 0 apiConfig.fileserverHits
app.get("/api/reset", handlerReset);


