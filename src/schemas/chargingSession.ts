import { z } from "zod";
import { chargingStationSchema } from "./chargingStations.js";

// Charging session status
export const chargingSessionStatusSchema = z.enum([
  "active",
  "completed",
  "cancelled",
]);

// Charging session schema
export const chargingSessionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  stationId: z.string(),
  stationName: z.string(),
  connectorId: z.string(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime().optional(),
  duration: z.number(), // minutes
  energyDelivered: z.number(), // kWh
  totalCost: z.number(), // Naira
  averagePower: z.number(), // kW
  batteryLevel: z.number().min(0).max(100), // percentage
  batteryLevelStart: z.number().min(0).max(100).optional(),
  status: chargingSessionStatusSchema,
  stationRating: z.number().min(1).max(5).optional(),
  // Additional station details stored at session start
  stationAddress: z.string().optional(),
  stationLocation: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  stationPricePerKWh: z.number().optional(), // Price at time of session
  stationPowerOutput: z.number().optional(), // kW - station's power output capacity
  stationConnectorTypes: z.array(z.string()).optional(), // Available connector types
  stationAmenities: z.array(z.string()).optional(), // Amenities available
  stationOperatingHours: z.string().optional(), // Operating hours
  stationIsCompanyStation: z.boolean().optional(), // Whether it's an EvLiter company station
  stationRealtimeAvailability: z.string().optional(), // Availability at session start
});

export type ChargingSession = z.infer<typeof chargingSessionSchema>;

// User stats schema
export const monthlyUsageSchema = z.object({
  month: z.string(), // "YYYY-MM"
  sessions: z.number(),
  energyUsed: z.number(), // kWh
  totalSpent: z.number(), // Naira
});

export const userStatsSchema = z.object({
  totalSessions: z.number(),
  totalEnergyUsed: z.number(), // kWh
  totalSpent: z.number(), // Naira
  averageSessionDuration: z.number(), // minutes
  favoriteStation: z.string().optional(),
  monthlyUsage: z.array(monthlyUsageSchema),
});

export type UserStats = z.infer<typeof userStatsSchema>;
export type MonthlyUsage = z.infer<typeof monthlyUsageSchema>;

// Request schemas
export const startChargingSessionRequestSchema = z.object({
  stationId: z.string(),
  connectorId: z.string(), // Connector identifier (e.g., "station-002-c1")
  connectorType: z.string().optional(), // Connector type (e.g., "CCS", "CHAdeMO") - used for validation
  batteryLevelStart: z.number().min(0).max(100),
  // Station object with full details - required to ensure proper data capture
  station: chargingStationSchema,
});

export type StartChargingSessionRequest = z.infer<
  typeof startChargingSessionRequestSchema
>;

export const endChargingSessionRequestSchema = z.object({
  sessionId: z.string(),
  batteryLevelEnd: z.number().min(0).max(100).optional(),
  stationRating: z.number().min(1).max(5).optional(),
});

export type EndChargingSessionRequest = z.infer<
  typeof endChargingSessionRequestSchema
>;

export const getSessionsRequestSchema = z.object({
  filter: z.enum(["recent", "this-month", "all-time"]).optional(),
  // Coerce query string values to numbers
  limit: z.coerce.number().int().positive().max(100).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

export type GetSessionsRequest = z.infer<typeof getSessionsRequestSchema>;

// Update active session schema (for real-time updates)
export const updateActiveSessionRequestSchema = z.object({
  batteryLevel: z.number().min(0).max(100),
  energyDelivered: z.number().nonnegative().optional(),
});

export type UpdateActiveSessionRequest = z.infer<
  typeof updateActiveSessionRequestSchema
>;
