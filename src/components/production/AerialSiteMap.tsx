import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MapPin } from "lucide-react";

export function AerialSiteMap() {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [52.7616, 6.9397],
      zoom: 18,
      minZoom: 17,
      maxZoom: 19,
      maxBounds: [
        [52.759, 6.936],
        [52.764, 6.943],
      ],
      maxBoundsViscosity: 1.0,
      scrollWheelZoom: true,
      zoomControl: true,
    });

    L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri",
        maxZoom: 19,
      }
    ).addTo(map);

    // Add a marker for the location
    L.marker([52.7616, 6.9397]).addTo(map).bindPopup(
      `<div style="min-width:160px">
        <strong>SOL Emmen</strong><br/>
        <span style="font-size:12px;color:#666">James Cookstraat 3, 7825 VR Emmen</span><br/>
        <span style="font-size:11px;color:#888">Gascilinders & Droogijsproductie</span>
      </div>`
    );

    mapInstanceRef.current = map;

    setTimeout(() => map.invalidateSize(), 200);

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  return (
    <Card className="glass-card w-full overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4 text-primary" />
          Luchtfoto – James Cookstraat 3, Emmen
        </CardTitle>
        <CardDescription className="text-xs">
          Satellietbeeld van het productieterrein SOL Emmen
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div
          ref={mapContainerRef}
          className="w-full rounded-b-lg"
          style={{ height: 500 }}
        />
      </CardContent>
    </Card>
  );
}
