import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { nanoid } from "nanoid";
import { connectToDatabase } from "../lib/db.js";
import { User } from "../models/User.js";
import type {
  RegisterRequest,
  LoginRequest,
  RefreshRequest,
  UpdateProfileRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from "../schemas/auth.js";

const ACCESS_TOKEN_TTL = parseInt(process.env.JWT_ACCESS_TTL_SECS || "900", 10); // 15m
const REFRESH_TOKEN_TTL = parseInt(
  process.env.JWT_REFRESH_TTL_SECS || "1209600",
  10
); // 14d
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

function signAccessToken(payload: Record<string, any>) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_TTL });
}

export async function register(data: RegisterRequest) {
  await connectToDatabase();
  const existing = await User.findOne({ email: data.email });
  if (existing) {
    throw new Error("Email already registered");
  }

  const passwordHash = await bcrypt.hash(data.password, 12);
  const user = await User.create({
    email: data.email,
    passwordHash,
    name: data.name,
  });

  const tokenId = nanoid();
  const refreshToken = jwt.sign({ sub: user.id, tid: tokenId }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
  user.refreshTokens.push({ tokenId, expiresAt, createdAt: new Date() });
  await user.save();

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL,
  };
}

export async function login(data: LoginRequest) {
  await connectToDatabase();
  const user = await User.findOne({ email: data.email });
  if (!user) {
    throw new Error("Invalid email or password");
  }
  const ok = await bcrypt.compare(data.password, user.passwordHash);
  if (!ok) {
    throw new Error("Invalid email or password");
  }

  const tokenId = nanoid();
  const refreshToken = jwt.sign({ sub: user.id, tid: tokenId }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
  });
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL * 1000);
  user.refreshTokens.push({ tokenId, expiresAt, createdAt: new Date() });
  await user.save();

  const accessToken = signAccessToken({ sub: user.id, role: user.role });
  return {
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
    accessToken,
    refreshToken,
    expiresIn: ACCESS_TOKEN_TTL,
  };
}

export async function refresh(data: RefreshRequest) {
  await connectToDatabase();
  try {
    const decoded = jwt.verify(data.refreshToken, JWT_SECRET) as any;
    const user = await User.findById(decoded.sub);
    if (!user) throw new Error("User not found");

    const tokenRecord = user.refreshTokens.find(
      (t) => t.tokenId === decoded.tid
    );
    if (!tokenRecord || tokenRecord.expiresAt.getTime() < Date.now()) {
      throw new Error("Refresh token expired or invalid");
    }

    const accessToken = signAccessToken({ sub: user.id, role: user.role });
    return { accessToken, expiresIn: ACCESS_TOKEN_TTL };
  } catch {
    throw new Error("Invalid refresh token");
  }
}

export async function revokeRefreshToken(userId: string, tokenId: string) {
  await connectToDatabase();
  await User.updateOne(
    { _id: userId },
    { $pull: { refreshTokens: { tokenId } } }
  );
}

export async function getProfile(userId: string) {
  await connectToDatabase();
  const user = await User.findById(userId).lean();
  if (!user) throw new Error("User not found");
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

export async function updateProfile(
  userId: string,
  data: UpdateProfileRequest
) {
  await connectToDatabase();
  const user = await User.findByIdAndUpdate(
    userId,
    { $set: { name: data.name, avatarUrl: data.avatarUrl } },
    { new: true }
  );
  if (!user) throw new Error("User not found");
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

export async function changePassword(
  userId: string,
  data: ChangePasswordRequest
) {
  await connectToDatabase();
  const user = await User.findById(userId);
  if (!user) throw new Error("User not found");
  const ok = await bcrypt.compare(data.currentPassword, user.passwordHash);
  if (!ok) throw new Error("Current password incorrect");
  user.passwordHash = await bcrypt.hash(data.newPassword, 12);
  await user.save();
  return { success: true };
}

export async function forgotPassword(data: ForgotPasswordRequest) {
  await connectToDatabase();
  const user = await User.findOne({ email: data.email });
  if (!user) return { success: true }; // don't leak
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 1000 * 60 * 30); // 30m
  user.resetPassword = { token, expiresAt } as any;
  await user.save();
  // In production, send email with token link
  return { success: true, token }; // token returned for development/testing
}

export async function resetPassword(data: ResetPasswordRequest) {
  await connectToDatabase();
  const user = await User.findOne({ "resetPassword.token": data.token });
  if (!user || !user.resetPassword) throw new Error("Invalid reset token");
  if (user.resetPassword.expiresAt.getTime() < Date.now()) {
    throw new Error("Reset token expired");
  }
  user.passwordHash = await bcrypt.hash(data.newPassword, 12);
  user.resetPassword = undefined;
  await user.save();
  return { success: true };
}
