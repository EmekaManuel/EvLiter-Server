import { createOpenAIClient } from "../lib/openaiClient.js";
import { z } from "zod";
import fs from "fs";
import path from "path";
import { connectToDatabase } from "../lib/db.js";
import { CarRecognition } from "../models/CarRecognition.js";
import {
  carRecognitionResultSchema,
  vinSchema,
  carSpecSchema,
  type CarSpec,
  type CarRecognitionResult,
} from "../schemas/carRecognition.js";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

function buildSystemPrompt() {
  return "You are an automotive data assistant. Given a VIN or make/model/year, infer detailed vehicle info. Reply ONLY with JSON matching the provided JSON schema. If uncertain, set confidence lower and leave optional fields empty.";
}

function buildJsonSchemaInstruction() {
  return `Return JSON with ALL of these fields present. If unknown, use null (or [] for arrays): {
    "vin?": string,
    "make": string,
    "model": string,
    "year": number,
    "trim": string | null,
    "bodyStyle": string | null,
    "drivetrain": string | null,
    "engine": string | null,
    "battery": string | null,
    "connectorTypes": string[],
    "charging": {
      "capacityKWh": number | null,
      "acMaxKw": number | null,
      "dcMaxKw": number | null,
      "onboardChargerKw": number | null,
      "chargePortLocation": string | null
    },
    "confidence": number (0..1),
    "sources": string[]
  }`;
}

function normalizeResult(data: any) {
  return {
    vin: data.vin ?? undefined,
    make: data.make,
    model: data.model,
    year: data.year,
    trim: data.trim ?? null,
    bodyStyle: data.bodyStyle ?? null,
    drivetrain: data.drivetrain ?? null,
    engine: data.engine ?? null,
    battery: data.battery ?? null,
    connectorTypes: Array.isArray(data.connectorTypes)
      ? data.connectorTypes
      : [],
    charging: data.charging
      ? {
          capacityKWh: data.charging.capacityKWh ?? null,
          acMaxKw: data.charging.acMaxKw ?? null,
          dcMaxKw: data.charging.dcMaxKw ?? null,
          onboardChargerKw: data.charging.onboardChargerKw ?? null,
          chargePortLocation: data.charging.chargePortLocation ?? null,
        }
      : undefined,
    confidence: data.confidence,
    sources: Array.isArray(data.sources) ? data.sources : [],
  };
}

async function parseJsonResponse(text: string): Promise<CarRecognitionResult> {
  // Extract the first JSON block if any extra text slipped in
  const match = text.match(/\{[\s\S]*\}/);
  const jsonText = match ? match[0] : text;
  const data = JSON.parse(jsonText);
  const parsed = carRecognitionResultSchema.parse(normalizeResult(data));
  return parsed;
}

/**
 * Generate a representative image of the car using the OpenAI Images API.
 * @param car - The car details (make, model, year)
 * @param outputDir - Optional directory to save the image (defaults to current directory)
 * @returns {Promise<string>} - Path to the saved image file
 */
export async function generateCarImage(
  car: Pick<CarSpec, "make" | "model" | "year">,
  outputDir?: string
): Promise<string> {
  const client = createOpenAIClient();

  const prompt = `A high-resolution photograph of a ${car.year} ${car.make} ${car.model}, studio lighting, realistic, professional car photo.`;

  try {
    // Try with gpt-image-1 (doesn't support response_format parameter)
    const result = await client.images.generate({
      model: "dall-e-3",
      prompt,
      response_format: "b64_json",
      size: "1024x1024",
    });

    // Extract base64 image data
    if (!result.data || !result.data[0]) {
      throw new Error("Failed to generate image: no data returned");
    }

    // gpt-image-1 always returns b64_json
    const image_base64 = result.data[0].b64_json;
    if (!image_base64) {
      throw new Error("Failed to generate image: no base64 data returned");
    }

    // Convert base64 to Buffer
    const image_bytes = Buffer.from(image_base64, "base64");

    // Generate filename from car details
    const sanitizedMake = car.make.replace(/[^a-zA-Z0-9]/g, "_");
    const sanitizedModel = car.model.replace(/[^a-zA-Z0-9]/g, "_");
    const filename = `${sanitizedMake}_${sanitizedModel}_${car.year}.png`;
    const filepath = outputDir ? path.join(outputDir, filename) : filename;

    // Save the image to a file
    fs.writeFileSync(filepath, image_bytes);

    return filepath;
  } catch (error: any) {
    // Enhanced error logging
    const errorMessage = error?.message || "Unknown error";
    const errorStatus = error?.status || error?.response?.status;
    const errorBody = error?.response?.data || error?.body;

    console.error("Image generation error:", {
      message: errorMessage,
      status: errorStatus,
      body: errorBody,
      car: `${car.year} ${car.make} ${car.model}`,
    });

    throw new Error(`Image generation failed: ${errorMessage}`);
  }
}

export async function recognizeCarByVIN(
  vinInput: string,
  userId?: string
): Promise<CarRecognitionResult> {
  const vin = vinSchema.parse(vinInput);
  const client = createOpenAIClient();
  const messages = [
    { role: "system" as const, content: buildSystemPrompt() },
    {
      role: "user" as const,
      content: `${buildJsonSchemaInstruction()}\nVIN: ${vin}`,
    },
  ];

  const completion = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    temperature: 0,
  });

  const content = completion.choices?.[0]?.message?.content ?? "";
  try {
    const result = await parseJsonResponse(content);

    // Generate car image after recognition
    let imagePath: string | null = null;
    try {
      if (result.make && result.model && result.year) {
        imagePath = await generateCarImage({
          make: result.make,
          model: result.model,
          year: result.year,
        });
      }
    } catch (error) {
      console.error("Failed to generate car image:", error);
      // Continue without image if generation fails
    }

    const recognitionResult = { ...result, vin, imagePath };

    // Save to database
    await saveRecognitionToDatabase(recognitionResult, "vin", userId);

    return recognitionResult;
  } catch {
    // Best-effort fallback with minimal fields
    let imagePath: string | null = null;
    try {
      imagePath = await generateCarImage({
        make: "Unknown",
        model: "Unknown",
        year: new Date().getFullYear(),
      });
    } catch {
      // Ignore image generation errors in fallback
    }

    const fallbackResult = carRecognitionResultSchema.parse({
      vin,
      make: "Unknown",
      model: "Unknown",
      year: new Date().getFullYear(),
      imagePath,
      connectorTypes: [],
      charging: undefined,
      confidence: 0,
      sources: [],
    });

    // Save fallback result to database
    await saveRecognitionToDatabase(fallbackResult, "vin", userId);

    return fallbackResult;
  }
}

export async function recognizeCarBySpec(
  specInput: CarSpec,
  userId?: string
): Promise<CarRecognitionResult> {
  const spec = carSpecSchema.parse(specInput);
  const client = createOpenAIClient();
  const messages = [
    { role: "system" as const, content: buildSystemPrompt() },
    {
      role: "user" as const,
      content: `${buildJsonSchemaInstruction()}\nMake: ${spec.make}\nModel: ${
        spec.model
      }\nYear: ${spec.year}`,
    },
  ];

  const completion = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    temperature: 0.2,
  });

  const content = completion.choices?.[0]?.message?.content ?? "";
  try {
    const result = await parseJsonResponse(content);

    // Generate car image after recognition
    let imagePath: string | null = null;
    try {
      if (result.make && result.model && result.year) {
        imagePath = await generateCarImage({
          make: result.make,
          model: result.model,
          year: result.year,
        });
      }
    } catch (error: any) {
      console.error("Failed to generate car image:", {
        error: error?.message || error,
        make: result.make,
        model: result.model,
        year: result.year,
      });
      // Continue without image if generation fails
    }

    const recognitionResult = { ...result, imagePath };

    // Save to database
    await saveRecognitionToDatabase(recognitionResult, "spec", userId);

    return recognitionResult;
  } catch {
    // Best-effort fallback - try to generate image even with fallback data
    let imagePath: string | null = null;
    try {
      imagePath = await generateCarImage({
        make: spec.make,
        model: spec.model,
        year: spec.year,
      });
    } catch {
      // Ignore image generation errors in fallback
    }

    const fallbackResult = carRecognitionResultSchema.parse({
      make: spec.make,
      model: spec.model,
      year: spec.year,
      imagePath,
      connectorTypes: [],
      charging: undefined,
      confidence: 0,
      sources: [],
    });

    // Save fallback result to database
    await saveRecognitionToDatabase(fallbackResult, "spec", userId);

    return fallbackResult;
  }
}

/**
 * Save car recognition result to database
 */
async function saveRecognitionToDatabase(
  result: CarRecognitionResult,
  method: "vin" | "spec",
  userId?: string
): Promise<void> {
  try {
    await connectToDatabase();

    const recognitionData = {
      userId: userId || undefined,
      vin: result.vin || undefined,
      make: result.make,
      carModel: result.model, // Map 'model' to 'carModel' in database
      year: result.year,
      trim: result.trim || undefined,
      bodyStyle: result.bodyStyle || undefined,
      drivetrain: result.drivetrain || undefined,
      engine: result.engine || undefined,
      battery: result.battery || undefined,
      imagePath: result.imagePath || undefined,
      connectorTypes: result.connectorTypes || [],
      charging: result.charging
        ? {
            capacityKWh: result.charging.capacityKWh || undefined,
            acMaxKw: result.charging.acMaxKw || undefined,
            dcMaxKw: result.charging.dcMaxKw || undefined,
            onboardChargerKw: result.charging.onboardChargerKw || undefined,
            chargePortLocation: result.charging.chargePortLocation || undefined,
          }
        : undefined,
      confidence: result.confidence,
      sources: result.sources || [],
      recognitionMethod: method,
    };

    const saved = await CarRecognition.create(recognitionData);
    console.log(
      `Successfully saved car recognition: ${saved._id} for user: ${
        userId || "anonymous"
      }`
    );
  } catch (error: any) {
    // Log error but don't fail the recognition request
    console.error("Failed to save car recognition to database:", {
      error: error?.message || error,
      stack: error?.stack,
      userId,
      make: result.make,
      model: result.model,
      year: result.year,
    });
  }
}

/**
 * Convert database document to API response format
 */
function recognitionToResponse(
  doc: any
): CarRecognitionResult & { id: string; createdAt: string; updatedAt: string } {
  return {
    id: doc._id.toString(),
    vin: doc.vin,
    make: doc.make,
    model: doc.carModel, // Map 'carModel' back to 'model' in API response
    year: doc.year,
    trim: doc.trim || null,
    bodyStyle: doc.bodyStyle || null,
    drivetrain: doc.drivetrain || null,
    engine: doc.engine || null,
    battery: doc.battery || null,
    imagePath: doc.imagePath || null,
    connectorTypes: doc.connectorTypes || [],
    charging: doc.charging
      ? {
          capacityKWh: doc.charging.capacityKWh || null,
          acMaxKw: doc.charging.acMaxKw || null,
          dcMaxKw: doc.charging.dcMaxKw || null,
          onboardChargerKw: doc.charging.onboardChargerKw || null,
          chargePortLocation: doc.charging.chargePortLocation || null,
        }
      : undefined,
    confidence: doc.confidence,
    sources: doc.sources || [],
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

/**
 * Get user's car recognition history
 */
export async function getUserRecognitions(
  userId: string,
  limit: number = 50,
  offset: number = 0
): Promise<
  (CarRecognitionResult & {
    id: string;
    createdAt: string;
    updatedAt: string;
  })[]
> {
  await connectToDatabase();

  const recognitions = await CarRecognition.find({ userId })
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  return recognitions.map(recognitionToResponse);
}

/**
 * Get car recognition by ID
 */
export async function getRecognitionById(
  recognitionId: string,
  userId?: string
): Promise<
  | (CarRecognitionResult & {
      id: string;
      createdAt: string;
      updatedAt: string;
    })
  | null
> {
  await connectToDatabase();

  const query: any = { _id: recognitionId };
  // If userId is provided, ensure the recognition belongs to that user
  if (userId) {
    query.userId = userId;
  }

  const recognition = await CarRecognition.findOne(query).lean();

  if (!recognition) {
    return null;
  }

  return recognitionToResponse(recognition);
}

/**
 * Get car recognition by VIN
 */
export async function getRecognitionByVIN(
  vin: string,
  userId?: string
): Promise<
  | (CarRecognitionResult & {
      id: string;
      createdAt: string;
      updatedAt: string;
    })
  | null
> {
  await connectToDatabase();

  const query: any = { vin };
  // If userId is provided, prioritize user's own recognition
  if (userId) {
    query.userId = userId;
  }

  const recognition = await CarRecognition.findOne(query)
    .sort({ createdAt: -1 })
    .lean();

  if (!recognition) {
    return null;
  }

  return recognitionToResponse(recognition);
}

/**
 * Search car recognitions by make, model, and/or year
 */
export async function searchRecognitions(
  filters: {
    make?: string;
    model?: string;
    year?: number;
    userId?: string;
  },
  limit: number = 50,
  offset: number = 0
): Promise<
  (CarRecognitionResult & {
    id: string;
    createdAt: string;
    updatedAt: string;
  })[]
> {
  await connectToDatabase();

  const query: any = {};

  if (filters.make) {
    query.make = { $regex: new RegExp(filters.make, "i") }; // Case-insensitive search
  }

  if (filters.model) {
    query.carModel = { $regex: new RegExp(filters.model, "i") }; // Case-insensitive search
  }

  if (filters.year) {
    query.year = filters.year;
  }

  if (filters.userId) {
    query.userId = filters.userId;
  }

  const recognitions = await CarRecognition.find(query)
    .sort({ createdAt: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  return recognitions.map(recognitionToResponse);
}
