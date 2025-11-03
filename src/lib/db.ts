import mongoose from "mongoose";

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
  await mongoose.connect(mongoUri, {
    dbName: process.env.MONGODB_DB || undefined,
  } as any);
  isConnected = true;
  return mongoose.connection;
}

export function getDbConnection() {
  if (!isConnected) {
    throw new Error("Database not connected. Call connectToDatabase() first.");
  }
  return mongoose.connection;
}


