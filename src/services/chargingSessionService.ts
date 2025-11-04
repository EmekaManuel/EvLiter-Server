import { connectToDatabase } from "../lib/db.js";
import { ChargingSession } from "../models/ChargingSession.js";
import {
  type ChargingSession as ChargingSessionType,
  type UserStats,
  type StartChargingSessionRequest,
  type EndChargingSessionRequest,
  type GetSessionsRequest,
  type UpdateActiveSessionRequest,
} from "../schemas/chargingSession.js";
import { getCompanyStations } from "./chargingStationService.js";

/**
 * Convert MongoDB document to API response format
 */
function sessionToResponse(doc: any): ChargingSessionType {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    stationId: doc.stationId,
    stationName: doc.stationName,
    connectorId: doc.connectorId,
    startTime: doc.startTime.toISOString(),
    endTime: doc.endTime?.toISOString(),
    duration: doc.duration,
    energyDelivered: doc.energyDelivered,
    totalCost: doc.totalCost,
    averagePower: doc.averagePower,
    batteryLevel: doc.batteryLevel,
    batteryLevelStart: doc.batteryLevelStart,
    status: doc.status,
    stationRating: doc.stationRating,
    stationAddress: doc.stationAddress,
    stationLocation: doc.stationLocation,
    stationPricePerKWh: doc.stationPricePerKWh,
    stationPowerOutput: doc.stationPowerOutput,
    stationConnectorTypes: doc.stationConnectorTypes,
    stationAmenities: doc.stationAmenities,
    stationOperatingHours: doc.stationOperatingHours,
    stationIsCompanyStation: doc.stationIsCompanyStation,
    stationRealtimeAvailability: doc.stationRealtimeAvailability,
  };
}

/**
 * Get station name from stationId
 */
async function getStationName(stationId: string): Promise<string> {
  try {
    const companyStations = await getCompanyStations();
    const station = companyStations.find((s) => s.id === stationId);
    if (station) {
      return station.name;
    }
    // If not found in company stations, return a generic name
    return `Charging Station ${stationId}`;
  } catch (error) {
    return `Charging Station ${stationId}`;
  }
}

/**
 * Calculate estimated charging time based on power output and energy needed
 * @param powerOutputKw - Station power output in kW
 * @param energyNeededKWh - Energy needed in kWh
 * @param efficiency - Charging efficiency (default 0.9 or 90%)
 * @returns Estimated time in minutes
 */
export function calculateEstimatedChargingTime(
  powerOutputKw: number,
  energyNeededKWh: number,
  efficiency: number = 0.9
): number {
  if (powerOutputKw <= 0 || energyNeededKWh <= 0) {
    return 0;
  }
  // Account for charging efficiency
  const actualEnergyNeeded = energyNeededKWh / efficiency;
  // Calculate time in hours then convert to minutes
  const timeHours = actualEnergyNeeded / powerOutputKw;
  return Math.ceil(timeHours * 60); // Round up to nearest minute
}

/**
 * Calculate real-time charging session values based on elapsed time
 * @param session - The charging session document
 * @param batteryCapacityKWh - Battery capacity in kWh (default 60 kWh)
 * @param efficiency - Charging efficiency (default 0.9 or 90%)
 * @returns Calculated values for energy, power, cost, and battery level
 */
function calculateRealTimeValues(
  session: any,
  batteryCapacityKWh: number = 60,
  efficiency: number = 0.9
): {
  energyDelivered: number;
  averagePower: number;
  totalCost: number;
  batteryLevel: number;
  duration: number;
} {
  const now = new Date();
  const durationMs = now.getTime() - session.startTime.getTime();
  const durationMinutes = Math.floor(durationMs / (1000 * 60));
  const durationHours = durationMinutes / 60;

  // Use station power output if available, otherwise use stored average power or default
  const powerOutputKw = session.stationPowerOutput || session.averagePower || 0;

  if (powerOutputKw <= 0 || durationMinutes <= 0) {
    return {
      energyDelivered: session.energyDelivered || 0,
      averagePower: session.averagePower || 0,
      totalCost: session.totalCost || 0,
      batteryLevel: session.batteryLevel || session.batteryLevelStart,
      duration: durationMinutes,
    };
  }

  // Calculate energy delivered: Power (kW) × Time (hours) × Efficiency
  const calculatedEnergy = powerOutputKw * durationHours * efficiency;

  // Use the maximum of calculated vs stored energy (ensures values never decrease)
  const energyDelivered = Math.max(
    calculatedEnergy,
    session.energyDelivered || 0
  );

  // Calculate average power (kW)
  const averagePower =
    durationHours > 0 ? energyDelivered / durationHours : powerOutputKw;

  // Calculate cost: Energy (kWh) × Price per kWh
  const pricePerKWh = session.stationPricePerKWh || 0;
  const totalCost = energyDelivered * pricePerKWh;

  // Calculate battery level: Start Level + (Energy / Battery Capacity) × 100
  const batteryIncrease = (energyDelivered / batteryCapacityKWh) * 100;
  const calculatedBatteryLevel = Math.min(
    100,
    session.batteryLevelStart + batteryIncrease
  );

  // Use the maximum of calculated vs stored battery level (ensures values never decrease)
  const batteryLevel = Math.max(
    calculatedBatteryLevel,
    session.batteryLevel || session.batteryLevelStart
  );

  return {
    energyDelivered: parseFloat(energyDelivered.toFixed(2)),
    averagePower: parseFloat(averagePower.toFixed(2)),
    totalCost: parseFloat(totalCost.toFixed(2)),
    batteryLevel: parseFloat(batteryLevel.toFixed(1)),
    duration: durationMinutes,
  };
}

/**
 * Calculate cost based on energy delivered and price per kWh
 * Uses session's stored pricePerKWh if available, otherwise looks up from station
 */
async function calculateCost(
  energyDelivered: number,
  stationId: string,
  sessionPricePerKWh?: number
): Promise<number> {
  // Use price stored in session if available (captured at session start)
  if (sessionPricePerKWh !== undefined && sessionPricePerKWh > 0) {
    return energyDelivered * sessionPricePerKWh;
  }

  // Fallback to lookup from station
  try {
    const companyStations = await getCompanyStations();
    const station = companyStations.find((s) => s.id === stationId);
    const pricePerKWh = station?.pricePerKWh || 165; // Default to 165 Naira
    return energyDelivered * pricePerKWh;
  } catch (error) {
    // Default calculation
    return energyDelivered * 165;
  }
}

/**
 * Start a new charging session
 */
export async function startChargingSession(
  userId: string,
  request: StartChargingSessionRequest
): Promise<{ success: boolean; data: ChargingSessionType }> {
  await connectToDatabase();

  // Check if user already has an active session
  const existingActive = await ChargingSession.findOne({
    userId,
    status: "active",
  });

  if (existingActive) {
    throw new Error("User already has an active charging session");
  }

  // Station data is now required in the request
  const station = request.station;
  if (!station) {
    throw new Error("Station data is required to start a charging session");
  }

  // Validate that the stationId matches
  if (station.id !== request.stationId) {
    throw new Error("Station ID mismatch between request and station data");
  }

  // Validate connector type is available at this station
  // Use connectorType if provided, otherwise try to extract from connectorId or use connectorId
  const connectorTypeToValidate = request.connectorType || request.connectorId;

  if (!station.connectorTypes.includes(connectorTypeToValidate)) {
    throw new Error(
      `Connector type ${connectorTypeToValidate} is not available at this station. Available types: ${station.connectorTypes.join(
        ", "
      )}`
    );
  }

  // Create new session with all station details
  const session = new ChargingSession({
    userId,
    stationId: request.stationId,
    stationName: station.name,
    connectorId: request.connectorId,
    batteryLevel: request.batteryLevelStart,
    batteryLevelStart: request.batteryLevelStart,
    status: "active",
    duration: 0,
    energyDelivered: 0,
    totalCost: 0,
    averagePower: 0,
    // Store all station details for reference and calculations
    stationAddress: station.address,
    stationLocation: station.location,
    stationPricePerKWh: station.pricePerKWh,
    stationPowerOutput: station.powerOutput,
    stationConnectorTypes: station.connectorTypes,
    stationAmenities: station.amenities,
    stationOperatingHours: station.operatingHours,
    stationIsCompanyStation: station.isCompanyStation,
    stationRealtimeAvailability: station.realtimeAvailability,
  });

  await session.save();

  return {
    success: true,
    data: sessionToResponse(session),
  };
}

/**
 * End/stop a charging session
 */
export async function endChargingSession(
  userId: string,
  request: EndChargingSessionRequest
): Promise<{ success: boolean; data: ChargingSessionType }> {
  await connectToDatabase();

  const session = await ChargingSession.findOne({
    _id: request.sessionId,
    userId,
    status: "active",
  });

  if (!session) {
    throw new Error("Active charging session not found");
  }

  // Update session with end time and final values
  const endTime = new Date();
  const durationMs = endTime.getTime() - session.startTime.getTime();
  const durationMinutes = Math.floor(durationMs / (1000 * 60));

  // If battery level is provided, use it; otherwise estimate from energy delivered
  if (request.batteryLevelEnd !== undefined) {
    session.batteryLevel = request.batteryLevelEnd;
  }

  // If energy delivered wasn't set, estimate based on battery level change
  if (session.energyDelivered === 0 && request.batteryLevelEnd !== undefined) {
    const batteryIncrease = request.batteryLevelEnd - session.batteryLevelStart;
    // Rough estimate: assume 100% = 60 kWh (adjust based on your EV models)
    const estimatedEnergy = (batteryIncrease / 100) * 60;
    session.energyDelivered = Math.max(0, estimatedEnergy);
  }

  // Calculate average power if we have duration and energy
  if (durationMinutes > 0 && session.energyDelivered > 0) {
    session.averagePower = (session.energyDelivered / durationMinutes) * 60; // kW

    // Compare with station's power output for validation
    // If average power significantly exceeds station power, cap it
    if (
      session.stationPowerOutput &&
      session.averagePower > session.stationPowerOutput * 1.2
    ) {
      // Allow 20% tolerance, but log if it's way off (might indicate measurement error)
      console.warn(
        `Average power (${session.averagePower.toFixed(
          2
        )} kW) exceeds station power output (${
          session.stationPowerOutput
        } kW) for session ${session._id}`
      );
    }
  } else if (session.stationPowerOutput && durationMinutes > 0) {
    // If we don't have energy but have power output, estimate energy from power
    // This is a fallback calculation
    const estimatedEnergyFromPower =
      (session.stationPowerOutput * durationMinutes) / 60;
    if (session.energyDelivered === 0) {
      session.energyDelivered = estimatedEnergyFromPower;
      session.averagePower = session.stationPowerOutput;
    }
  }

  // Calculate cost (use stored pricePerKWh if available)
  session.totalCost = await calculateCost(
    session.energyDelivered,
    session.stationId,
    session.stationPricePerKWh
  );

  session.endTime = endTime;
  session.duration = durationMinutes;
  session.status = "completed";

  if (request.stationRating) {
    session.stationRating = request.stationRating;
  }

  await session.save();

  return {
    success: true,
    data: sessionToResponse(session),
  };
}

/**
 * Update active session (for real-time battery level updates)
 */
export async function updateActiveSession(
  userId: string,
  request: UpdateActiveSessionRequest
): Promise<{ success: boolean; data: ChargingSessionType }> {
  await connectToDatabase();

  const session = await ChargingSession.findOne({
    userId,
    status: "active",
  });

  if (!session) {
    throw new Error("No active charging session found");
  }

  // Calculate real-time values based on elapsed time
  const realTimeValues = calculateRealTimeValues(session);

  // Update battery level - use provided value or calculated value (whichever is higher)
  if (request.batteryLevel !== undefined) {
    session.batteryLevel = Math.max(
      request.batteryLevel,
      realTimeValues.batteryLevel
    );
  } else {
    session.batteryLevel = realTimeValues.batteryLevel;
  }

  // Update energy delivered - use provided value or calculated value (whichever is higher)
  if (request.energyDelivered !== undefined) {
    session.energyDelivered = Math.max(
      request.energyDelivered,
      realTimeValues.energyDelivered
    );
  } else {
    session.energyDelivered = realTimeValues.energyDelivered;
  }

  // Update duration and power
  session.duration = realTimeValues.duration;
  session.averagePower = realTimeValues.averagePower;

  // Update cost using calculated energy
  session.totalCost = realTimeValues.totalCost;

  await session.save();

  return {
    success: true,
    data: sessionToResponse(session),
  };
}

/**
 * Get user's charging sessions with filters
 */
export async function getUserSessions(
  userId: string,
  request?: GetSessionsRequest
): Promise<ChargingSessionType[]> {
  await connectToDatabase();

  const filter: GetSessionsRequest["filter"] = request?.filter || "all-time";
  const limit = request?.limit || 50;
  const offset = request?.offset || 0;

  let query: any = { userId };

  // Apply time filters
  const now = new Date();
  if (filter === "recent") {
    // Last 5 sessions
    const sessions = await ChargingSession.find({ userId })
      .sort({ startTime: -1 })
      .limit(5)
      .lean();
    return sessions.map(sessionToResponse);
  } else if (filter === "this-month") {
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    query.startTime = { $gte: startOfMonth };
  }
  // "all-time" doesn't need additional filtering

  const sessions = await ChargingSession.find(query)
    .sort({ startTime: -1 })
    .skip(offset)
    .limit(limit)
    .lean();

  return sessions.map(sessionToResponse);
}

/**
 * Get user's active session with real-time calculated values
 */
export async function getActiveSession(
  userId: string
): Promise<ChargingSessionType | null> {
  await connectToDatabase();

  const session = await ChargingSession.findOne({
    userId,
    status: "active",
  });

  if (!session) {
    return null;
  }

  // Calculate real-time values based on elapsed time
  const realTimeValues = calculateRealTimeValues(session);

  // Update session with calculated values (but don't save - just for response)
  session.energyDelivered = realTimeValues.energyDelivered;
  session.averagePower = realTimeValues.averagePower;
  session.totalCost = realTimeValues.totalCost;
  session.batteryLevel = realTimeValues.batteryLevel;
  session.duration = realTimeValues.duration;

  return sessionToResponse(session);
}

/**
 * Get user statistics
 */
export async function getUserStats(userId: string): Promise<UserStats> {
  await connectToDatabase();

  const allSessions = await ChargingSession.find({
    userId,
    status: { $in: ["completed", "cancelled"] },
  }).lean();

  // Calculate totals
  const totalSessions = allSessions.length;
  const totalEnergyUsed = allSessions.reduce(
    (sum, s) => sum + (s.energyDelivered || 0),
    0
  );
  const totalSpent = allSessions.reduce(
    (sum, s) => sum + (s.totalCost || 0),
    0
  );
  const totalDuration = allSessions.reduce(
    (sum, s) => sum + (s.duration || 0),
    0
  );
  const averageSessionDuration =
    totalSessions > 0 ? totalDuration / totalSessions : 0;

  // Find favorite station
  const stationCounts: Record<string, number> = {};
  allSessions.forEach((s) => {
    stationCounts[s.stationId] = (stationCounts[s.stationId] || 0) + 1;
  });
  const sortedStations = Object.entries(stationCounts).sort(
    (a, b) => b[1] - a[1]
  );
  const favoriteStation =
    sortedStations.length > 0 && sortedStations[0]
      ? sortedStations[0][0]
      : undefined;

  // Calculate monthly usage
  const monthlyUsageMap: Record<
    string,
    { sessions: number; energyUsed: number; totalSpent: number }
  > = {};
  allSessions.forEach((s) => {
    const month = s.startTime.toISOString().substring(0, 7); // YYYY-MM
    if (!monthlyUsageMap[month]) {
      monthlyUsageMap[month] = { sessions: 0, energyUsed: 0, totalSpent: 0 };
    }
    monthlyUsageMap[month].sessions += 1;
    monthlyUsageMap[month].energyUsed += s.energyDelivered || 0;
    monthlyUsageMap[month].totalSpent += s.totalCost || 0;
  });

  const monthlyUsage = Object.entries(monthlyUsageMap)
    .map(([month, data]) => ({
      month,
      sessions: data.sessions,
      energyUsed: data.energyUsed,
      totalSpent: data.totalSpent,
    }))
    .sort((a, b) => b.month.localeCompare(a.month))
    .slice(0, 12); // Last 12 months

  return {
    totalSessions,
    totalEnergyUsed,
    totalSpent,
    averageSessionDuration,
    favoriteStation,
    monthlyUsage,
  };
}
