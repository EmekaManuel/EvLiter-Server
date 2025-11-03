import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ChargingSessionDocument extends Document {
  userId: string;
  stationId: string;
  stationName: string;
  connectorId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // minutes
  energyDelivered: number; // kWh
  totalCost: number; // in Naira
  averagePower: number; // kW
  batteryLevel: number; // percentage (0-100)
  batteryLevelStart: number; // percentage at start
  status: "active" | "completed" | "cancelled";
  stationRating?: number; // 1-5, optional
  createdAt: Date;
  updatedAt: Date;
}

const ChargingSessionSchema = new Schema<ChargingSessionDocument>(
  {
    userId: { type: String, required: true, index: true },
    stationId: { type: String, required: true },
    stationName: { type: String, required: true },
    connectorId: { type: String, required: true },
    startTime: { type: Date, required: true, default: Date.now },
    endTime: { type: Date },
    duration: { type: Number, default: 0 }, // minutes
    energyDelivered: { type: Number, default: 0 }, // kWh
    totalCost: { type: Number, default: 0 }, // Naira
    averagePower: { type: Number, default: 0 }, // kW
    batteryLevel: { type: Number, required: true, min: 0, max: 100 },
    batteryLevelStart: { type: Number, required: true, min: 0, max: 100 },
    status: {
      type: String,
      enum: ["active", "completed", "cancelled"],
      default: "active",
      index: true,
    },
    stationRating: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true }
);

// Compound index for efficient queries
ChargingSessionSchema.index({ userId: 1, status: 1 });
ChargingSessionSchema.index({ userId: 1, startTime: -1 });

export const ChargingSession: Model<ChargingSessionDocument> =
  mongoose.models.ChargingSession ||
  mongoose.model<ChargingSessionDocument>(
    "ChargingSession",
    ChargingSessionSchema
  );
