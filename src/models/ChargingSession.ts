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
  // Additional station details stored at session start
  stationAddress?: string;
  stationLocation?: {
    lat: number;
    lng: number;
  };
  stationPricePerKWh?: number; // Price at time of session (in Naira)
  stationPowerOutput?: number; // kW - station's power output capacity
  stationConnectorTypes?: string[]; // Available connector types at station
  stationAmenities?: string[]; // Amenities available at station
  stationOperatingHours?: string; // Operating hours
  stationIsCompanyStation?: boolean; // Whether it's an EvLiter company station
  stationRealtimeAvailability?: string; // Availability at session start
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
    // Additional station details stored at session start
    stationAddress: { type: String },
    stationLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    stationPricePerKWh: { type: Number }, // Price at time of session (in Naira)
    stationPowerOutput: { type: Number }, // kW - station's power output capacity
    stationConnectorTypes: { type: [String] }, // Available connector types
    stationAmenities: { type: [String] }, // Amenities available
    stationOperatingHours: { type: String }, // Operating hours
    stationIsCompanyStation: { type: Boolean }, // Whether it's an EvLiter company station
    stationRealtimeAvailability: { type: String }, // Availability at session start
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
