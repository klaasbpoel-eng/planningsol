import "leaflet/dist/leaflet.css";
import React, { useEffect, useRef } from "react";
import L from "leaflet";
import { GeoPoint, DayAssignment } from "./types";
import { effectiveDepot, getZone, ZONE_COLORS, DAY_FULL } from "./utils";

interface RouteMapProps {
  points: GeoPoint[];
  dayAssignments: Map<string, DayAssignment>;
  routes?: { color: string; coords: [number, number][] }[];
}

export function RouteMap({ points, dayAssignments, routes }: RouteMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<L.Map | null>(null);
  const markersRef   = useRef<L.CircleMarker[]>([]);
  const linesRef     = useRef<L.Polyline[]>([]);

  // Init map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [52.3, 5.3], zoom: 7 });
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
      subdomains: "abcd",
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    setTimeout(() => map.invalidateSize(), 200);
    return () => {
      map.remove();
      mapRef.current = null;
      markersRef.current = [];
      linesRef.current = [];
    };
  }, []);

  // Update markers + route polylines when data changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];
    // Clear old lines
    linesRef.current.forEach(l => l.remove());
    linesRef.current = [];

    // Draw route polylines first (underneath markers)
    if (routes) {
      for (const route of routes) {
        if (route.coords.length < 2) continue;
        const line = L.polyline(route.coords, {
          color: route.color, weight: 2.5, opacity: 0.55, dashArray: "6, 4",
        }).addTo(map);
        linesRef.current.push(line);
      }
    }

    // Draw markers
    for (const { customer: c, lat, lng } of points) {
      const effZ = getZone(c.province, c.city, effectiveDepot(c, dayAssignments), c.zip);
      const zCol = ZONE_COLORS[effZ.short] ?? ZONE_COLORS.F;
      const asg  = dayAssignments.get(c.key);
      const isUrgent = asg?.urgent ?? false;
      const marker = L.circleMarker([lat, lng], {
        radius:      c.vehicleType !== "truck" ? 5 : 7,
        color:       isUrgent ? "#ef4444" : zCol.stroke,
        fillColor:   isUrgent ? "#ef4444" : zCol.stroke,
        fillOpacity: 0.65,
        weight:      isUrgent ? 3 : (c.vehicleType !== "truck" ? 1 : 2),
      });
      const tw = asg?.time_window_start && asg?.time_window_end
        ? `<br/><span style='color:#2563eb'>&#x23F0; ${asg.time_window_start.slice(0,5)}–${asg.time_window_end.slice(0,5)}</span>`
        : "";
      marker.bindPopup(
        `<div style="font-size:13px;line-height:1.6">
          ${isUrgent ? "<span style='color:#ef4444;font-weight:bold'>&#x26A0; URGENT</span><br/>" : ""}
          <strong>${c.name}</strong><br/>
          ${c.city} ${c.zip} &middot; Zone ${effZ.short}<br/>
          ${c.perWeek >= 1 ? `${c.perWeek.toFixed(1)}&times;/week` : "~1&times; per maand"}
          ${c.vehicleType !== "truck" ? "<br/><span style='color:#e11d48'>&#x1F3E5; Koerier (medisch)</span>" : ""}
          ${asg?.preferred_day ? `<br/><span style='color:#16a34a'>&#x1F4C5; Vaste dag: ${DAY_FULL[asg.preferred_day]}</span>` : ""}
          ${tw}
        </div>`
      );
      marker.addTo(map);
      markersRef.current.push(marker);
    }
  }, [points, dayAssignments, routes]);

  return (
    <div
      ref={containerRef}
      style={{ height: "600px" }}
      className="w-full rounded-lg border shadow-sm z-0"
    />
  );
}
