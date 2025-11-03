import { z } from "zod";

// Connector types commonly used in Nigeria
export const connectorTypeSchema = z.enum([
  "Type2",
  "CCS",
  "CHAdeMO",
  "Type1",
  "GB/T",
  "All Types",
]);

export const chargingStationSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string(),
  location: z.object({
    lat: z.number(),
    lng: z.number(),
  }),
  connectorTypes: z.array(z.string()),
  powerOutput: z.number(), // in kW
  realtimeAvailability: z.enum(["Available", "Occupied", "Out of Service"]),
  isCompanyStation: z.boolean(),
  distance: z.number().optional(), // in km, calculated based on search location
  amenities: z.array(z.string()).optional(),
  operatingHours: z.string().optional(),
  pricePerKWh: z.number().optional(), // in Naira
});

export const searchChargingStationsRequestSchema = z.object({
  location: z.string().min(1),
  connectorType: connectorTypeSchema.optional().default("All Types"),
  minPower: z.number().min(0).optional(),
  maxDistance: z.number().min(0).optional(), // in km
  coordinates: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(), // Optional coordinates for more accurate distance calculation
});

export const searchChargingStationsResponseSchema = z.object({
  stations: z.array(chargingStationSchema),
  totalCount: z.number(),
  companyStationsCount: z.number(),
  aiSuggestedCount: z.number(),
});

export type ConnectorType = z.infer<typeof connectorTypeSchema>;
export type ChargingStation = z.infer<typeof chargingStationSchema>;
export type SearchChargingStationsRequest = z.infer<
  typeof searchChargingStationsRequestSchema
>;
export type SearchChargingStationsResponse = z.infer<
  typeof searchChargingStationsResponseSchema
>;
