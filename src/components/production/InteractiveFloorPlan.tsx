import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MapPin, ZoomIn, ZoomOut, Move, Maximize2, Minimize2, Info } from "lucide-react";
import { cn } from "@/lib/utils";

// Zone types with colors
const ZONE_TYPES = {
  vulstation: { label: "Vulstation", color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.15)", border: "hsl(var(--primary) / 0.4)" },
  opslag_gas: { label: "Gasopslag", color: "hsl(200 80% 50%)", bg: "hsl(200 80% 50% / 0.12)", border: "hsl(200 80% 50% / 0.4)" },
  opslag_droogijs: { label: "Droogijs", color: "hsl(190 90% 45%)", bg: "hsl(190 90% 45% / 0.12)", border: "hsl(190 90% 45% / 0.4)" },
  opslag_bulk: { label: "Bulkopslag", color: "hsl(280 60% 55%)", bg: "hsl(280 60% 55% / 0.12)", border: "hsl(280 60% 55% / 0.4)" },
  kantoor: { label: "Kantoor/Faciliteiten", color: "hsl(40 70% 50%)", bg: "hsl(40 70% 50% / 0.10)", border: "hsl(40 70% 50% / 0.35)" },
  technisch: { label: "Technisch", color: "hsl(0 60% 50%)", bg: "hsl(0 60% 50% / 0.10)", border: "hsl(0 60% 50% / 0.35)" },
  logistiek: { label: "Logistiek", color: "hsl(140 50% 45%)", bg: "hsl(140 50% 45% / 0.12)", border: "hsl(140 50% 45% / 0.4)" },
  medisch: { label: "Medische gassen", color: "hsl(350 70% 55%)", bg: "hsl(350 70% 55% / 0.12)", border: "hsl(350 70% 55% / 0.4)" },
} as const;

type ZoneType = keyof typeof ZONE_TYPES;

interface FloorZone {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sublabel?: string;
  type: ZoneType;
  details?: string;
}

// Layout based on the Excel floor plan - coordinates in a ~1000x800 grid
const ZONES: FloorZone[] = [
  // === LEFT COLUMN - Droogijs area ===
  { id: "droogijs1", x: 20, y: 80, w: 100, h: 120, label: "Droogijs", sublabel: "Productie", type: "opslag_droogijs", details: "Droogijsproductie-installatie" },
  { id: "droogijs_cont", x: 20, y: 210, w: 100, h: 100, label: "Droogijs", sublabel: "Containers (schoon)", type: "opslag_droogijs", details: "Schone droogijs containers" },
  { id: "vs3a", x: 20, y: 320, w: 100, h: 50, label: "Vulstation 3A", sublabel: "Trolley 40x", type: "vulstation", details: "Trolley vulstation, 40 posities" },
  { id: "vs3b", x: 20, y: 375, w: 100, h: 50, label: "Vulstation 3B", sublabel: "Trolley 40x", type: "vulstation", details: "Trolley vulstation, 40 posities" },
  { id: "opslag_ruimte", x: 20, y: 430, w: 100, h: 50, label: "Opslag ruimte", type: "logistiek" },
  { id: "boiler", x: 20, y: 485, w: 100, h: 40, label: "Boiler ruimte", type: "technisch" },

  // === CENTER-LEFT - Vulstations ===
  { id: "non_conform", x: 130, y: 80, w: 90, h: 50, label: "Non conform", type: "logistiek", details: "Non-conforme cilinders" },
  { id: "vs4a", x: 130, y: 140, w: 120, h: 45, label: "Vulstation 4A", sublabel: "O₂ 300B Trolley", type: "vulstation", details: "Zuurstof 300 bar trolley vulstation" },
  { id: "vs4b", x: 130, y: 190, w: 120, h: 45, label: "Vulstation 4B", sublabel: "O₂ 300B Pakket", type: "vulstation", details: "Zuurstof 300 bar pakket vulstation" },
  { id: "vs1a", x: 130, y: 250, w: 120, h: 45, label: "Vulstation 1A", sublabel: "Zuurstof Rek 1", type: "vulstation", details: "Zuurstof vulrek 1" },
  { id: "vs1b", x: 130, y: 300, w: 120, h: 45, label: "Vulstation 1B", sublabel: "Zuurstof Rek 2", type: "vulstation", details: "Zuurstof vulrek 2" },
  { id: "vs2a", x: 130, y: 360, w: 120, h: 45, label: "Vulstation 2A", sublabel: "Trolley 26x", type: "vulstation", details: "Trolley vulstation, 26 posities" },
  { id: "vs2b", x: 130, y: 410, w: 120, h: 45, label: "Vulstation 2B", sublabel: "Pakket quarantaine", type: "vulstation", details: "Pakket vulstation met quarantaine zone" },

  // === CENTER - Gas storage areas ===
  { id: "co2_vulling", x: 265, y: 80, w: 80, h: 50, label: "CO₂ vulling", sublabel: "Pakket", type: "opslag_gas", details: "CO₂ vulstation (pakketvulling)" },
  { id: "ar_mix_trolley", x: 265, y: 140, w: 80, h: 50, label: "Ar-Mix", sublabel: "Trolley 200 Bar", type: "opslag_gas", details: "Argon/Mix trolleys 200 bar" },
  { id: "ar_mix_pakket", x: 265, y: 195, w: 80, h: 50, label: "Ar-Mix", sublabel: "Pakket 200 Bar", type: "opslag_gas", details: "Argon/Mix pakketten 200 bar" },
  { id: "ar_mix_300", x: 265, y: 250, w: 80, h: 50, label: "Ar-Mix", sublabel: "300 Bar pakket", type: "opslag_gas", details: "Argon/Mix pakketten 300 bar" },
  { id: "o2_trolley", x: 355, y: 80, w: 60, h: 50, label: "Zuurstof", sublabel: "Trolley", type: "opslag_gas" },
  { id: "o2_pakket", x: 355, y: 140, w: 60, h: 50, label: "Zuurstof", sublabel: "Pakket", type: "opslag_gas" },

  // === CENTER-RIGHT - Elektra & Lab ===
  { id: "elektra", x: 430, y: 80, w: 70, h: 50, label: "Elektra", type: "technisch" },
  { id: "lab", x: 430, y: 140, w: 100, h: 60, label: "Laboratorium", type: "technisch", details: "Kwaliteitscontrole laboratorium" },
  { id: "ar_mix_300bar", x: 430, y: 210, w: 100, h: 45, label: "Argon/Mix", sublabel: "300 Bar", type: "opslag_gas" },
  { id: "ar_mix_200_du", x: 430, y: 260, w: 100, h: 45, label: "Argon/Mix", sublabel: "200 bar – DU", type: "opslag_gas", details: "Duitse specificatie" },
  { id: "ar_mix_200_nl", x: 430, y: 310, w: 100, h: 45, label: "Argon/Mix", sublabel: "200 bar – NL", type: "opslag_gas", details: "Nederlandse specificatie" },

  // === RIGHT - Cylinder storage ===
  { id: "o2_16cil", x: 550, y: 80, w: 70, h: 70, label: "O₂", sublabel: "16 Cil 300 bar", type: "opslag_gas", details: "Zuurstof 16 cilinder pallet, 300 bar" },
  { id: "n2_16cil", x: 625, y: 80, w: 70, h: 70, label: "N₂", sublabel: "16 Cil", type: "opslag_gas", details: "Stikstof 16 cilinder pallet" },
  { id: "o2_16cil_200a", x: 700, y: 80, w: 70, h: 70, label: "O₂", sublabel: "16 Cil 200 bar", type: "opslag_gas", details: "Zuurstof 16 cilinder pallet, 200 bar" },
  { id: "o2_16cil_200b", x: 775, y: 80, w: 70, h: 70, label: "O₂", sublabel: "16 Cil 200 bar", type: "opslag_gas" },

  // === FAR RIGHT - Storage & Office ===
  { id: "voorraad", x: 860, y: 20, w: 120, h: 40, label: "Voorraad", type: "logistiek", details: "Voorraadopslag cilinders" },
  { id: "cil_vol", x: 860, y: 65, w: 120, h: 30, label: "Cilinders vol", type: "logistiek" },
  { id: "voeding", x: 860, y: 100, w: 120, h: 30, label: "Voeding", type: "technisch" },
  { id: "magazijn", x: 860, y: 440, w: 120, h: 60, label: "Magazijn", type: "logistiek" },

  // === BOTTOM ROW - Cleaning, Logistics ===
  { id: "schoonmaak", x: 60, y: 540, w: 120, h: 40, label: "Schoonmaak", sublabel: "Cilinders", type: "technisch", details: "Chloortabletten, desinfectie" },
  { id: "te_vullen", x: 200, y: 540, w: 100, h: 40, label: "Te Vullen", type: "logistiek" },
  { id: "retour_tilburg", x: 310, y: 540, w: 110, h: 40, label: "Retour Tilburg", type: "logistiek", details: "Cilinders retour naar Tilburg" },
  { id: "wc_douche", x: 430, y: 440, w: 80, h: 40, label: "WC / Douche", type: "kantoor" },
  { id: "werkplaats", x: 530, y: 440, w: 110, h: 40, label: "Werkplaats", type: "technisch" },

  // === BOTTOM - Vivisol & Showroom ===
  { id: "vivisol_sluis", x: 530, y: 540, w: 100, h: 40, label: "Vivisol Sluis", type: "medisch" },
  { id: "vivisol_opslag", x: 640, y: 540, w: 80, h: 40, label: "Vivisol", sublabel: "Opslag", type: "medisch" },
  { id: "kantoor_vivisol", x: 730, y: 540, w: 80, h: 40, label: "Kantoor", type: "kantoor" },

  // === BOTTOM LEFT - Medical gases ===
  { id: "neophyr", x: 130, y: 620, w: 70, h: 65, label: "Neophyr", sublabel: "Argon MD", type: "medisch", details: "Neophyr / Argon medisch / Spec. Mengsels" },
  { id: "carbogeen_30", x: 210, y: 620, w: 60, h: 65, label: "Carbogeen", sublabel: "30", type: "medisch" },
  { id: "carbogeen_5", x: 275, y: 620, w: 60, h: 65, label: "Carbogeen", sublabel: "5", type: "medisch" },
  { id: "carbogeen_40", x: 340, y: 620, w: 60, h: 65, label: "Carbogeen", sublabel: "40", type: "medisch" },
  { id: "o2_med_200", x: 420, y: 620, w: 70, h: 65, label: "O₂ med.", sublabel: "200 bar", type: "medisch", details: "Medische zuurstof 200 bar" },
  { id: "o2_med_300", x: 495, y: 620, w: 70, h: 65, label: "O₂ med.", sublabel: "300 bar", type: "medisch", details: "Medische zuurstof 300 bar" },
  { id: "lucht_synth", x: 570, y: 620, w: 70, h: 65, label: "Lucht", sublabel: "Synth./Med.", type: "medisch", details: "Synthetische en medische lucht" },

  // === BOTTOM - Showroom & Offices ===
  { id: "showroom", x: 530, y: 590, w: 120, h: 25, label: "Showroom", type: "kantoor" },
  { id: "kantoren", x: 350, y: 700, w: 280, h: 50, label: "K A N T O R E N", type: "kantoor", details: "Kantoorruimtes medewerkers" },
  { id: "entree", x: 560, y: 710, w: 80, h: 40, label: "Entrée", type: "kantoor" },

  // === ONTVANGST ===
  { id: "ontvangst", x: 60, y: 590, w: 60, h: 40, label: "Ontvangst", type: "logistiek" },
];

interface InteractiveFloorPlanProps {
  className?: string;
}

export function InteractiveFloorPlan({ className }: InteractiveFloorPlanProps) {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterType, setFilterType] = useState<ZoneType | "all">("all");

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest("[data-zone]")) return;
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const selectedZoneData = ZONES.find(z => z.id === selectedZone);
  const filteredZones = filterType === "all" ? ZONES : ZONES.filter(z => z.type === filterType);

  const SVG_WIDTH = 1000;
  const SVG_HEIGHT = 780;

  return (
    <Card className={cn(
      "glass-card w-full overflow-hidden transition-all duration-300",
      isFullscreen && "fixed inset-0 z-50 rounded-none h-screen w-screen bg-background/95 backdrop-blur-md",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Interactieve Plattegrond – SOL Emmen
            </CardTitle>
            <CardDescription className="text-xs">
              Klik op een zone voor details • Scroll om te zoomen • Sleep om te pannen
            </CardDescription>
          </div>
          <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-md">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}>
              <ZoomOut className="h-3.5 w-3.5" />
            </Button>
            <span className="w-10 text-center text-xs font-mono">{Math.round(zoom * 100)}%</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(z + 0.2, 3))}>
              <ZoomIn className="h-3.5 w-3.5" />
            </Button>
            <div className="w-px h-4 bg-border mx-0.5" />
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={resetView} title="Reset weergave">
              <Move className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsFullscreen(f => !f)}>
              {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            </Button>
          </div>
        </div>

        {/* Legend / Filter */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          <Badge
            variant={filterType === "all" ? "default" : "outline"}
            className="cursor-pointer text-[10px] px-2 py-0.5"
            onClick={() => setFilterType("all")}
          >
            Alles
          </Badge>
          {Object.entries(ZONE_TYPES).map(([key, val]) => (
            <Badge
              key={key}
              variant={filterType === key ? "default" : "outline"}
              className="cursor-pointer text-[10px] px-2 py-0.5 gap-1"
              style={filterType === key ? { backgroundColor: val.color, color: "#fff" } : {}}
              onClick={() => setFilterType(key as ZoneType)}
            >
              <span
                className="inline-block w-2 h-2 rounded-full"
                style={{ backgroundColor: val.color }}
              />
              {val.label}
            </Badge>
          ))}
        </div>
      </CardHeader>

      <CardContent className="p-0 relative">
        {/* SVG Floor Plan */}
        <div
          className={cn(
            "overflow-hidden select-none",
            isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{ height: isFullscreen ? "calc(100vh - 200px)" : 550 }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={(e) => {
            const delta = -e.deltaY * 0.001;
            setZoom(z => Math.min(Math.max(z + delta, 0.5), 3));
          }}
        >
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: isPanning ? "none" : "transform 0.15s ease-out",
            }}
          >
            {/* Background */}
            <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="hsl(var(--background))" rx="8" />

            {/* Building outline */}
            <rect
              x="10" y="10" width={SVG_WIDTH - 20} height={SVG_HEIGHT - 20}
              fill="none"
              stroke="hsl(var(--border))"
              strokeWidth="2"
              strokeDasharray="8 4"
              rx="6"
            />

            {/* Grid lines for visual reference */}
            {[200, 400, 600, 800].map(x => (
              <line key={`vg${x}`} x1={x} y1="15" x2={x} y2={SVG_HEIGHT - 15} stroke="hsl(var(--border) / 0.2)" strokeWidth="0.5" strokeDasharray="4 8" />
            ))}
            {[200, 400, 600].map(y => (
              <line key={`hg${y}`} x1="15" y1={y} x2={SVG_WIDTH - 15} y2={y} stroke="hsl(var(--border) / 0.2)" strokeWidth="0.5" strokeDasharray="4 8" />
            ))}

            {/* Render zones */}
            <TooltipProvider delayDuration={100}>
              {filteredZones.map((zone) => {
                const zt = ZONE_TYPES[zone.type];
                const isSelected = selectedZone === zone.id;
                const isHovered = hoveredZone === zone.id;
                const dimmed = filterType !== "all" && zone.type !== filterType;

                return (
                  <g
                    key={zone.id}
                    data-zone={zone.id}
                    className="cursor-pointer"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedZone(selectedZone === zone.id ? null : zone.id);
                    }}
                    onMouseEnter={() => setHoveredZone(zone.id)}
                    onMouseLeave={() => setHoveredZone(null)}
                    style={{ opacity: dimmed ? 0.25 : 1 }}
                  >
                    {/* Zone rectangle */}
                    <rect
                      x={zone.x}
                      y={zone.y}
                      width={zone.w}
                      height={zone.h}
                      rx="4"
                      fill={zt.bg}
                      stroke={isSelected ? zt.color : isHovered ? zt.border : "hsl(var(--border) / 0.5)"}
                      strokeWidth={isSelected ? 2.5 : isHovered ? 2 : 1}
                      style={{
                        transition: "all 0.15s ease",
                        filter: isHovered ? `drop-shadow(0 2px 8px ${zt.color}40)` : "none",
                      }}
                    />

                    {/* Zone label */}
                    <text
                      x={zone.x + zone.w / 2}
                      y={zone.y + (zone.sublabel ? zone.h / 2 - 5 : zone.h / 2 + 1)}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={zt.color}
                      fontSize={zone.w < 80 ? 9 : 10}
                      fontWeight="600"
                      style={{ pointerEvents: "none" }}
                    >
                      {zone.label}
                    </text>

                    {/* Sublabel */}
                    {zone.sublabel && (
                      <text
                        x={zone.x + zone.w / 2}
                        y={zone.y + zone.h / 2 + 9}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="hsl(var(--muted-foreground))"
                        fontSize={zone.w < 80 ? 7 : 8}
                        style={{ pointerEvents: "none" }}
                      >
                        {zone.sublabel}
                      </text>
                    )}

                    {/* Selection indicator */}
                    {isSelected && (
                      <circle
                        cx={zone.x + zone.w - 8}
                        cy={zone.y + 8}
                        r="4"
                        fill={zt.color}
                      />
                    )}
                  </g>
                );
              })}
            </TooltipProvider>

            {/* Section labels */}
            <text x="70" y="65" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="700" letterSpacing="1" opacity="0.5">DROOGIJS</text>
            <text x="200" y="65" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="700" letterSpacing="1" opacity="0.5">VULSTATIONS</text>
            <text x="700" y="65" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="700" letterSpacing="1" opacity="0.5">PALLETS 16 CIL</text>
            <text x="300" y="610" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="700" letterSpacing="1" opacity="0.5">MEDISCHE GASSEN</text>
          </svg>
        </div>

        {/* Detail panel */}
        {selectedZoneData && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 bg-background/95 backdrop-blur-md border rounded-lg p-3 shadow-lg animate-in slide-in-from-bottom-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: ZONE_TYPES[selectedZoneData.type].color }}
                  />
                  <span className="font-semibold text-sm">{selectedZoneData.label}</span>
                </div>
                {selectedZoneData.sublabel && (
                  <p className="text-xs text-muted-foreground ml-4.5">{selectedZoneData.sublabel}</p>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: ZONE_TYPES[selectedZoneData.type].color, color: ZONE_TYPES[selectedZoneData.type].color }}>
                {ZONE_TYPES[selectedZoneData.type].label}
              </Badge>
            </div>
            {selectedZoneData.details && (
              <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                {selectedZoneData.details}
              </p>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 w-full text-xs h-7"
              onClick={() => setSelectedZone(null)}
            >
              Sluiten
            </Button>
          </div>
        )}

        {/* Hover tooltip */}
        {hoveredZone && !selectedZone && (
          <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm border rounded-md px-2.5 py-1.5 text-xs shadow pointer-events-none">
            <span className="font-medium">{ZONES.find(z => z.id === hoveredZone)?.label}</span>
            {ZONES.find(z => z.id === hoveredZone)?.sublabel && (
              <span className="text-muted-foreground ml-1.5">{ZONES.find(z => z.id === hoveredZone)?.sublabel}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
