import express from "express";
import { Request, Response, NextFunction } from "express";

const app = express();
const PORT = 8080;

const handlerReadiness = (req: Request, res: Response) => {
  res.set("Content-Type", "text/plain");
  res.send("OK");
}

const middlewareLogging = (req: Request, res: Response, next: NextFunction) => {
  res.on("finish", () => {
    if (res.statusCode !== 200) {
      console.log(`[NON-OK] ${req.method} ${req.url} - Status: ${res.statusCode}`)
    }
  });
  next();
}
// start the server and listen for incoming connections on the specified port
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});

// serve static files from the current directory
app.use("/app", express.static("./src/app"));

// endpoint to check if the server is ready
app.get("/healthz", handlerReadiness);

// middleware to log non-ok responses
app.use(middlewareLogging);
