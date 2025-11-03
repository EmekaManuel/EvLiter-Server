import { Router } from "express";
import { requireAuth } from "../../middleware/auth.js";
import {
  startChargingSession,
  endChargingSession,
  updateActiveSession,
  getUserSessions,
  getActiveSession,
  getUserStats,
} from "../../services/chargingSessionService.js";
import {
  startChargingSessionRequestSchema,
  endChargingSessionRequestSchema,
  updateActiveSessionRequestSchema,
  getSessionsRequestSchema,
} from "../../schemas/chargingSession.js";

export const chargingRouter = Router();

// All routes require authentication
chargingRouter.use(requireAuth);

/**
 * GET /api/charging/sessions
 * Get user's charging sessions with optional filters
 */
chargingRouter.get("/sessions", async (req: any, res) => {
  try {
    const parse = getSessionsRequestSchema.safeParse(req.query);
    if (!parse.success) {
      return res
        .status(400)
        .json({ error: "Invalid request", details: parse.error.flatten() });
    }

    const sessions = await getUserSessions(req.user.id, parse.data);
    return res.json({ sessions });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to get sessions" });
  }
});

/**
 * GET /api/charging/sessions/active
 * Get user's active charging session
 */
chargingRouter.get("/sessions/active", async (req: any, res) => {
  try {
    const session = await getActiveSession(req.user.id);
    if (!session) {
      return res.json({ session: null });
    }
    return res.json({ session });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to get active session" });
  }
});

/**
 * GET /api/charging/stats
 * Get user's charging statistics
 */
chargingRouter.get("/stats", async (req: any, res) => {
  try {
    const stats = await getUserStats(req.user.id);
    return res.json(stats);
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to get stats" });
  }
});

/**
 * POST /api/charging/sessions/start
 * Start a new charging session
 */
chargingRouter.post("/sessions/start", async (req: any, res) => {
  const parse = startChargingSessionRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }

  try {
    const result = await startChargingSession(req.user.id, parse.data);
    return res.status(201).json(result);
  } catch (err: any) {
    return res
      .status(400)
      .json({ error: err?.message || "Failed to start charging session" });
  }
});

/**
 * POST /api/charging/sessions/end
 * End/stop a charging session
 */
chargingRouter.post("/sessions/end", async (req: any, res) => {
  const parse = endChargingSessionRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }

  try {
    const result = await endChargingSession(req.user.id, parse.data);
    return res.json(result);
  } catch (err: any) {
    return res
      .status(400)
      .json({ error: err?.message || "Failed to end charging session" });
  }
});

/**
 * PUT /api/charging/sessions/active/update
 * Update active session (for real-time battery level, energy delivered, etc.)
 */
chargingRouter.put("/sessions/active/update", async (req: any, res) => {
  const parse = updateActiveSessionRequestSchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }

  try {
    const result = await updateActiveSession(req.user.id, parse.data);
    return res.json(result);
  } catch (err: any) {
    return res
      .status(400)
      .json({ error: err?.message || "Failed to update session" });
  }
});

/**
 * GET /api/charging/dashboard
 * Get all dashboard data (sessions, stats, active session) in one call
 */
chargingRouter.get("/dashboard", async (req: any, res) => {
  try {
    const [sessions, stats, activeSession] = await Promise.all([
      getUserSessions(req.user.id, { filter: "all-time", limit: 50 }),
      getUserStats(req.user.id),
      getActiveSession(req.user.id),
    ]);

    return res.json({
      sessions,
      stats,
      activeSession,
    });
  } catch (err: any) {
    return res
      .status(500)
      .json({ error: err?.message || "Failed to get dashboard data" });
  }
});
