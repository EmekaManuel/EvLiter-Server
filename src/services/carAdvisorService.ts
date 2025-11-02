import { createOpenAIClient } from "../lib/openaiClient.js";
import {
  chargingTimeRequestSchema,
  chargingTimeResultSchema,
  costEstimateRequestSchema,
  costEstimateResultSchema,
  recommendationRequestSchema,
  recommendationResultSchema,
  type ChargingTimeRequest,
  type ChargingTimeResult,
  type CostEstimateRequest,
  type CostEstimateResult,
  type RecommendationRequest,
  type RecommendationResult,
} from "../schemas/carAdvisor";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

// Nigerian electricity pricing (approximate rates as of 2024)
const ELECTRICITY_RATES_NAIRA = {
  home: {
    peak: 85, // ₦85/kWh during peak hours
    off_peak: 50, // ₦50/kWh during off-peak
    standard: 68, // ₦68/kWh standard rate
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
};

/**
 * Calculate charging time based on battery capacity and charger power
 */
export async function calculateChargingTime(
  request: ChargingTimeRequest
): Promise<ChargingTimeResult> {
  const validated = chargingTimeRequestSchema.parse(request);

  const {
    batteryCapacityKWh,
    currentChargePercent,
    targetChargePercent,
    chargerPowerKw,
    chargerType,
    efficiency,
  } = validated;

  // Calculate energy needed
  const chargeNeeded = targetChargePercent - currentChargePercent;
  const energyNeededKWh = (batteryCapacityKWh * chargeNeeded) / 100;

  // Account for charging efficiency
  const actualEnergyNeeded = energyNeededKWh / efficiency;

  // Calculate time in hours
  const timeHours = actualEnergyNeeded / chargerPowerKw;
  const timeMinutes = timeHours * 60;

  // Generate explanation
  let explanation = `To charge from ${currentChargePercent}% to ${targetChargePercent}%, `;
  explanation += `you need approximately ${energyNeededKWh.toFixed(
    2
  )} kWh of energy. `;
  explanation += `Using a ${chargerPowerKw} kW ${chargerType} charger with ${(
    efficiency * 100
  ).toFixed(0)}% efficiency, `;
  explanation += `this will take about ${Math.floor(
    timeHours
  )} hours and ${Math.round((timeHours % 1) * 60)} minutes.`;

  if (chargerType === "DC" && timeHours > 1) {
    explanation +=
      " Note: DC fast charging may slow down as the battery approaches full capacity.";
  }

  return chargingTimeResultSchema.parse({
    estimatedTimeMinutes: Math.round(timeMinutes),
    estimatedTimeHours: parseFloat(timeHours.toFixed(2)),
    energyNeededKWh: parseFloat(energyNeededKWh.toFixed(2)),
    chargerType,
    chargerPowerKw,
    explanation,
  });
}

/**
 * Calculate cost estimate in Nigerian Naira
 */
export async function calculateCostEstimate(
  request: CostEstimateRequest
): Promise<CostEstimateResult> {
  const validated = costEstimateRequestSchema.parse(request);

  const { energyKWh, location, chargerType, timeOfDay } = validated;

  // Get base rate
  const baseRate = ELECTRICITY_RATES_NAIRA[chargerType][timeOfDay];

  // Calculate energy cost
  const energyCost = energyKWh * baseRate;

  // Add service fee for public chargers
  let serviceFee = 0;
  if (chargerType !== "home") {
    serviceFee = energyCost * 0.1; // 10% service fee
  }

  // VAT (7.5% in Nigeria)
  const tax = (energyCost + serviceFee) * 0.075;

  const totalCost = energyCost + serviceFee + tax;

  // Generate explanation
  let explanation = `Charging ${energyKWh.toFixed(2)} kWh at `;
  explanation += `₦${baseRate}/kWh (${chargerType.replace(
    "_",
    " "
  )} - ${timeOfDay.replace("_", " ")}) `;
  explanation += `costs ₦${energyCost.toFixed(2)}. `;

  if (serviceFee > 0) {
    explanation += `Service fee: ₦${serviceFee.toFixed(2)}. `;
  }

  explanation += `With VAT: ₦${totalCost.toFixed(2)} total.`;

  if (timeOfDay === "peak") {
    explanation +=
      " Tip: Charging during off-peak hours can save you up to 40%.";
  }

  return costEstimateResultSchema.parse({
    estimatedCostNaira: parseFloat(totalCost.toFixed(2)),
    pricePerKWhNaira: baseRate,
    location,
    chargerType,
    timeOfDay,
    breakdown: {
      energyCost: parseFloat(energyCost.toFixed(2)),
      serviceFee:
        serviceFee > 0 ? parseFloat(serviceFee.toFixed(2)) : undefined,
      tax: parseFloat(tax.toFixed(2)),
    },
    explanation,
  });
}

/**
 * Get AI-powered recommendations for charging stations and strategies
 */
export async function getRecommendations(
  request: RecommendationRequest
): Promise<RecommendationResult> {
  const validated = recommendationRequestSchema.parse(request);
  const client = createOpenAIClient();

  const systemPrompt = `You are an EV charging advisor for Nigeria. Provide practical, localized recommendations for charging stations, strategies, and insights based on the user's car and location. Consider Nigerian infrastructure, electricity costs, and driving patterns.`;

  const userPrompt = `
Given the following information, provide charging recommendations in JSON format:

Car: ${validated.car.make} ${validated.car.model} (${validated.car.year})
${
  validated.car.batteryCapacityKWh
    ? `Battery: ${validated.car.batteryCapacityKWh} kWh`
    : ""
}
${validated.car.rangeKm ? `Range: ${validated.car.rangeKm} km` : ""}

Location: ${validated.location.city}${
    validated.location.state ? `, ${validated.location.state}` : ""
  }

Preferences:
${
  validated.preferences?.dailyDrivingKm
    ? `- Daily driving: ${validated.preferences.dailyDrivingKm} km`
    : ""
}
${
  validated.preferences?.chargingFrequency
    ? `- Charging frequency: ${validated.preferences.chargingFrequency}`
    : ""
}
${validated.preferences?.prioritizeSpeed ? "- Prioritizes fast charging" : ""}
${
  validated.preferences?.homeCharging !== undefined
    ? `- Home charging: ${
        validated.preferences.homeCharging ? "available" : "not available"
      }`
    : ""
}

Return JSON with this structure:
{
  "chargingStations": [
    {
      "name": "Station name",
      "address": "Full address",
      "distance": number (km from location),
      "chargerTypes": ["Type2", "CCS", etc.],
      "maxPowerKw": number,
      "availability": "High/Medium/Low",
      "estimatedCostRange": "₦X - ₦Y per charge",
      "amenities": ["WiFi", "Cafe", etc.],
      "confidence": 0.0-1.0
    }
  ],
  "chargingStrategy": {
    "recommendedFrequency": "Daily/Weekly/etc.",
    "optimalChargeRange": "20-80%",
    "estimatedMonthlyCost": "₦X - ₦Y",
    "tips": ["Practical tip 1", "tip 2"]
  },
  "carInsights": {
    "efficiency": "Good/Average/Poor for Nigerian conditions",
    "rangeAnxietyLevel": "Low/Medium/High",
    "suitabilityScore": 0-10,
    "considerations": ["Important point 1", "point 2"]
  },
  "confidence": 0.0-1.0,
  "sources": ["source1", "source2"]
}

Be realistic about Nigerian infrastructure. If uncertain about specific stations, set confidence lower and note this in tips.`;

  const completion = await client.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const content = completion.choices?.[0]?.message?.content ?? "{}";

  try {
    const data = JSON.parse(content);
    return recommendationResultSchema.parse(data);
  } catch (error) {
    // Fallback response
    return recommendationResultSchema.parse({
      chargingStations: [
        {
          name: "Information unavailable",
          address: `${validated.location.city} area`,
          distance: 0,
          chargerTypes: ["Type2"],
          maxPowerKw: 7,
          confidence: 0.2,
        },
      ],
      chargingStrategy: {
        recommendedFrequency: "Based on your driving patterns",
        optimalChargeRange: "20-80% for battery longevity",
        estimatedMonthlyCost: "Varies by usage",
        tips: [
          "Charge during off-peak hours (10 PM - 6 AM) to save costs",
          "Avoid charging to 100% daily unless needed for long trips",
          "Plan routes with charging stations in mind",
        ],
      },
      carInsights: {
        rangeAnxietyLevel: "Medium",
        suitabilityScore: 6,
        considerations: [
          "Consider your daily driving distance vs. vehicle range",
          "Home charging is ideal if available",
          "Research local charging infrastructure",
        ],
      },
      confidence: 0.2,
      sources: [],
    });
  }
}
