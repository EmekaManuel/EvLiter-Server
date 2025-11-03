# Charging Session Flow

This document describes the complete lifecycle of a charging session from start to finish.

## Overview

A charging session goes through the following states:

1. **Active** - Session is currently in progress
2. **Completed** - Session ended normally
3. **Cancelled** - Session was cancelled before completion

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    CHARGING SESSION FLOW                     │
└─────────────────────────────────────────────────────────────┘

1. START SESSION
   ├─ POST /api/charging/sessions/start
   ├─ Validate: No existing active session
   ├─ Create session with status: "active"
   └─ Return session data

2. ACTIVE SESSION (Real-time Updates)
   ├─ Poll/Update every 30 seconds (recommended)
   ├─ PUT /api/charging/sessions/active/update
   ├─ Update: batteryLevel, energyDelivered
   ├─ Auto-calculate: duration, averagePower, totalCost
   └─ Continue until user stops or battery full

3. END SESSION
   ├─ POST /api/charging/sessions/end
   ├─ Validate: Active session exists
   ├─ Update: endTime, final batteryLevel, stationRating (optional)
   ├─ Calculate: final duration, energy, cost, averagePower
   ├─ Change status: "active" → "completed"
   └─ Return completed session data

4. VIEW HISTORY
   ├─ GET /api/charging/sessions?filter=all-time
   ├─ GET /api/charging/stats
   └─ GET /api/charging/dashboard (all data at once)
```

## Detailed Steps

### Step 1: Start Charging Session

**API Call:**

```http
POST /api/charging/sessions/start
Authorization: Bearer <token>
Content-Type: application/json

{
  "stationId": "evliter-lagos-victoria-island",
  "connectorId": "connector-1",
  "batteryLevelStart": 45
}
```

**What Happens:**

1. Server validates user has no active session
2. Server fetches station name from database
3. Creates new `ChargingSession` document with:
   - `status: "active"`
   - `startTime: now()`
   - `batteryLevel: batteryLevelStart`
   - `batteryLevelStart: batteryLevelStart`
   - `duration: 0`
   - `energyDelivered: 0`
   - `totalCost: 0`
   - `averagePower: 0`
4. Returns session data with generated `id`

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "session-id",
    "userId": "user-123",
    "stationId": "evliter-lagos-victoria-island",
    "stationName": "EvLiter Charging Hub - Victoria Island",
    "connectorId": "connector-1",
    "startTime": "2024-01-15T10:30:00.000Z",
    "duration": 0,
    "energyDelivered": 0,
    "totalCost": 0,
    "averagePower": 0,
    "batteryLevel": 45,
    "batteryLevelStart": 45,
    "status": "active"
  }
}
```

**Error Cases:**

- User already has active session → `400 Bad Request`
- Invalid stationId → Uses generic station name
- Missing batteryLevelStart → `400 Bad Request`

---

### Step 2: Real-time Updates During Charging

**API Call (Poll every 30 seconds):**

```http
PUT /api/charging/sessions/active/update
Authorization: Bearer <token>
Content-Type: application/json

{
  "batteryLevel": 52,
  "energyDelivered": 4.2
}
```

**What Happens:**

1. Server finds active session for user
2. Updates:
   - `batteryLevel` (required)
   - `energyDelivered` (optional, if provided by EV)
3. Auto-calculates:
   - `duration` = (now - startTime) in minutes
   - `averagePower` = (energyDelivered / duration) \* 60 kW
   - `totalCost` = energyDelivered \* pricePerKWh (from station)
4. Returns updated session data

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "session-id",
    "batteryLevel": 52,
    "energyDelivered": 4.2,
    "duration": 15,
    "averagePower": 16.8,
    "totalCost": 693,
    ...
  }
}
```

**Frontend Implementation:**

```typescript
// Start polling when session is active
let updateInterval: NodeJS.Timeout;

function startPolling(sessionId: string) {
  updateInterval = setInterval(async () => {
    try {
      // Get battery level from EV (your integration)
      const batteryLevel = await getBatteryLevelFromEV();
      const energyDelivered = await getEnergyDeliveredFromEV(); // optional

      const response = await fetch("/api/charging/sessions/active/update", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          batteryLevel,
          energyDelivered, // optional
        }),
      });

      const { data } = await response.json();
      // Update UI with new data
      updateChargingUI(data);
    } catch (error) {
      console.error("Failed to update session:", error);
    }
  }, 30000); // Every 30 seconds
}

function stopPolling() {
  if (updateInterval) {
    clearInterval(updateInterval);
  }
}
```

**Note:** If `energyDelivered` is not provided, the system will estimate it based on battery level changes when the session ends.

---

### Step 3: End Charging Session

**API Call:**

```http
POST /api/charging/sessions/end
Authorization: Bearer <token>
Content-Type: application/json

{
  "sessionId": "session-id",
  "batteryLevelEnd": 80,
  "stationRating": 5
}
```

**What Happens:**

1. Server validates session exists and is active
2. Sets `endTime: now()`
3. Updates `batteryLevel` to final value
4. If `energyDelivered` is still 0, estimates from battery increase:
   - `energyDelivered = (batteryLevelEnd - batteryLevelStart) / 100 * 60 kWh`
   - (Assumes 60 kWh battery capacity - adjust based on your EV models)
5. Calculates final values:
   - `duration` = (endTime - startTime) in minutes
   - `averagePower` = (energyDelivered / duration) \* 60 kW
   - `totalCost` = energyDelivered \* pricePerKWh
6. Updates `status: "completed"`
7. Sets `stationRating` if provided

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "session-id",
    "endTime": "2024-01-15T11:45:00.000Z",
    "duration": 75,
    "energyDelivered": 21.0,
    "totalCost": 3465,
    "averagePower": 16.8,
    "batteryLevel": 80,
    "status": "completed",
    "stationRating": 5,
    ...
  }
}
```

**Error Cases:**

- Session not found → `400 Bad Request`
- Session already completed → `400 Bad Request`
- Invalid sessionId → `400 Bad Request`

---

### Step 4: View Session History & Statistics

**Get All Sessions:**

```http
GET /api/charging/sessions?filter=all-time&limit=50&offset=0
Authorization: Bearer <token>
```

**Query Parameters:**

- `filter`: `"recent"` | `"this-month"` | `"all-time"` (default: `"all-time"`)
- `limit`: Number of sessions to return (max: 100, default: 50)
- `offset`: Pagination offset (default: 0)

**Get Active Session:**

```http
GET /api/charging/sessions/active
Authorization: Bearer <token>
```

**Get User Statistics:**

```http
GET /api/charging/stats
Authorization: Bearer <token>
```

**Get Dashboard Data (All at Once):**

```http
GET /api/charging/dashboard
Authorization: Bearer <token>
```

**Response:**

```json
{
  "sessions": [...],
  "stats": {
    "totalSessions": 25,
    "totalEnergyUsed": 450.5,
    "totalSpent": 74250,
    "averageSessionDuration": 45,
    "favoriteStation": "evliter-lagos-victoria-island",
    "monthlyUsage": [
      {
        "month": "2024-01",
        "sessions": 5,
        "energyUsed": 85.2,
        "totalSpent": 14058
      },
      ...
    ]
  },
  "activeSession": {
    "id": "current-session-id",
    "status": "active",
    ...
  }
}
```

---

## State Transitions

```
┌─────────┐
│  START  │
└────┬────┘
     │
     ▼
┌─────────────────┐
│  ACTIVE         │ ◄───┐
│  - Charging     │     │
│  - Updating     │     │
│  - Polling      │     │
└────┬────────────┘     │
     │                   │
     │ End/Cancel        │
     ▼                   │
┌─────────────────┐     │
│  COMPLETED       │     │
│  - Final values │     │
│  - Cost calc    │     │
│  - Rating saved │     │
└─────────────────┘     │
                        │
                        │
                   Update Active
                   (Real-time)
```

## Data Flow

### During Active Session:

```
EV Battery Data → Frontend → API Update → Database
                                      ↓
                              Auto-calculate:
                              - duration
                              - averagePower
                              - totalCost
```

### When Ending Session:

```
User Action → API End → Final Calculations → Status Change
                                      ↓
                              Calculate:
                              - final duration
                              - final energy
                              - final cost
                              - average power
```

## Best Practices

1. **Polling Frequency**: Update every 30 seconds during active session
2. **Error Handling**: Retry failed updates, handle network errors gracefully
3. **Battery Level**: Always provide accurate battery level from EV
4. **Energy Delivered**: Provide if available from EV, otherwise auto-estimated
5. **Session End**: Always call end session when user stops, don't leave sessions active
6. **Validation**: Check for active session before starting new one
7. **Cost Calculation**: Automatically calculated based on station pricing

## Frontend Integration Example

```typescript
class ChargingSessionManager {
  private updateInterval?: NodeJS.Timeout;
  private currentSession: ChargingSession | null = null;

  async startSession(
    stationId: string,
    connectorId: string,
    batteryLevel: number
  ) {
    // Check if already has active session
    const active = await this.getActiveSession();
    if (active) {
      throw new Error("Already has active session");
    }

    // Start new session
    const response = await fetch("/api/charging/sessions/start", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        stationId,
        connectorId,
        batteryLevelStart: batteryLevel,
      }),
    });

    const { data } = await response.json();
    this.currentSession = data;

    // Start polling for updates
    this.startPolling();

    return data;
  }

  private startPolling() {
    this.updateInterval = setInterval(async () => {
      if (!this.currentSession) return;

      try {
        const batteryLevel = await this.getBatteryFromEV();
        const energyDelivered = await this.getEnergyFromEV();

        const response = await fetch("/api/charging/sessions/active/update", {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            batteryLevel,
            energyDelivered,
          }),
        });

        const { data } = await response.json();
        this.currentSession = data;
        this.onUpdate(data);
      } catch (error) {
        console.error("Update failed:", error);
      }
    }, 30000);
  }

  async endSession(batteryLevel: number, rating?: number) {
    if (!this.currentSession) {
      throw new Error("No active session");
    }

    // Stop polling
    this.stopPolling();

    const response = await fetch("/api/charging/sessions/end", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sessionId: this.currentSession.id,
        batteryLevelEnd: batteryLevel,
        stationRating: rating,
      }),
    });

    const { data } = await response.json();
    this.currentSession = null;

    return data;
  }

  private stopPolling() {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = undefined;
    }
  }

  async getActiveSession() {
    const response = await fetch("/api/charging/sessions/active", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const { session } = await response.json();
    this.currentSession = session;
    return session;
  }

  // Placeholder methods - implement based on your EV integration
  private async getBatteryFromEV(): Promise<number> {
    // Connect to your EV API/sensor
    return 0;
  }

  private async getEnergyFromEV(): Promise<number | undefined> {
    // Connect to your EV API/sensor
    return undefined;
  }

  // Callback for UI updates
  private onUpdate(session: ChargingSession) {
    // Update your UI components
    console.log("Session updated:", session);
  }
}
```

## Error Handling

### Common Errors:

1. **Already has active session**

   - Error: `"User already has an active charging session"`
   - Solution: End existing session first, or show active session to user

2. **Session not found**

   - Error: `"Active charging session not found"`
   - Solution: Check if session exists, refresh session list

3. **Invalid battery level**

   - Error: Zod validation error
   - Solution: Ensure battery level is 0-100

4. **Network errors**
   - Solution: Implement retry logic, show user-friendly error messages

## Testing the Flow

1. Start a session: `POST /api/charging/sessions/start`
2. Update session: `PUT /api/charging/sessions/active/update` (multiple times)
3. End session: `POST /api/charging/sessions/end`
4. View history: `GET /api/charging/sessions`
5. View stats: `GET /api/charging/stats`
