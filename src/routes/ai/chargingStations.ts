import { Router } from "express";
import {
  searchChargingStations,
  getCompanyStations,
} from "../../services/chargingStationService.js";
import { searchChargingStationsRequestSchema } from "../../schemas/chargingStations.js";

export const chargingStationsRouter = Router();

/**
 * GET /api/ai/charging-stations
 * Search for charging stations with filters
 * Query parameters:
 *   - location: string (required)
 *   - connectorType: string (optional, default: "All Types")
 *   - minPower: number (optional)
 *   - maxDistance: number (optional, in km)
 *   - lat: number (optional, for more accurate location)
 *   - lng: number (optional, for more accurate location)
 */
chargingStationsRouter.get("/", async (req, res) => {
  try {
    const { location, connectorType, minPower, maxDistance, lat, lng } =
      req.query;

    // Build request object
    const request: any = {
      location: location as string,
    };

    if (connectorType) {
      request.connectorType = connectorType;
    }

    if (minPower) {
      request.minPower = parseFloat(minPower as string);
    }

    if (maxDistance) {
      request.maxDistance = parseFloat(maxDistance as string);
    }

    if (lat && lng) {
      request.coordinates = {
        lat: parseFloat(lat as string),
        lng: parseFloat(lng as string),
      };
    }

    // Validate request
    const parse = searchChargingStationsRequestSchema.safeParse(request);
    if (!parse.success) {
      return res.status(400).json({
        error: "Invalid request",
        details: parse.error.flatten(),
      });
    }

    const result = await searchChargingStations(parse.data);
    return res.json(result);
  } catch (err: any) {
    const message = err?.message || "Failed to search charging stations";
    return res.status(500).json({ error: "Search failed", message });
  }
});

/**
 * POST /api/ai/charging-stations/search
 * Search for charging stations with filters (POST version for complex queries)
 */
chargingStationsRouter.post("/search", async (req, res) => {
  const parse = searchChargingStationsRequestSchema.safeParse(req.body);

  if (!parse.success) {
    return res.status(400).json({
      error: "Invalid request",
      details: parse.error.flatten(),
    });
  }

  try {
    const result = await searchChargingStations(parse.data);
    return res.json(result);
  } catch (err: any) {
    const message = err?.message || "Failed to search charging stations";
    return res.status(500).json({ error: "Search failed", message });
  }
});

/**
 * GET /api/ai/charging-stations/company
 * Get all company (EvLiter) charging stations
 */
chargingStationsRouter.get("/company", async (req, res) => {
  try {
    const stations = await getCompanyStations();
    return res.json({
      stations,
      count: stations.length,
    });
  } catch (err: any) {
    const message = err?.message || "Failed to get company stations";
    return res.status(500).json({ error: "Request failed", message });
  }
});
