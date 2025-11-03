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
 * Calculate cost based on energy delivered and price per kWh
 */
async function calculateCost(
  energyDelivered: number,
  stationId: string
): Promise<number> {
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

  // Get station name
  const stationName = await getStationName(request.stationId);

  // Create new session
  const session = new ChargingSession({
    userId,
    stationId: request.stationId,
    stationName,
    connectorId: request.connectorId,
    batteryLevel: request.batteryLevelStart,
    batteryLevelStart: request.batteryLevelStart,
    status: "active",
    duration: 0,
    energyDelivered: 0,
    totalCost: 0,
    averagePower: 0,
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
  }

  // Calculate cost
  session.totalCost = await calculateCost(
    session.energyDelivered,
    session.stationId
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

  // Update battery level
  session.batteryLevel = request.batteryLevel;

  // Update energy delivered if provided
  if (request.energyDelivered !== undefined) {
    session.energyDelivered = request.energyDelivered;
  }

  // Calculate current duration
  const now = new Date();
  const durationMs = now.getTime() - session.startTime.getTime();
  session.duration = Math.floor(durationMs / (1000 * 60));

  // Calculate average power if we have duration and energy
  if (session.duration > 0 && session.energyDelivered > 0) {
    session.averagePower = (session.energyDelivered / session.duration) * 60; // kW
  }

  // Update cost
  session.totalCost = await calculateCost(
    session.energyDelivered,
    session.stationId
  );

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
 * Get user's active session
 */
export async function getActiveSession(
  userId: string
): Promise<ChargingSessionType | null> {
  await connectToDatabase();

  const session = await ChargingSession.findOne({
    userId,
    status: "active",
  }).lean();

  if (!session) {
    return null;
  }

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
