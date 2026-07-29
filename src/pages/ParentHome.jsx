// src/pages/ParentHome.jsx
import React, { useState, useEffect } from "react";
import { mockEngine, calculateDistanceKm } from "../services/mockEngine";
import { ParentMapCard } from "../components/ParentMapCard";

export const ParentHome = ({ parentUserId = "PARENT-99" }) => {
  // ---------------------------------------------------------------------------
  // 1. MOCK ENGINE BACKEND SUBSCRIPTION & DATA BINDING
  // ---------------------------------------------------------------------------
  const [parentProfile, setParentProfile] = useState(null);
  const [activeChild, setActiveChild] = useState(null);
  const [driverData, setDriverData] = useState(null);
  const [proximityAlert, setProximityAlert] = useState(null);
  const [tripStatus, setTripStatus] = useState("OFFLINE"); // 'OFFLINE' | 'PICKUP_ACTIVE' | 'DROPOFF_ACTIVE' | 'ARRIVED'
  const [distanceKm, setDistanceKm] = useState(null);
  const [etaMinutes, setEtaMinutes] = useState(null);
  const [shiftLogs, setShiftLogs] = useState([]);

  // Load initial Parent & Child payload from Mock Engine Store
  useEffect(() => {
    // Setup initial state in mock engine for demonstration
    const childId = "CHILD-101";
    const routeCode = "VAN-102";

    // Inject active child request state into mock engine if not present
    if (!mockEngine.childrenRequests.has(childId)) {
      mockEngine.childrenRequests.set(childId, {
        requestId: childId,
        parentId: parentUserId,
        childName: "Aarav Sharma",
        schoolName: "Delhi Public School, Adajan",
        photoUrl: "https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&q=80&w=200",
        routeCode: routeCode,
        status: "approved",
        homeLocation: { lat: 21.1702, lng: 72.8311 }, // Surat Adajan home coordinates
        notifiedForCurrentShift: false
      });
    }

    // Inject driver mock state with Indian Dual Shift Schedule
    if (!mockEngine.drivers.has(routeCode)) {
      mockEngine.drivers.set(routeCode, {
        id: "DRV-501",
        name: "Ramesh Patel",
        phone: "+919825012345",
        vehicleNumber: "GJ-05-BX-4921",
        routeCode: routeCode,
        isOnline: true,
        shifts: {
          pickupShift: { start: "06:00", end: "09:00" },  // Morning pickup window 🌅
          dropoffShift: { start: "12:00", end: "15:00" }  // Afternoon drop window 🌆
        },
        currentLocation: { lat: 21.1820, lng: 72.8250, lastUpdated: new Date().toISOString() }
      });
    }

    const child = mockEngine.childrenRequests.get(childId);
    const driver = mockEngine.drivers.get(routeCode);

    setActiveChild(child);
    setDriverData(driver);
    setParentProfile({ id: parentUserId, name: "Sanjay Sharma", phone: "+919876543210" });
  }, [parentUserId]);

  // Realtime Polling Loop: Subscribes directly to Mock Engine Core State
  useEffect(() => {
    if (!activeChild || !driverData) return;

    const interval = setInterval(() => {
      const currentDriver = mockEngine.drivers.get(activeChild.routeCode);
      if (!currentDriver) return;

      // Check shift window enforcement
      const isShiftActive = mockEngine.isWithinShiftWindow(currentDriver.shifts);

      if (!isShiftActive || !currentDriver.isOnline) {
        setTripStatus("OFFLINE");
      } else {
        // Determine whether currently in Pickup or Dropoff window
        const now = new Date();
        const hour = now.getHours();
        setTripStatus(hour < 12 ? "PICKUP_ACTIVE" : "DROPOFF_ACTIVE");
      }

      // Calculate distance & live ETA between Van and Home
      if (currentDriver.currentLocation && activeChild.homeLocation) {
        const dist = calculateDistanceKm(
          currentDriver.currentLocation.lat,
          currentDriver.currentLocation.lng,
          activeChild.homeLocation.lat,
          activeChild.homeLocation.lng
        );
        setDistanceKm(dist.toFixed(2));

        // Speed assumption: 25 km/h urban traffic average
        const estMinutes = Math.round((dist / 25) * 60);
        setEtaMinutes(estMinutes);

        // Check Mock Engine for notifications tied to this parent
        const latestNotif = mockEngine.notifications.find(
          (n) => n.recipientId === parentUserId && n.role === "parent"
        );
        if (latestNotif) setProximityAlert(latestNotif);
      }

      // Fetch 15-minute compressed route logs
      const chunkData = mockEngine.routeChunks.get(activeChild.routeCode);
      if (chunkData) {
        setShiftLogs(chunkData.points);
      }

      setDriverData({ ...currentDriver });
    }, 2000); // 2-second heartbeat loop

    return () => clearInterval(interval);
  }, [activeChild, driverData, parentUserId]);

  if (!activeChild || !driverData) {
    return (
      <div className="flex h-screen items-center justify-center bg-amber-50">
        <div className="text-center font-medium text-amber-800 animate-pulse">
          ⚡ Initializing Live Engine & Syncing Child Profile...
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // 2. UI RENDER (CHILD STATUS & DRIVER CONTACT PANEL)
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6 pb-20">
      <div className="mx-auto max-w-lg space-y-4">

        {/* --- BRAND HEADER --- */}
        <div className="flex items-center justify-between rounded-2xl bg-gradient-to-r from-orange-500 to-amber-500 p-4 text-white shadow-lg">
          <div>
            <p className="text-xs font-semibold tracking-wider text-orange-100 uppercase">
              Child Safety System 🛡️
            </p>
            <h1 className="text-xl font-bold">Suraksha Transport</h1>
          </div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-medium text-white backdrop-blur-md">
            Role: Parent 👨‍👩‍👧
          </span>
        </div>

        {/* --- PROXIMITY ALERT BANNER (IF WITHIN 10 MINS) --- */}
        {proximityAlert && (
          <div className="animate-bounce rounded-2xl border-2 border-orange-400 bg-orange-100 p-4 shadow-md">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🚐</span>
              <div>
                <h3 className="font-bold text-orange-900">{proximityAlert.title}</h3>
                <p className="text-xs text-orange-800">{proximityAlert.message}</p>
                <span className="mt-1 inline-block text-[10px] text-orange-600">
                  Triggered at {new Date(proximityAlert.timestamp).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* --- CHILD STATUS PANEL --- */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-3">
              <img
                src={activeChild.photoUrl}
                alt={activeChild.childName}
                className="h-12 w-12 rounded-full border-2 border-amber-400 object-cover shadow-sm"
              />
              <div>
                <h2 className="text-base font-bold text-slate-800">{activeChild.childName}</h2>
                <p className="text-xs text-slate-500">🏫 {activeChild.schoolName}</p>
              </div>
            </div>

            {/* Dynamic Shift Badge */}
            <div className="text-right">
              {tripStatus === "OFFLINE" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                  <span className="h-2 w-2 rounded-full bg-slate-400"></span> Offline
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-700 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-emerald-500"></span> Live Tracking
                </span>
              )}
            </div>
          </div>

          {/* Realtime Distance & ETA Readouts */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 p-2.5 border border-slate-100">
              <span className="text-[11px] font-medium text-slate-500 uppercase">Distance To Home</span>
              <p className="text-base font-extrabold text-slate-800">
                {distanceKm ? `${distanceKm} km` : "--"}
              </p>
            </div>
            <div className="rounded-xl bg-orange-50 p-2.5 border border-orange-100">
              <span className="text-[11px] font-semibold text-orange-600 uppercase">Estimated Arrival</span>
              <p className="text-base font-extrabold text-orange-700">
                {etaMinutes !== null ? `~${etaMinutes} mins` : "--"}
              </p>
            </div>
          </div>
        </div>

        {/* --- LIVE GOOGLE MAP MINI-VIEWPORT --- */}
        <ParentMapCard
          routeCode={activeChild.routeCode}
          homeLocation={activeChild.homeLocation}
          schoolName={activeChild.schoolName}
        />

        {/* --- DRIVER CONTACT & VERIFICATION PANEL --- */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Assigned Driver & Vehicle</h3>
            <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
              {driverData.routeCode}
            </span>
          </div>

          <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-100">
            <div>
              <p className="font-bold text-slate-800 text-sm">{driverData.name}</p>
              <p className="text-xs font-semibold text-slate-500">🚘 Vehicle: {driverData.vehicleNumber}</p>
              <p className="mt-1 text-[10px] font-medium text-emerald-600">
                ✅ Pre-Verified Identity & Route Approval
              </p>
            </div>

            {/* Direct Phone Verification Action Call Button */}
            <a
              href={`tel:${driverData.phone}`}
              className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-95 transition"
            >
              📞 Call Driver
            </a>
          </div>

          {/* Safety Identity Confirmation Note */}
          <div className="mt-2 rounded-lg bg-amber-50 p-2 border border-amber-200 text-[11px] text-amber-800">
            ⚠️ <strong>Safety Protocol:</strong> Always confirm driver identity over phone if a substitute driver or vehicle appears for dropoff.
          </div>
        </div>

        {/* --- 15-MINUTE ROUTE HISTORY CHUNKS LOG --- */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 mb-2">15-Min Compressed Route Logs</h3>
          <div className="max-h-28 overflow-y-auto rounded-xl bg-slate-900 p-3 text-[11px] font-mono text-emerald-400">
            {shiftLogs.length > 0 ? (
              <div>
                <p className="text-slate-400">// Current Shift Polyline Points ({shiftLogs.length} logged):</p>
                <p className="break-all mt-1">
                  {shiftLogs.slice(-5).map((p) => `[${p.lat.toFixed(4)},${p.lng.toFixed(4)}]`).join(" -> ")}
                </p>
              </div>
            ) : (
              <p className="text-slate-500">// Waiting for next 15-minute chunk flush from vehicle...</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};