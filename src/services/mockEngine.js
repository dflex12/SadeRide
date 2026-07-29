// src/services/mockEngine.js

// --- Helper Utilities ---

// Haversine formula to calculate distance in kilometers between two GPS points
export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
  const R = 6371; // Earth's radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

// Simple polyline encoder algorithm for low-footprint route storage
export const encodePolyline = (points) => {
  return points
    .map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`)
    .join(";");
};

// --- Mock State Store ---

class MockEngineStore {
  constructor() {
    this.drivers = new Map();
    this.childrenRequests = new Map();
    this.notifications = [];
    this.routeChunks = new Map(); // Stores 15-min route logs per shift
  }

  // 1. Shift Time Verification
  isWithinShiftWindow(shiftSchedule) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const parseTime = (timeStr) => {
      const [h, m] = timeStr.split(":").map(Number);
      return h * 60 + m;
    };

    const inPickup =
      currentMinutes >= parseTime(shiftSchedule.pickupShift.start) &&
      currentMinutes <= parseTime(shiftSchedule.pickupShift.end);

    const inDropoff =
      currentMinutes >= parseTime(shiftSchedule.dropoffShift.start) &&
      currentMinutes <= parseTime(shiftSchedule.dropoffShift.end);

    return inPickup || inDropoff;
  }

  // 2. Driver Location Broadcast Engine with Auto-Disable
  updateDriverLocation(routeCode, currentCoords, estimatedSpeedKmH = 25) {
    const driver = this.drivers.get(routeCode);
    if (!driver) return { success: false, reason: "Driver not found" };

    // Enforce Strict Shift Window Check
    if (!this.isWithinShiftWindow(driver.shifts)) {
      driver.isOnline = false;
      this.addNotification({
        recipientId: driver.id,
        role: "driver",
        message: "🚫 Shift window ended. Live location tracking automatically disabled.",
        timestamp: new Date().toISOString()
      });
      return { success: false, reason: "OFF_SCHEDULE_AUTO_DISABLED" };
    }

    if (!driver.isOnline) {
      return { success: false, reason: "DRIVER_OFFLINE" };
    }

    // Update GPS Position
    driver.currentLocation = {
      ...currentCoords,
      lastUpdated: new Date().toISOString()
    };

    // Buffer point for 15-minute chunking
    this.bufferRoutePoint(routeCode, currentCoords);

    // Check Proximity to Approved Parent Pickup Locations
    this.checkParentProximityAlerts(routeCode, currentCoords, estimatedSpeedKmH);

    return { success: true, location: driver.currentLocation };
  }

  // 3. Proximity Engine: 10-Minute Parent Arrival Alert
  checkParentProximityAlerts(routeCode, driverCoords, speedKmH) {
    const approvedChildren = Array.from(this.childrenRequests.values()).filter(
      (req) => req.routeCode === routeCode && req.status === "approved"
    );

    approvedChildren.forEach((child) => {
      const distanceKm = calculateDistanceKm(
        driverCoords.lat,
        driverCoords.lng,
        child.homeLocation.lat,
        child.homeLocation.lng
      );

      // Estimated arrival time in minutes based on current vehicle speed
      const estimatedMinutesAway = (distanceKm / speedKmH) * 60;

      // Trigger notification if van is approximately 10 minutes away
      if (estimatedMinutesAway <= 10 && !child.notifiedForCurrentShift) {
        child.notifiedForCurrentShift = true;
        this.addNotification({
          recipientId: child.parentId,
          role: "parent",
          title: "🚐 Van Approaching!",
          message: `Van ${routeCode} is approximately 10 minutes away from your home to pick up ${child.childName}.`,
          timestamp: new Date().toISOString()
        });
      }
    });
  }

  // 4. 15-Minute Route Chunking Engine
  bufferRoutePoint(routeCode, coords) {
    if (!this.routeChunks.has(routeCode)) {
      this.routeChunks.set(routeCode, {
        points: [],
        lastFlushedAt: Date.now()
      });
    }

    const chunk = this.routeChunks.get(routeCode);
    chunk.points.push(coords);

    // Flush chunk to stored polylines every 15 minutes (900,000 ms)
    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    if (Date.now() - chunk.lastFlushedAt >= FIFTEEN_MINUTES) {
      const encoded = encodePolyline(chunk.points);
      console.log(`[ROUTE LOG SAVED] Route: ${routeCode} | Polyline: ${encoded}`);
      
      // Reset chunk buffer for the next 15-minute window
      chunk.points = [];
      chunk.lastFlushedAt = Date.now();
    }
  }

  addNotification(notification) {
    this.notifications.push(notification);
  }
}

export const mockEngine = new MockEngineStore();