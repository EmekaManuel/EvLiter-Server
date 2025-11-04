import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface CarRecognitionDocument extends Document {
  userId?: string; // Optional - if user is authenticated
  vin?: string;
  make: string;
  carModel: string; // Renamed from 'model' to avoid conflict with mongoose Document.model
  year: number;
  trim?: string;
  bodyStyle?: string;
  drivetrain?: string;
  engine?: string;
  battery?: string;
  imagePath?: string;
  connectorTypes: string[];
  charging?: {
    capacityKWh?: number;
    acMaxKw?: number;
    dcMaxKw?: number;
    onboardChargerKw?: number;
    chargePortLocation?: string;
  };
  confidence: number;
  sources: string[];
  recognitionMethod: "vin" | "spec"; // How the car was recognized
  createdAt: Date;
  updatedAt: Date;
}

const ChargingInfoSchema = new Schema(
  {
    capacityKWh: { type: Number },
    acMaxKw: { type: Number },
    dcMaxKw: { type: Number },
    onboardChargerKw: { type: Number },
    chargePortLocation: { type: String },
  },
  { _id: false }
);

const CarRecognitionSchema = new Schema<CarRecognitionDocument>(
  {
    userId: { type: String, index: true }, // Index for user-specific queries
    vin: { type: String, index: true }, // Index for VIN lookups
    make: { type: String, required: true, index: true },
    carModel: { type: String, required: true, index: true }, // Renamed from 'model'
    year: { type: Number, required: true, index: true },
    trim: { type: String },
    bodyStyle: { type: String },
    drivetrain: { type: String },
    engine: { type: String },
    battery: { type: String },
    imagePath: { type: String },
    connectorTypes: { type: [String], default: [] },
    charging: { type: ChargingInfoSchema },
    confidence: { type: Number, required: true, min: 0, max: 1 },
    sources: { type: [String], default: [] },
    recognitionMethod: {
      type: String,
      enum: ["vin", "spec"],
      required: true,
    },
  },
  { timestamps: true }
);

// Compound indexes for efficient queries
CarRecognitionSchema.index({ userId: 1, createdAt: -1 });
CarRecognitionSchema.index({ make: 1, carModel: 1, year: 1 });
CarRecognitionSchema.index({ vin: 1 });

export const CarRecognition: Model<CarRecognitionDocument> =
  mongoose.models.CarRecognition ||
  mongoose.model<CarRecognitionDocument>(
    "CarRecognition",
    CarRecognitionSchema
  );
