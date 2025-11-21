import mongoose from "mongoose";
import { colors, logger, symbols } from "./logger.js";

let isConnected = false;

export async function connectToDatabase(uri?: string) {
  const mongoUri = uri || process.env.MONGODB_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI not set");
  }

  if (isConnected) {
    return mongoose.connection;
  }

  mongoose.set("strictQuery", true);

  const connectionOptions = {
    dbName: process.env.MONGODB_DB || undefined,
    serverSelectionTimeoutMS: 30000, // 30 seconds - wait longer for server selection
    socketTimeoutMS: 45000, // 45 seconds - wait longer for socket operations
    connectTimeoutMS: 30000, // 30 seconds - wait longer for initial connection
    retryWrites: true,
    retryReads: true,
    maxPoolSize: 10, // Maintain up to 10 socket connections
    minPoolSize: 2, // Maintain at least 2 socket connections
    heartbeatFrequencyMS: 10000, // Check server status every 10 seconds
  };

  try {
    await mongoose.connect(mongoUri, connectionOptions);
  } catch (error) {
    logger.error(
      `${symbols.error} ${colors.red("MongoDB connection failed:")}`,
      error as any
    );
    throw error;
  }
  isConnected = true;

  // Log connection success
  const db = mongoose.connection;
  logger.db(
    `${symbols.success} ${colors.green("MongoDB connected successfully")}`
  );
  logger.db(
    `   ${colors.gray("Database:")} ${colors.cyan(
      db.db?.databaseName || process.env.MONGODB_DB || "default"
    )}`
  );
  logger.db(
    `   ${colors.gray("Host:")} ${colors.cyan((db as any).host || "unknown")}`
  );

  // Listen for connection events
  db.on("error", (err) => {
    logger.error(
      `${symbols.error} ${colors.red("MongoDB connection error:")}`,
      err
    );
  });

  db.on("disconnected", () => {
    logger.warn(`${symbols.warn} ${colors.yellow("MongoDB disconnected")}`);
    isConnected = false;
  });

  db.on("reconnected", () => {
    logger.success(`${symbols.success} ${colors.green("MongoDB reconnected")}`);
    isConnected = true;
  });

  return mongoose.connection;
}

export function getDbConnection() {
  if (!isConnected) {
    throw new Error("Database not connected. Call connectToDatabase() first.");
  }
  return mongoose.connection;
}
