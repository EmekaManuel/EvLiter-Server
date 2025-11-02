import { Router } from "express";
import { z } from "zod";
import {
  recognizeCarByVIN,
  recognizeCarBySpec,
} from "../../services/carRecognitionService.js";
import { carSpecSchema, vinSchema } from "../../schemas/carRecognition.js";

export const carRecognitionRouter = Router();

const vinBodySchema = z.object({ vin: vinSchema });
const modelBodySchema = carSpecSchema;

carRecognitionRouter.post("/vin", async (req, res) => {
  const parse = vinBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }

  try {
    const result = await recognizeCarByVIN(parse.data.vin);
    return res.json(result);
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    return res.status(500).json({ error: "Recognition failed", message });
  }
});

carRecognitionRouter.post("/model", async (req, res) => {
  const parse = modelBodySchema.safeParse(req.body);
  if (!parse.success) {
    return res
      .status(400)
      .json({ error: "Invalid request", details: parse.error.flatten() });
  }

  try {
    const result = await recognizeCarBySpec(parse.data);
    return res.json(result);
  } catch (err: any) {
    const message = err?.message || "Unknown error";
    return res.status(500).json({ error: "Recognition failed", message });
  }
});
