import express from "express";
import { Request, Response } from "express";

const app = express();
const PORT = 8080;

const handlerReadiness = (req: Request, res: Response) => {
  res.set("Content-Type", "text/plain");
  res.send("OK");
}

// serve static files from the current directory
app.use("/app", express.static("./src/app"));

// end-point to check if the server is ready
app.get("/healthz", handlerReadiness);

// start the server and listen for incoming connections on the specified port
app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
