import { Router } from "express";
import { z } from "zod";
import {
  carSpecSchema,
  vinSchema,
  getRecognitionsQuerySchema,
  searchRecognitionsQuerySchema,
} from "../../schemas/carRecognition.js";
import {
  recognizeCarBySpec,
  recognizeCarByVIN,
  getUserRecognitions,
  getRecognitionById,
  getRecognitionByVIN,
  searchRecognitions,
} from "../../services/carRecognitionService.js";

export const carRecognitionRouter = Router();

const vinBodySchema = z.object({ vin: vinSchema });
const modelBodySchema = carSpecSchema;

// VIN recognition - can be used with or without authentication
// If authenticated, the result will be saved with userId
carRecognitionRouter.post("/vin", async (req: any, res) => {
  const parse = vinBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }

  try {
    // Pass userId if authenticated (will be undefined if not)
    const userId = req.user?.id;
    const result = await recognizeCarByVIN(parse.data.vin, userId);
    return res.json(result);
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    return res.status(500).json({ error: "Recognition failed", message });
  }
});

// Model/Spec recognition - can be used with or without authentication
// If authenticated, the result will be saved with userId
carRecognitionRouter.post("/model", async (req: any, res) => {
  const parse = modelBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }

  try {
    // Pass userId if authenticated (will be undefined if not)
    const userId = req.user?.id;
    const result = await recognizeCarBySpec(parse.data, userId);
    return res.json(result);
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    return res.status(500).json({ error: "Recognition failed", message });
  }
});

/**
 * GET /api/ai/car-recognition
 * Get user's car recognition history (requires authentication)
 */
carRecognitionRouter.get("/", async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const parse = getRecognitionsQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: parse.error.flatten(),
      });
    }

    const recognitions = await getUserRecognitions(
      userId,
      parse.data.limit,
      parse.data.offset
    );

    return res.json({ recognitions, count: recognitions.length });
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    return res
      .status(500)
      .json({ error: "Failed to get recognitions", message });
  }
});

/**
 * GET /api/ai/car-recognition/:id
 * Get a specific car recognition by ID
 */
carRecognitionRouter.get("/:id", async (req: any, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id; // Optional - if provided, ensures ownership

    const recognition = await getRecognitionById(id, userId);

    if (!recognition) {
      return res.status(404).json({ error: "Recognition not found" });
    }

    return res.json(recognition);
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    return res
      .status(500)
      .json({ error: "Failed to get recognition", message });
  }
});

/**
 * GET /api/ai/car-recognition/vin/:vin
 * Get car recognition by VIN
 */
carRecognitionRouter.get("/vin/:vin", async (req: any, res) => {
  try {
    const { vin } = req.params;
    const userId = req.user?.id; // Optional - if provided, prioritizes user's recognition

    const recognition = await getRecognitionByVIN(vin, userId);

    if (!recognition) {
      return res
        .status(404)
        .json({ error: "Recognition not found for this VIN" });
    }

    return res.json(recognition);
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    return res
      .status(500)
      .json({ error: "Failed to get recognition", message });
  }
});

/**
 * GET /api/ai/car-recognition/search
 * Search car recognitions by make, model, and/or year
 */
carRecognitionRouter.get("/search", async (req: any, res) => {
  try {
    const parse = searchRecognitionsQuerySchema.safeParse(req.query);
    if (!parse.success) {
      return res.status(400).json({
        error: "Invalid query parameters",
        details: parse.error.flatten(),
      });
    }

    const filters: any = {};
    if (parse.data.make) filters.make = parse.data.make;
    if (parse.data.model) filters.model = parse.data.model;
    if (parse.data.year) filters.year = parse.data.year;

    // If authenticated, include userId in filters
    if (req.user?.id) {
      filters.userId = req.user.id;
    }

    const recognitions = await searchRecognitions(
      filters,
      parse.data.limit,
      parse.data.offset
    );

    return res.json({ recognitions, count: recognitions.length });
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    return res.status(500).json({ error: "Search failed", message });
  }
});
