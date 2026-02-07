import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin } from "lucide-react";

// Fix default marker icon issue with bundlers
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
});

const LOCATIONS = [
  {
    id: "sol_emmen",
    name: "SOL Emmen",
    address: "James Cookstraat 3, 7825 VR Emmen",
    lat: 52.7616,
    lng: 6.9397,
    description: "Gascilinders & Droogijsproductie",
  },
  {
    id: "sol_tilburg",
    name: "SOL Tilburg",
    address: "Tilburg",
    lat: 51.5555,
    lng: 5.0913,
    description: "Gascilinders",
  },
] as const;

interface LocationMapProps {
  location?: "sol_emmen" | "sol_tilburg" | "all";
  onSelectLocation?: (location: "sol_emmen" | "sol_tilburg") => void;
}

export function LocationMap({ location, onSelectLocation }: LocationMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [52.1, 5.9],
      zoom: 8,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    LOCATIONS.forEach((loc) => {
      const marker = L.marker([loc.lat, loc.lng]).addTo(map);
      marker.bindPopup(
        `<div style="min-width:160px">
          <strong>${loc.name}</strong><br/>
          <span style="font-size:12px;color:#666">${loc.address}</span><br/>
          <span style="font-size:11px;color:#888">${loc.description}</span>
        </div>`
      );
      marker.on("click", () => {
        onSelectLocation?.(loc.id as "sol_emmen" | "sol_tilburg");
      });
    });

    mapInstanceRef.current = map;

    // Force a resize after mount to prevent grey tiles
    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fly to selected location
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    if (location && location !== "all") {
      const loc = LOCATIONS.find((l) => l.id === location);
      if (loc) {
        map.flyTo([loc.lat, loc.lng], 15, { duration: 1.2 });
      }
    } else {
      // Fit both markers
      const bounds = L.latLngBounds(LOCATIONS.map((l) => [l.lat, l.lng]));
      map.flyToBounds(bounds, { padding: [50, 50], duration: 1.2 });
    }
  }, [location]);

  return (
    <Card className="glass-card w-full overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-primary" />
          Productielocaties
        </CardTitle>
        <CardDescription className="text-xs">
          Klik op een marker om naar de locatie te navigeren
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={mapContainerRef}
          className="w-full rounded-b-lg"
          style={{ height: 350 }}
        />
      </CardContent>
    </Card>
  );
}
