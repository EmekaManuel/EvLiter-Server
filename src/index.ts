import express from "express";
import cors from "cors";
import { router as aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth/index.js";

import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/ai", aiRouter);
app.use("/api/auth", authRouter);

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
