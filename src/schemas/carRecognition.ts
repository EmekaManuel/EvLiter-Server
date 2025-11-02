import { z } from "zod";

export const carSpecSchema = z.object({
  make: z.string().min(1),
  model: z.string().min(1),
  year: z
    .union([z.string(), z.number()])
    .transform((v) => Number(v))
    .refine(
      (n) =>
        Number.isFinite(n) && n >= 1900 && n <= new Date().getFullYear() + 1,
      "Invalid year"
    ),
});

export const vinSchema = z
  .string()
  .trim()
  .toUpperCase()
  .refine((v) => /^[A-HJ-NPR-Z0-9]{11,17}$/.test(v), "Invalid VIN format");

export const carRecognitionResultSchema = z.object({
  vin: z.string().optional(),
  make: z.string(),
  model: z.string(),
  year: z.number(),
  trim: z.string().nullable().optional(),
  bodyStyle: z.string().nullable().optional(),
  drivetrain: z.string().nullable().optional(),
  engine: z.string().nullable().optional(),
  battery: z.string().nullable().optional(),
  imagePath: z.string().nullable().optional(),
  connectorTypes: z.array(z.string()).optional().default([]),
  charging: z
    .object({
      capacityKWh: z.number().positive().nullable().optional(),
      acMaxKw: z.number().positive().nullable().optional(),
      dcMaxKw: z.number().positive().nullable().optional(),
      onboardChargerKw: z.number().positive().nullable().optional(),
      chargePortLocation: z.string().nullable().optional(),
    })
    .optional(),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()).optional().default([]),
});

export type CarSpec = z.infer<typeof carSpecSchema>;
export type CarRecognitionResult = z.infer<typeof carRecognitionResultSchema>;
