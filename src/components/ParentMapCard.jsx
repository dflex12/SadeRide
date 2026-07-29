// src/components/ParentMapCard.jsx
import React, { useEffect, useRef, useState } from "react";
import { mockEngine } from "../services/mockEngine";

export const ParentMapCard = ({ routeCode, homeLocation, schoolName }) => {
  const mapRef = useRef(null);
  const [mapInstance, setMapInstance] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [vanMarker, setVanMarker] = useState(null);
  const [mapType, setMapType] = useState("roadmap"); // 'roadmap' | 'hybrid' (satellite)
  const [showTraffic, setShowTraffic] = useState(true);
  const [trafficLayer, setTrafficLayer] = useState(null);
  const [etaText, setEtaText] = useState("Calculating...");

  // 1. Load Google Maps JS API script dynamically
  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

    if (!window.google && apiKey) {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,directions`;
      script.async = true;
      script.onload = () => initMap();
      document.head.appendChild(script);
    } else if (window.google) {
      initMap();
    }
  }, []);

  // 2. Initialize Map Canvas
  const initMap = () => {
    if (!mapRef.current || mapInstance) return;

    const map = new window.google.maps.Map(mapRef.current, {
      center: homeLocation || { lat: 21.1702, lng: 72.8311 }, // Default coordinates
      zoom: 14,
      mapTypeId: mapType,
      disableDefaultUI: true, // Clean mini-map appearance
      zoomControl: true,
    });

    const renderer = new window.google.maps.DirectionsRenderer({
      map: map,
      suppressMarkers: false,
      polylineOptions: {
        strokeColor: "#F97316", // Light orange route color 🧡
        strokeWeight: 5,
      },
    });

    // Create Live Traffic Layer
    const traffic = new window.google.maps.TrafficLayer();
    if (showTraffic) traffic.setMap(map);

    setMapInstance(map);
    setDirectionsRenderer(renderer);
    setTrafficLayer(traffic);
  };

  // 3. Dynamic Rerouting Engine (Van Current Location ➔ School)
  const updateRouteAndEta = (vanCoords) => {
    if (!window.google || !directionsRenderer) return;

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: vanCoords, // Dynamic starting point: Live Van Position 🚐
        destination: `${schoolName}, Surat, Gujarat`, // Destination: School 🏫
        travelMode: window.google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: "bestguess",
        },
      },
      (result, status) => {
        if (status === "OK") {
          directionsRenderer.setDirections(result);

          // Extract real-time duration considering live traffic 🚦
          const leg = result.routes[0].legs[0];
          setEtaText(leg.duration_in_traffic ? leg.duration_in_traffic.text : leg.duration.text);
        }
      }
    );
  };

  // 4. Live Driver Position Subscription
  useEffect(() => {
    const interval = setInterval(() => {
      const driverData = mockEngine.drivers.get(routeCode);

      if (driverData && driverData.currentLocation && mapInstance) {
        const coords = driverData.currentLocation;

        // Update or create moving Van Marker
        if (!vanMarker) {
          const marker = new window.google.maps.Marker({
            position: coords,
            map: mapInstance,
            title: `Van ${routeCode}`,
            icon: {
              url: "https://cdn-icons-png.flaticon.com/512/1048/1048314.png", // Van Icon 🚐
              scaledSize: new window.google.maps.Size(36, 36),
            },
          });
          setVanMarker(marker);
        } else {
          vanMarker.setPosition(coords);
        }

        // Recalculate dynamic route line to school
        updateRouteAndEta(coords);
      }
    }, 3000); // Polls location updates every 3 seconds

    return () => clearInterval(interval);
  }, [mapInstance, vanMarker, routeCode]);

  // Toggle Satellite View
  const toggleMapType = () => {
    const newType = mapType === "roadmap" ? "hybrid" : "roadmap";
    setMapType(newType);
    if (mapInstance) mapInstance.setMapTypeId(newType);
  };

  // Toggle Live Traffic Overlay
  const toggleTraffic = () => {
    const nextState = !showTraffic;
    setShowTraffic(nextState);
    if (trafficLayer) trafficLayer.setMap(nextState ? mapInstance : null);
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-md">
      {/* Header Info Bar */}
      <div className="mb-2 flex items-center justify-between">
        <div>
          <span className="text-xs text-gray-500">Live Van Route</span>
          <h4 className="font-bold text-gray-800">Van Code: {routeCode}</h4>
        </div>
        <div className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
          ⏱️ ETA: {etaText}
        </div>
      </div>

      {/* Mini-Map Canvas Box */}
      <div className="relative h-60 w-full overflow-hidden rounded-xl border">
        <div ref={mapRef} className="h-full w-full" />

        {/* Floating Map Controls */}
        <div className="absolute top-2 right-2 flex gap-1">
          <button
            onClick={toggleMapType}
            className="rounded-md bg-white/90 px-2 py-1 text-xs font-medium shadow hover:bg-white"
          >
            {mapType === "roadmap" ? "🛰️ Satellite" : "🗺️ Map"}
          </button>
          <button
            onClick={toggleTraffic}
            className={`rounded-md px-2 py-1 text-xs font-medium shadow ${
              showTraffic ? "bg-red-500 text-white" : "bg-white/90 text-gray-700"
            }`}
          >
            🚦 Traffic
          </button>
        </div>
      </div>

      <p className="mt-2 text-center text-xs text-gray-500">
        📍 Dynamic route automatically recalculates as the van travels toward target school.
      </p>
    </div>
  );
};