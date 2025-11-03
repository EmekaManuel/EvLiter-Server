import express from "express";
import cors from "cors";
import { router as aiRouter } from "./routes/ai.js";
import { authRouter } from "./routes/auth/index.js";
import { connectToDatabase } from "./lib/db.js";
import { colors, logger, symbols } from "./lib/logger.js";

import dotenv from "dotenv";
dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  const start = performance.now();
  const method = req.method;
  const path = req.path;
  res.on("finish", () => {
    const ms = performance.now() - start;
    logger.http(method, path, res.statusCode, ms);
  });
  console.log(
    `${symbols.inbox} ${colors.gray("Incoming")}: ${colors.cyan(
      method
    )} ${colors.bold(path)}`
  );
  next();
});

const port = process.env.PORT ? Number(process.env.PORT) : 3000;

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/ai", aiRouter);
app.use("/api/auth", authRouter);

// Connect to MongoDB and start server
async function startServer() {
  try {
    logger.start("Connecting to MongoDB...");
    await connectToDatabase();

    app.listen(port, () => {
      logger.start(
        `Server listening on ${colors.bold(
          colors.magenta(`http://localhost:${port}`)
        )}`
      );
      console.log(`${symbols.api} ${colors.gray("API endpoints:")}`);
      console.log(`   - ${colors.cyan(`http://localhost:${port}/api/ai`)}`);
      console.log(`   - ${colors.cyan(`http://localhost:${port}/api/auth`)}`);
      console.log(`   - ${colors.cyan(`http://localhost:${port}/health`)}`);
    });
  } catch (error) {
    logger.error(
      `${symbols.error} ${colors.red("Failed to start server:")}`,
      error as any
    );
    process.exit(1);
  }
}

startServer();
