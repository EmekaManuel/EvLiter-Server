import { Router } from "express";
import {
  calculateChargingTime,
  calculateCostEstimate,
  getRecommendations,
} from "../../services/carAdvisorService.js";
import {
  chargingTimeRequestSchema,
  costEstimateRequestSchema,
  recommendationRequestSchema,
} from "../../schemas/carAdvisor.js";

export const carAdvisorRouter = Router();

/**
 * POST /advisor/charging-time
 * Calculate estimated charging time
 */
carAdvisorRouter.post("/charging-time", async (req, res) => {
  const parse = chargingTimeRequestSchema.safeParse(req.body);

  if (!parse.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parse.error.flatten(),
    });
  }

  try {
    const result = await calculateChargingTime(parse.data);
    return res.json(result);
  } catch (err: any) {
    const message = err?.message || "Charging time calculation failed";
    return res.status(500).json({ error: "Calculation failed", message });
  }
});

/**
 * POST /advisor/cost-estimate
 * Calculate charging cost in Naira
 */
carAdvisorRouter.post("/cost-estimate", async (req, res) => {
  const parse = costEstimateRequestSchema.safeParse(req.body);

  if (!parse.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parse.error.flatten(),
    });
  }

  try {
    const result = await calculateCostEstimate(parse.data);
    return res.json(result);
  } catch (err: any) {
    const message = err?.message || "Cost estimation failed";
    return res.status(500).json({ error: "Estimation failed", message });
  }
});

/**
 * POST /advisor/recommendations
 * Get AI-powered charging recommendations
 */
carAdvisorRouter.post("/recommendations", async (req, res) => {
  const parse = recommendationRequestSchema.safeParse(req.body);

  if (!parse.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parse.error.flatten(),
    });
  }

  try {
    const result = await getRecommendations(parse.data);
    return res.json(result);
  } catch (err: any) {
    const message = err?.message || "Recommendation generation failed";
    return res.status(500).json({ error: "Recommendation failed", message });
  }
});

/**
 * GET /advisor/pricing
 * Get current electricity pricing information
 */
carAdvisorRouter.get("/pricing", async (req, res) => {
  const { location, charger_type } = req.query;

  const pricingInfo = {
    currency: "NGN",
    lastUpdated: new Date().toISOString(),
    rates: {
      home: {
        peak: 85,
        off_peak: 50,
        standard: 68,
      },
      public_ac: {
        peak: 120,
        off_peak: 100,
        standard: 110,
      },
      public_dc: {
        peak: 180,
        off_peak: 150,
        standard: 165,
      },
    },
    notes: [
      "Rates are approximate and may vary by location and provider",
      "Public charging includes 10% service fee and 7.5% VAT",
      "Off-peak hours: typically 10 PM - 6 AM",
      "Peak hours: typically 6 PM - 10 PM",
    ],
  };

  if (charger_type && typeof charger_type === "string") {
    const rates =
      pricingInfo.rates[charger_type as keyof typeof pricingInfo.rates];
    if (rates) {
      return res.json({
        currency: pricingInfo.currency,
        chargerType: charger_type,
        rates,
        notes: pricingInfo.notes,
      });
    }
  }

  return res.json(pricingInfo);
});
