import { Router } from "express";
import { connectToDatabase } from "../../lib/db.js";
import {
  register as registerSvc,
  login as loginSvc,
  refresh as refreshSvc,
  revokeRefreshToken,
  getProfile,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
} from "../../services/authService.js";
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  updateProfileSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "../../schemas/auth.js";
import { requireAuth } from "../../middleware/auth.js";

export const authRouter = Router();

authRouter.get("/health", async (_req, res) => {
  try {
    await connectToDatabase();
    return res.json({ status: "ok" });
  } catch (e: any) {
    return res.status(500).json({ status: "error", message: e?.message });
  }
});

authRouter.post("/register", async (req, res) => {
  const parse = registerSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }
  try {
    const result = await registerSvc(parse.data);
    return res.status(201).json(result);
  } catch (err: any) {
    return res
      .status(400)
      .json({ error: err?.message || "Registration failed" });
  }
});

authRouter.post("/login", async (req, res) => {
  const parse = loginSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }
  try {
    const result = await loginSvc(parse.data);
    return res.json(result);
  } catch (err: any) {
    return res.status(401).json({ error: err?.message || "Login failed" });
  }
});

authRouter.post("/refresh", async (req, res) => {
  const parse = refreshSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }
  try {
    const result = await refreshSvc(parse.data);
    return res.json(result);
  } catch (err: any) {
    return res.status(401).json({ error: err?.message || "Refresh failed" });
  }
});

authRouter.post("/logout", requireAuth, async (req: any, res) => {
  const token = (req.headers["authorization"] as string).slice(
    "Bearer ".length
  );
  // Decode to get tid; if fail, still return ok
  try {
    const decoded: any = require("jsonwebtoken").decode(token);
    if (decoded?.tid) {
      await revokeRefreshToken(req.user.id, decoded.tid);
    }
  } catch {}
  return res.json({ success: true });
});

authRouter.get("/me", requireAuth, async (req: any, res) => {
  try {
    const profile = await getProfile(req.user.id);
    return res.json(profile);
  } catch (err: any) {
    return res.status(404).json({ error: err?.message || "User not found" });
  }
});

authRouter.put("/me", requireAuth, async (req: any, res) => {
  const parse = updateProfileSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }
  try {
    const profile = await updateProfile(req.user.id, parse.data);
    return res.json(profile);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "Update failed" });
  }
});

authRouter.put("/password", requireAuth, async (req: any, res) => {
  const parse = changePasswordSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }
  try {
    await changePassword(req.user.id, parse.data);
    return res.json({ success: true });
  } catch (err: any) {
    return res
      .status(400)
      .json({ error: err?.message || "Password change failed" });
  }
});

authRouter.post("/forgot-password", async (req, res) => {
  const parse = forgotPasswordSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }
  try {
    const result = await forgotPassword(parse.data);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "Request failed" });
  }
});

authRouter.post("/reset-password", async (req, res) => {
  const parse = resetPasswordSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }
  try {
    await resetPassword(parse.data);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || "Reset failed" });
  }
});
