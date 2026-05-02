import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { CustomerHotspot, ChurnRisk } from "@/hooks/useGasFlowPredictor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { AlertTriangle, Clock, UserRound, TrendingDown, ChevronDown, ChevronUp } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Fix leaflet default icon issue in React
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
});

const redIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

const defaultIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// Simple hardcoded geocoder for Dutch cities to make the demo map lively
const DICT_COORDS: Record<string, [number, number]> = {
  'amsterdam': [52.3676, 4.9041], 'rotterdam': [51.9225, 4.4791], 'den haag': [52.0705, 4.3007],
  'utrecht': [52.0907, 5.1214], 'eindhoven': [51.4416, 5.4697], 'groningen': [53.2194, 6.5665],
  'tilburg': [51.5555, 5.0913], 'almere': [52.3702, 5.2141], 'breda': [51.5719, 4.7683],
  'nijmegen': [51.8126, 5.8372], 'arnhem': [51.9851, 5.8987], 'apeldoorn': [52.2112, 5.9699],
  'enschede': [52.2215, 6.8936], 'haarlem': [52.3874, 4.6462], 'amersfoort': [52.1561, 5.3878],
  'zwolle': [52.5168, 6.0830], 'zoetermeer': [52.0607, 4.4940], 'leiden': [52.1601, 4.4970],
  'maastricht': [50.8514, 5.6910], 'dordrecht': [51.8133, 4.6900], 'ede': [52.0402, 5.6696],
};

function getGeo(city: string): [number, number] {
  const norm = city.trim().toLowerCase();
  for (const [key, value] of Object.entries(DICT_COORDS)) {
    if (norm.includes(key)) return value;
  }
  // Fallback: dummy scatter around central NL (Utrecht)
  return [52.09 + (city.length % 10) * 0.05 - 0.25, 5.12 + (city.charCodeAt(0) % 10) * 0.08 - 0.4];
}

export function GasFlowLogisticsTab({ data, isLoading, error }: { data: any, isLoading: boolean, error: any }) {
  const [selectedDriver, setSelectedDriver] = useState<string>("Alle");
  const [showChurn, setShowChurn] = useState(false);

  const allHotspots = useMemo(
    () => (!isLoading && !error ? (data?.hotspots || []) : []) as CustomerHotspot[],
    [data, isLoading, error]
  );

  const churnRisks = useMemo(
    () => (!isLoading && !error ? (data?.churnRisks || []) : []) as ChurnRisk[],
    [data, isLoading, error]
  );

  // Extract unique drivers
  const uniqueDrivers = useMemo(() => {
    const drivers = new Set<string>();
    allHotspots.forEach(h => {
       if (h.driver && h.driver !== 'Onbekend') drivers.add(h.driver);
    });
    return Array.from(drivers).sort();
  }, [allHotspots]);

  const filteredHotspots = useMemo(() => {
    return allHotspots.filter(h => {
       if (selectedDriver === "Alle") return true;
       return h.driver === selectedDriver;
    });
  }, [allHotspots, selectedDriver]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-[400px] w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (error) return <div>Fout bij het laden van logistiek...</div>;

  if (allHotspots.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="pt-10 pb-10 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <p className="font-medium">Geen actieve ritten in de komende 7–10 dagen.</p>
            <p className="text-sm text-center max-w-md">
              Alle bekende klanten hebben hun laatste levering meer dan 2× hun normale interval geleden ontvangen,
              of er zijn geen recente Afname-gegevens beschikbaar.
              Controleer of de Afname-tabel actuele data bevat.
            </p>
          </CardContent>
        </Card>
        {churnRisks.length > 0 && (
          <Card className="border-red-500/20 bg-red-500/5">
            <CardHeader className="flex flex-row items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-2 min-w-0">
                <TrendingDown className="w-5 h-5 text-red-500 shrink-0" />
                <div className="min-w-0">
                  <CardTitle className="text-red-700 text-base">Klant Churn Risico</CardTitle>
                  <CardDescription className="text-red-600/70 text-xs">
                    {churnRisks.filter(c => c.riskLevel === 'Hoog').length} hoog risico ·{' '}
                    {churnRisks.filter(c => c.riskLevel === 'Middel').length} middel risico —
                    klanten met regelmatig patroon die gestopt zijn met bestellen.
                  </CardDescription>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChurn(v => !v)}
                className="gap-2 shrink-0 border-red-200 text-red-700 hover:bg-red-50"
              >
                {showChurn
                  ? <><ChevronUp className="h-4 w-4" /> Verberg</>
                  : <><ChevronDown className="h-4 w-4" /> Toon {churnRisks.length} klanten</>
                }
              </Button>
            </CardHeader>
            {showChurn && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                  {churnRisks.map((c, i) => (
                    <div
                      key={i}
                      className={`rounded-lg border p-3 bg-background ${
                        c.riskLevel === 'Hoog'
                          ? 'border-red-200 border-l-4 border-l-red-500'
                          : 'border-orange-200 border-l-4 border-l-orange-400'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2 mb-1">
                        <h4 className="font-semibold text-sm line-clamp-1 truncate" title={c.customerName}>
                          {c.customerName}
                        </h4>
                        <Badge
                          variant={c.riskLevel === 'Hoog' ? 'destructive' : 'secondary'}
                          className={`text-[10px] h-5 shrink-0 ${c.riskLevel === 'Middel' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' : ''}`}
                        >
                          {c.riskLevel}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">{c.city}</p>
                      <div className="flex flex-wrap gap-1 mb-2">
                        {c.products.slice(0, 3).map(p => (
                          <Badge key={p} variant="outline" className="text-[10px] py-0">{p}</Badge>
                        ))}
                        {c.products.length > 3 && (
                          <Badge variant="outline" className="text-[10px] py-0">+{c.products.length - 3}</Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-[11px] text-muted-foreground">
                        <div className="flex justify-between">
                          <span>Laatste levering</span>
                          <span className="font-medium text-foreground">
                            {format(c.lastDeliveryDate, 'dd MMM yyyy', { locale: nl })}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Normaal interval</span>
                          <span className="font-medium text-foreground">~{c.avgInterval}d</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Te laat</span>
                          <span className={`font-semibold ${c.riskLevel === 'Hoog' ? 'text-red-600' : 'text-orange-600'}`}>
                            +{c.overdueBy} dagen
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Gem. per levering</span>
                          <span className="font-medium text-foreground">{c.avgCylindersPerDelivery} st</span>
                        </div>
                      </div>
                      {c.driver && (
                        <div className="mt-2 pt-2 border-t border-border/50">
                          <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">
                            <UserRound className="w-3 h-3 mr-1" />{c.driver}
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <Card className="lg:col-span-1 border-primary/20 flex flex-col h-[600px]">
        <CardHeader className="bg-muted/30 pb-4 border-b shrink-0">
          <div className="flex justify-between items-start gap-4">
            <div>
              <CardTitle className="text-lg">Route Hotspots</CardTitle>
              <CardDescription>Klanten die binnenkort zonder vallen.</CardDescription>
            </div>
          </div>
          {uniqueDrivers.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <UserRound className="w-4 h-4 text-muted-foreground shrink-0"/>
              <Select value={selectedDriver} onValueChange={setSelectedDriver}>
                <SelectTrigger className="h-8 text-xs bg-background">
                  <SelectValue placeholder="Filter op Chauffeur" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Alle">Alle Chauffeurs</SelectItem>
                  {uniqueDrivers.map(d => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0 overflow-y-auto flex-1 h-full min-h-0">
          {filteredHotspots.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
               Geen routes gevonden voor {selectedDriver}.
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {filteredHotspots.map((h, i) => (
                <div key={i} className={`p-4 hover:bg-muted/50 transition-colors ${h.urgency === 'Kritiek' ? 'border-l-4 border-l-red-500' : 'border-l-4 border-l-yellow-500'}`}>
                  <div className="flex justify-between items-start mb-1 gap-2">
                    <h4 className="font-semibold text-sm line-clamp-1 truncate" title={h.customerName}>{h.customerName}</h4>
                    <Badge variant={h.urgency === 'Kritiek' ? 'destructive' : 'secondary'} className="text-[10px] h-5 shrink-0">
                      {h.urgency === 'Kritiek' ? '7 Dagen' : '10 Dagen'}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-medium mb-3">{h.city}</p>
                  
                  <div className="flex flex-wrap gap-1 mb-2">
                    {h.products.map(p => (
                      <Badge key={p} variant="outline" className="text-[10px] py-0">{p}</Badge>
                    ))}
                  </div>

                  <div className="flex justify-between items-center mt-3 gap-2">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background rounded p-1.5 border border-border/50 w-max shrink-0">
                      {h.urgency === 'Kritiek' ? <AlertTriangle className="w-3 h-3 text-red-500" /> : <Clock className="w-3 h-3 text-yellow-500" />}
                      <span>Leeg op: <strong className="text-foreground">{format(h.nextDeliveryDate, 'EEEE d MMM', { locale: nl })}</strong></span>
                    </div>

                    {h.driver && h.driver !== 'Onbekend' && (
                      <Badge variant="secondary" className="text-[10px] font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center gap-1">
                         <UserRound className="w-3 h-3"/> {h.driver}
                      </Badge>
                    )}
                  </div>
                  {h.avgInterval > 0 && (
                    <div className="mt-1.5 text-[10px] text-muted-foreground/70 flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" /> Omlooptijd ~{h.avgInterval}d
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      
      <Card className="lg:col-span-2 overflow-hidden flex flex-col h-[600px]">
        <div className="flex-1 w-full bg-slate-100 h-full relative z-0">
           <MapContainer 
             center={[52.1326, 5.2913]} // Center of Netherlands
             zoom={7} 
             scrollWheelZoom={true} 
             style={{ height: '100%', width: '100%', zIndex: 0 }}
           >
             <TileLayer
               attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
               url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
             />
             
             {filteredHotspots.map((spot, i) => {
               const pos = getGeo(spot.city);
               return (
                 <Marker key={i} position={pos} icon={spot.urgency === 'Kritiek' ? redIcon : defaultIcon}>
                   <Popup>
                     <div className="p-1">
                       <strong className="block mb-1 text-sm">{spot.customerName} ({spot.city})</strong>
                       <span className="text-xs text-muted-foreground block mb-2">{spot.products.join(', ')}</span>
                       <Badge variant={spot.urgency === 'Kritiek' ? 'destructive' : 'secondary'}>
                         Vul-datum: {format(spot.nextDeliveryDate, 'dd-MM-yyyy')}
                       </Badge>
                       {spot.driver && spot.driver !== 'Onbekend' && (
                         <span className="block mt-2 text-xs font-semibold text-blue-600">
                            Chauffeur: {spot.driver}
                         </span>
                       )}
                     </div>
                   </Popup>
                 </Marker>
               )
             })}
           </MapContainer>
        </div>
      </Card>
    </div>

    {/* Churn Risico sectie */}
    {churnRisks.length > 0 && (
      <Card className="border-red-500/20 bg-red-500/5">
        <CardHeader className="flex flex-row items-center justify-between gap-4 py-4">
          <div className="flex items-center gap-2 min-w-0">
            <TrendingDown className="w-5 h-5 text-red-500 shrink-0" />
            <div className="min-w-0">
              <CardTitle className="text-red-700 text-base">Klant Churn Risico</CardTitle>
              <CardDescription className="text-red-600/70 text-xs">
                {churnRisks.filter(c => c.riskLevel === 'Hoog').length} hoog risico ·{' '}
                {churnRisks.filter(c => c.riskLevel === 'Middel').length} middel risico —
                klanten met regelmatig patroon die gestopt zijn met bestellen.
              </CardDescription>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowChurn(v => !v)}
            className="gap-2 shrink-0 border-red-200 text-red-700 hover:bg-red-50"
          >
            {showChurn
              ? <><ChevronUp className="h-4 w-4" /> Verberg</>
              : <><ChevronDown className="h-4 w-4" /> Toon {churnRisks.length} klanten</>
            }
          </Button>
        </CardHeader>

        {showChurn && (
          <CardContent className="pt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {churnRisks.map((c, i) => (
                <div
                  key={i}
                  className={`rounded-lg border p-3 bg-background ${
                    c.riskLevel === 'Hoog'
                      ? 'border-red-200 border-l-4 border-l-red-500'
                      : 'border-orange-200 border-l-4 border-l-orange-400'
                  }`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h4 className="font-semibold text-sm line-clamp-1 truncate" title={c.customerName}>
                      {c.customerName}
                    </h4>
                    <Badge
                      variant={c.riskLevel === 'Hoog' ? 'destructive' : 'secondary'}
                      className={`text-[10px] h-5 shrink-0 ${c.riskLevel === 'Middel' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100' : ''}`}
                    >
                      {c.riskLevel}
                    </Badge>
                  </div>

                  <p className="text-xs text-muted-foreground mb-2">{c.city}</p>

                  <div className="flex flex-wrap gap-1 mb-2">
                    {c.products.slice(0, 3).map(p => (
                      <Badge key={p} variant="outline" className="text-[10px] py-0">{p}</Badge>
                    ))}
                    {c.products.length > 3 && (
                      <Badge variant="outline" className="text-[10px] py-0">+{c.products.length - 3}</Badge>
                    )}
                  </div>

                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>Laatste levering</span>
                      <span className="font-medium text-foreground">
                        {format(c.lastDeliveryDate, 'dd MMM yyyy', { locale: nl })}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Normaal interval</span>
                      <span className="font-medium text-foreground">~{c.avgInterval}d</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Te laat</span>
                      <span className={`font-semibold ${c.riskLevel === 'Hoog' ? 'text-red-600' : 'text-orange-600'}`}>
                        +{c.overdueBy} dagen
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Gem. per levering</span>
                      <span className="font-medium text-foreground">{c.avgCylindersPerDelivery} st</span>
                    </div>
                  </div>

                  {c.driver && (
                    <div className="mt-2 pt-2 border-t border-border/50">
                      <Badge variant="secondary" className="text-[10px] bg-blue-50 text-blue-700">
                        <UserRound className="w-3 h-3 mr-1" />{c.driver}
                      </Badge>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>
    )}
    </div>
  );
}
