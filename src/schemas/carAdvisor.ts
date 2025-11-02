import { z } from "zod";

// Charging Time Calculator Schema
export const chargingTimeRequestSchema = z.object({
  batteryCapacityKWh: z.number().positive(),
  currentChargePercent: z.number().min(0).max(100),
  targetChargePercent: z.number().min(0).max(100),
  chargerPowerKw: z.number().positive(),
  chargerType: z.enum(["AC", "DC"]).optional().default("AC"),
  efficiency: z.number().min(0.5).max(1).optional().default(0.9), // charging efficiency
});

export const chargingTimeResultSchema = z.object({
  estimatedTimeMinutes: z.number(),
  estimatedTimeHours: z.number(),
  energyNeededKWh: z.number(),
  chargerType: z.string(),
  chargerPowerKw: z.number(),
  explanation: z.string(),
});

// Cost Estimate Schema
export const costEstimateRequestSchema = z.object({
  energyKWh: z.number().positive(),
  location: z.string().min(1),
  chargerType: z
    .enum(["home", "public_ac", "public_dc"])
    .optional()
    .default("home"),
  timeOfDay: z
    .enum(["peak", "off_peak", "standard"])
    .optional()
    .default("standard"),
});

export const costEstimateResultSchema = z.object({
  estimatedCostNaira: z.number(),
  pricePerKWhNaira: z.number(),
  location: z.string(),
  chargerType: z.string(),
  timeOfDay: z.string(),
  breakdown: z.object({
    energyCost: z.number(),
    serviceFee: z.number().optional(),
    tax: z.number().optional(),
  }),
  explanation: z.string(),
});

// Recommendations Schema
export const recommendationRequestSchema = z.object({
  car: z.object({
    make: z.string().min(1),
    model: z.string().min(1),
    year: z.number(),
    batteryCapacityKWh: z.number().positive().optional(),
    rangeKm: z.number().positive().optional(),
  }),
  location: z.object({
    city: z.string().min(1),
    state: z.string().min(1).optional(),
    coordinates: z
      .object({
        lat: z.number(),
        lng: z.number(),
      })
      .optional(),
  }),
  preferences: z
    .object({
      dailyDrivingKm: z.number().min(0).optional(),
      chargingFrequency: z.enum(["daily", "weekly", "as_needed"]).optional(),
      budget: z
        .object({
          min: z.number().min(0).optional(),
          max: z.number().min(0).optional(),
        })
        .optional(),
      prioritizeSpeed: z.boolean().optional().default(false),
      homeCharging: z.boolean().optional(),
    })
    .optional()
    .default({
      prioritizeSpeed: false,
      dailyDrivingKm: undefined,
      chargingFrequency: undefined,
      budget: undefined,
      homeCharging: undefined,
    }),
});

export const chargingStationRecommendationSchema = z.object({
  name: z.string(),
  address: z.string(),
  distance: z.number(), // in km
  chargerTypes: z.array(z.string()),
  maxPowerKw: z.number(),
  availability: z.string().optional(),
  estimatedCostRange: z.string().optional(),
  amenities: z.array(z.string()).optional(),
  confidence: z.number().min(0).max(1),
});

export const recommendationResultSchema = z.object({
  chargingStations: z.array(chargingStationRecommendationSchema),
  chargingStrategy: z.object({
    recommendedFrequency: z.string(),
    optimalChargeRange: z.string(),
    estimatedMonthlyCost: z.string(),
    tips: z.array(z.string()),
  }),
  carInsights: z.object({
    efficiency: z.string().optional(),
    rangeAnxietyLevel: z.string(),
    suitabilityScore: z.number().min(0).max(10),
    considerations: z.array(z.string()),
  }),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()).optional().default([]),
});

export type ChargingTimeRequest = z.infer<typeof chargingTimeRequestSchema>;
export type ChargingTimeResult = z.infer<typeof chargingTimeResultSchema>;
export type CostEstimateRequest = z.infer<typeof costEstimateRequestSchema>;
export type CostEstimateResult = z.infer<typeof costEstimateResultSchema>;
export type RecommendationRequest = z.infer<typeof recommendationRequestSchema>;
export type RecommendationResult = z.infer<typeof recommendationResultSchema>;
