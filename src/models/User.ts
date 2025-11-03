import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface UserDocument extends Document {
  email: string;
  passwordHash: string;
  name?: string;
  avatarUrl?: string;
  role: "user" | "admin";
  refreshTokens: {
    tokenId: string;
    expiresAt: Date;
    createdAt: Date;
    deviceInfo?: string;
  }[];
  resetPassword?: {
    token: string;
    expiresAt: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const RefreshTokenSchema = new Schema(
  {
    tokenId: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now },
    deviceInfo: { type: String },
  },
  { _id: false }
);

const UserSchema = new Schema<UserDocument>(
  {
    email: { type: String, required: true, lowercase: true, unique: true, index: true },
    passwordHash: { type: String, required: true },
    name: { type: String },
    avatarUrl: { type: String },
    role: { type: String, enum: ["user", "admin"], default: "user" },
    refreshTokens: { type: [RefreshTokenSchema], default: [] },
    resetPassword: {
      token: String,
      expiresAt: Date,
    },
  },
  { timestamps: true }
);

export const User: Model<UserDocument> =
  mongoose.models.User || mongoose.model<UserDocument>("User", UserSchema);


