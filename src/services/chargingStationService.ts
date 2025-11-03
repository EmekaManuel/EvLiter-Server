import { createOpenAIClient } from "../lib/openaiClient.js";
import {
  chargingStationSchema,
  searchChargingStationsRequestSchema,
  type ChargingStation,
  type SearchChargingStationsRequest,
  type SearchChargingStationsResponse,
} from "../schemas/chargingStations.js";

const DEFAULT_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";

/**
 * Hardcoded company charging stations
 * These are EvLiter's own charging stations
 */
const COMPANY_CHARGING_STATIONS: Omit<ChargingStation, "distance">[] = [
  {
    id: "evliter-lagos-victoria-island",
    name: "EvLiter Charging Hub - Victoria Island",
    address: "Ahmadu Bello Way, Victoria Island, Lagos",
    location: {
      lat: 6.4281,
      lng: 3.4219,
    },
    connectorTypes: ["Type2", "CCS"],
    powerOutput: 50,
    realtimeAvailability: "Available",
    isCompanyStation: true,
    amenities: ["WiFi", "Restroom", "Coffee Shop", "Parking"],
    operatingHours: "24/7",
    pricePerKWh: 165,
  },
  {
    id: "evliter-lagos-ikeja",
    name: "EvLiter Charging Station - Ikeja",
    address: "Oba Akran Avenue, Ikeja, Lagos",
    location: {
      lat: 6.5244,
      lng: 3.3792,
    },
    connectorTypes: ["Type2", "CCS", "CHAdeMO"],
    powerOutput: 150,
    realtimeAvailability: "Available",
    isCompanyStation: true,
    amenities: ["WiFi", "Restroom", "Supermarket", "Parking"],
    operatingHours: "6:00 AM - 11:00 PM",
    pricePerKWh: 180,
  },
  {
    id: "evliter-lagos-lekki",
    name: "EvLiter Fast Charge - Lekki",
    address: "Lekki-Epe Expressway, Lekki Phase 1, Lagos",
    location: {
      lat: 6.4654,
      lng: 3.4939,
    },
    connectorTypes: ["CCS", "Type2"],
    powerOutput: 75,
    realtimeAvailability: "Available",
    isCompanyStation: true,
    amenities: ["WiFi", "Restroom", "Restaurant", "Parking"],
    operatingHours: "24/7",
    pricePerKWh: 170,
  },
  {
    id: "evliter-abuja-wuse",
    name: "EvLiter Charging Hub - Wuse 2",
    address: "Ademola Adetokunbo Crescent, Wuse 2, Abuja",
    location: {
      lat: 9.0765,
      lng: 7.3986,
    },
    connectorTypes: ["Type2", "CCS", "CHAdeMO"],
    powerOutput: 120,
    realtimeAvailability: "Available",
    isCompanyStation: true,
    amenities: ["WiFi", "Restroom", "Shopping Mall", "Parking"],
    operatingHours: "24/7",
    pricePerKWh: 175,
  },
  {
    id: "evliter-abuja-maitama",
    name: "EvLiter Charging Station - Maitama",
    address: "Ibrahim Way, Maitama, Abuja",
    location: {
      lat: 9.0548,
      lng: 7.4907,
    },
    connectorTypes: ["Type2", "CCS"],
    powerOutput: 50,
    realtimeAvailability: "Occupied",
    isCompanyStation: true,
    amenities: ["WiFi", "Restroom", "Parking"],
    operatingHours: "6:00 AM - 10:00 PM",
    pricePerKWh: 165,
  },
  {
    id: "evliter-port-harcourt",
    name: "EvLiter Charging Hub - Port Harcourt",
    address: "Aba Road, GRA Phase 2, Port Harcourt, Rivers",
    location: {
      lat: 4.8156,
      lng: 7.0498,
    },
    connectorTypes: ["Type2", "CCS"],
    powerOutput: 60,
    realtimeAvailability: "Available",
    isCompanyStation: true,
    amenities: ["WiFi", "Restroom", "Parking"],
    operatingHours: "6:00 AM - 11:00 PM",
    pricePerKWh: 160,
  },
  {
    id: "evliter-kano",
    name: "EvLiter Charging Station - Kano",
    address: "Murtala Mohammed Way, Kano",
    location: {
      lat: 11.9964,
      lng: 8.5167,
    },
    connectorTypes: ["Type2", "CCS"],
    powerOutput: 45,
    realtimeAvailability: "Available",
    isCompanyStation: true,
    amenities: ["WiFi", "Restroom", "Parking"],
    operatingHours: "7:00 AM - 9:00 PM",
    pricePerKWh: 155,
  },
  {
    id: "evliter-ibadan",
    name: "EvLiter Charging Hub - Ibadan",
    address: "Dugbe Market Road, Ibadan, Oyo",
    location: {
      lat: 7.3775,
      lng: 3.947,
    },
    connectorTypes: ["Type2", "CCS", "CHAdeMO"],
    powerOutput: 55,
    realtimeAvailability: "Available",
    isCompanyStation: true,
    amenities: ["WiFi", "Restroom", "Market Access", "Parking"],
    operatingHours: "6:00 AM - 10:00 PM",
    pricePerKWh: 158,
  },
  {
    id: "evliter-enugu",
    name: "EvLiter Charging Station - Enugu",
    address: "Ogui Road, Enugu",
    location: {
      lat: 6.4584,
      lng: 7.5464,
    },
    connectorTypes: ["Type2", "CCS"],
    powerOutput: 50,
    realtimeAvailability: "Available",
    isCompanyStation: true,
    amenities: ["WiFi", "Restroom", "Parking"],
    operatingHours: "6:00 AM - 10:00 PM",
    pricePerKWh: 162,
  },
  {
    id: "evliter-nsukka",
    name: "EvLiter Charging Hub - Nsukka",
    address: "University Road, Nsukka, Enugu",
    location: {
      lat: 6.8567,
      lng: 7.3958,
    },
    connectorTypes: ["Type2", "CCS"],
    powerOutput: 40,
    realtimeAvailability: "Available",
    isCompanyStation: true,
    amenities: ["WiFi", "Restroom", "Parking", "Café"],
    operatingHours: "7:00 AM - 9:00 PM",
    pricePerKWh: 150,
  },
];

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Get coordinates for a location using OpenAI (geocoding simulation)
 * In production, you might want to use a proper geocoding service like Google Maps Geocoding API
 */
async function getLocationCoordinates(
  location: string
): Promise<{ lat: number; lng: number } | null> {
  const client = createOpenAIClient();

  const prompt = `Given a location name "${location}", return only JSON with latitude and longitude coordinates for that location in Nigeria. If the location is ambiguous or unclear, use the most likely coordinates. Format: {"lat": number, "lng": number}. Return only JSON, no other text.`;

  try {
    const completion = await client.chat.completions.create({
      model: DEFAULT_MODEL,
      messages: [{ role: "user", content: prompt }],
      temperature: 0,
      response_format: { type: "json_object" },
    });

    const content = completion.choices?.[0]?.message?.content ?? "{}";
    const data = JSON.parse(content);
    if (data.lat && data.lng) {
      return { lat: data.lat, lng: data.lng };
    }
  } catch (error) {
    console.error("Failed to geocode location:", error);
  }

  // Fallback to default Lagos coordinates
  return { lat: 6.5244, lng: 3.3792 };
}

/**
 * Get AI-suggested charging stations based on location
 */
async function getAISuggestedStations(
  location: string,
  coordinates?: { lat: number; lng: number }
): Promise<Omit<ChargingStation, "distance">[]> {
  const client = createOpenAIClient();
  const searchCoords = coordinates ||
    (await getLocationCoordinates(location)) || {
      lat: 6.5244,
      lng: 3.3792,
    }; // Fallback to Lagos coordinates

  const systemPrompt = `You are an EV charging station database assistant for Nigeria. Provide realistic charging station information based on actual locations and infrastructure in Nigeria.`;

  const userPrompt = `Given the location "${location}" (coordinates: ${searchCoords.lat}, ${searchCoords.lng}), suggest 3-5 realistic charging stations in or near this area in Nigeria. Consider actual infrastructure and common locations.

Return JSON object with "stations" array:
{
  "stations": [
    {
      "id": "unique-id",
      "name": "Station name",
      "address": "Full address with city/state",
      "location": {"lat": number, "lng": number},
      "connectorTypes": ["Type2", "CCS", or "CHAdeMO"],
      "powerOutput": number (realistic kW: 7-150),
      "realtimeAvailability": "Available" | "Occupied" | "Out of Service",
      "isCompanyStation": false,
      "amenities": ["array of amenities"],
      "operatingHours": "string",
      "pricePerKWh": number (reasonable Naira amount: 150-200)
    }
  ]
}

Be realistic about power outputs and locations. Most stations should be 7-50kW, with some fast chargers at 50-150kW.`;

  try {
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
    const data = JSON.parse(content);
    const stations = Array.isArray(data) ? data : data.stations || [];

    return stations.map((station: any) => ({
      ...station,
      isCompanyStation: false,
    }));
  } catch (error) {
    console.error("Failed to get AI-suggested stations:", error);
    return [];
  }
}

/**
 * Filter stations based on search criteria
 */
function filterStations(
  stations: ChargingStation[],
  filters: {
    connectorType?: string;
    minPower?: number;
    maxDistance?: number;
  }
): ChargingStation[] {
  let filtered = [...stations];

  // Filter by connector type
  if (filters.connectorType && filters.connectorType !== "All Types") {
    filtered = filtered.filter((station) =>
      station.connectorTypes.includes(filters.connectorType!)
    );
  }

  // Filter by minimum power
  if (filters.minPower !== undefined && filters.minPower > 0) {
    filtered = filtered.filter(
      (station) => station.powerOutput >= filters.minPower!
    );
  }

  // Filter by maximum distance
  if (filters.maxDistance !== undefined && filters.maxDistance > 0) {
    filtered = filtered.filter((station) => {
      const distance = station.distance || 0;
      return distance <= filters.maxDistance!;
    });
  }

  return filtered;
}

/**
 * Search for charging stations
 */
export async function searchChargingStations(
  request: SearchChargingStationsRequest
): Promise<SearchChargingStationsResponse> {
  const validated = searchChargingStationsRequestSchema.parse(request);

  // Get search location coordinates
  const searchCoordinates =
    validated.coordinates || (await getLocationCoordinates(validated.location));

  if (!searchCoordinates) {
    throw new Error("Could not determine location coordinates");
  }

  // Get company stations
  const companyStations: ChargingStation[] = COMPANY_CHARGING_STATIONS.map(
    (station) => {
      const distance = calculateDistance(
        searchCoordinates.lat,
        searchCoordinates.lng,
        station.location.lat,
        station.location.lng
      );
      return { ...station, distance };
    }
  );

  // Get AI-suggested stations
  const aiSuggestedStationsRaw = await getAISuggestedStations(
    validated.location,
    searchCoordinates
  );
  const aiSuggestedStations: ChargingStation[] = aiSuggestedStationsRaw.map(
    (station) => {
      const distance = calculateDistance(
        searchCoordinates.lat,
        searchCoordinates.lng,
        station.location.lat,
        station.location.lng
      );
      return { ...station, distance };
    }
  );

  // Combine all stations
  let allStations = [...companyStations, ...aiSuggestedStations];

  // Apply filters
  allStations = filterStations(allStations, {
    connectorType: validated.connectorType,
    minPower: validated.minPower,
    maxDistance: validated.maxDistance,
  });

  // Sort by distance (closest first)
  allStations.sort((a, b) => (a.distance || 0) - (b.distance || 0));

  // Count stations
  const companyCount = allStations.filter((s) => s.isCompanyStation).length;
  const aiCount = allStations.filter((s) => !s.isCompanyStation).length;

  return {
    stations: allStations,
    totalCount: allStations.length,
    companyStationsCount: companyCount,
    aiSuggestedCount: aiCount,
  };
}

/**
 * Get all company charging stations (for admin/debugging purposes)
 */
export async function getCompanyStations(): Promise<ChargingStation[]> {
  return COMPANY_CHARGING_STATIONS.map((station) => ({
    ...station,
    distance: undefined,
  }));
}
