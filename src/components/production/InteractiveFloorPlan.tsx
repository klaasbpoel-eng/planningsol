import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ZoomIn, ZoomOut, Move, Maximize2, Minimize2, Info, Pencil, Save, RotateCcw, GripVertical, Flame, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// Zone types with colors
const DEFAULT_ZONE_TYPES = {
  vulstation: { label: "Vulstation", color: "hsl(var(--primary))", bg: "hsl(var(--primary) / 0.15)", border: "hsl(var(--primary) / 0.4)" },
  opslag_gas: { label: "Gasopslag", color: "hsl(200 80% 50%)", bg: "hsl(200 80% 50% / 0.12)", border: "hsl(200 80% 50% / 0.4)" },
  opslag_droogijs: { label: "Droogijs", color: "hsl(190 90% 45%)", bg: "hsl(190 90% 45% / 0.12)", border: "hsl(190 90% 45% / 0.4)" },
  opslag_bulk: { label: "Bulkopslag", color: "hsl(280 60% 55%)", bg: "hsl(280 60% 55% / 0.12)", border: "hsl(280 60% 55% / 0.4)" },
  opslag_brandbaar: { label: "Brandbaar", color: "hsl(25 90% 50%)", bg: "hsl(25 90% 50% / 0.12)", border: "hsl(25 90% 50% / 0.4)" },
  kantoor: { label: "Kantoor/Faciliteiten", color: "hsl(40 70% 50%)", bg: "hsl(40 70% 50% / 0.10)", border: "hsl(40 70% 50% / 0.35)" },
  technisch: { label: "Technisch", color: "hsl(0 60% 50%)", bg: "hsl(0 60% 50% / 0.10)", border: "hsl(0 60% 50% / 0.35)" },
  logistiek: { label: "Logistiek", color: "hsl(140 50% 45%)", bg: "hsl(140 50% 45% / 0.12)", border: "hsl(140 50% 45% / 0.4)" },
  medisch: { label: "Medische gassen", color: "hsl(350 70% 55%)", bg: "hsl(350 70% 55% / 0.12)", border: "hsl(350 70% 55% / 0.4)" },
} as const;

type ZoneTypeConfig = { label: string; color: string; bg: string; border: string };
const ZONE_TYPE_LABELS_KEY = "floorplan-zone-type-labels";

function loadZoneTypeLabels(): Record<string, string> {
  try {
    const raw = localStorage.getItem(ZONE_TYPE_LABELS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

type ZoneType = keyof typeof DEFAULT_ZONE_TYPES;

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
  rotation?: number;
}

interface BulkTank {
  id: string;
  cx: number;
  cy: number;
  r: number;
  label: string;
  sublabel?: string;
  details?: string;
}

const DEFAULT_BULK_TANKS: BulkTank[] = [
  { id: "tank_lin", cx: 95, cy: 130, r: 28, label: "LIN", sublabel: "N₂ vloeibaar", details: "Vloeibare stikstof tank – 32.000 kg" },
  { id: "tank_lox", cx: 160, cy: 130, r: 28, label: "LOX", sublabel: "O₂ vloeibaar", details: "Vloeibare zuurstof tank – 30.000 kg" },
  { id: "tank_lar", cx: 225, cy: 130, r: 28, label: "LAR", sublabel: "Ar vloeibaar", details: "Vloeibaar argon tank – 12.000 kg" },
  { id: "tank_lco2_1", cx: 290, cy: 130, r: 28, label: "LCO₂", sublabel: "CO₂ vloeibaar", details: "Vloeibaar CO₂ tank 1 – 22.000 kg" },
  { id: "tank_lco2_2", cx: 355, cy: 130, r: 28, label: "LCO₂", sublabel: "CO₂ vloeibaar", details: "Vloeibaar CO₂ tank 2 – 22.000 kg" },
];

const DEFAULT_ZONES: FloorZone[] = [
  { id: "droogijs1", x: 30, y: 180, w: 110, h: 100, label: "Droogijs", sublabel: "Productie", type: "opslag_droogijs", details: "Droogijsproductie-installatie" },
  { id: "droogijs_cont", x: 30, y: 288, w: 110, h: 80, label: "Droogijs", sublabel: "Containers (schoon)", type: "opslag_droogijs", details: "Schone droogijs containers" },
  { id: "vs3a", x: 30, y: 376, w: 110, h: 42, label: "Vulstation 3A", sublabel: "Trolley 40x", type: "vulstation", details: "Trolley vulstation, 40 posities" },
  { id: "vs3b", x: 30, y: 424, w: 110, h: 42, label: "Vulstation 3B", sublabel: "Trolley 40x", type: "vulstation", details: "Trolley vulstation, 40 posities" },
  { id: "opslag_ruimte", x: 30, y: 472, w: 110, h: 42, label: "Opslag ruimte", type: "logistiek" },
  { id: "boiler", x: 30, y: 520, w: 110, h: 35, label: "Boiler ruimte", type: "technisch" },
  { id: "non_conform", x: 150, y: 180, w: 100, h: 42, label: "Non conform", type: "logistiek", details: "Non-conforme cilinders" },
  { id: "vs4a", x: 150, y: 228, w: 130, h: 42, label: "Vulstation 4A", sublabel: "O₂ 300B Trolley", type: "vulstation", details: "Zuurstof 300 bar trolley vulstation" },
  { id: "vs4b", x: 150, y: 276, w: 130, h: 42, label: "Vulstation 4B", sublabel: "O₂ 300B Pakket", type: "vulstation", details: "Zuurstof 300 bar pakket vulstation" },
  { id: "vs1a", x: 150, y: 326, w: 130, h: 42, label: "Vulstation 1A", sublabel: "Zuurstof Rek 1", type: "vulstation", details: "Zuurstof vulrek 1" },
  { id: "vs1b", x: 150, y: 374, w: 130, h: 42, label: "Vulstation 1B", sublabel: "Zuurstof Rek 2", type: "vulstation", details: "Zuurstof vulrek 2" },
  { id: "vs2a", x: 150, y: 424, w: 130, h: 42, label: "Vulstation 2A", sublabel: "Trolley 26x", type: "vulstation", details: "Trolley vulstation, 26 posities" },
  { id: "vs2b", x: 150, y: 472, w: 130, h: 42, label: "Vulstation 2B", sublabel: "Pakket quarantaine", type: "vulstation", details: "Pakket vulstation met quarantaine zone" },
  { id: "co2_vulling", x: 290, y: 180, w: 90, h: 52, label: "CO₂ vulling", sublabel: "Pakket", type: "opslag_gas", details: "CO₂ vulstation (pakketvulling)" },
  { id: "ar_mix_trolley", x: 290, y: 240, w: 90, h: 46, label: "Ar-Mix", sublabel: "Trolley 200 Bar", type: "opslag_gas", details: "Argon/Mix trolleys 200 bar" },
  { id: "ar_mix_pakket", x: 290, y: 292, w: 90, h: 46, label: "Ar-Mix", sublabel: "Pakket 200 Bar", type: "opslag_gas", details: "Argon/Mix pakketten 200 bar" },
  { id: "ar_mix_300", x: 290, y: 344, w: 90, h: 46, label: "Ar-Mix", sublabel: "300 Bar pakket", type: "opslag_gas", details: "Argon/Mix pakketten 300 bar" },
  { id: "o2_trolley", x: 388, y: 180, w: 72, h: 52, label: "Zuurstof", sublabel: "Trolley", type: "opslag_gas" },
  { id: "o2_pakket", x: 388, y: 240, w: 72, h: 46, label: "Zuurstof", sublabel: "Pakket", type: "opslag_gas" },
  { id: "elektra", x: 468, y: 180, w: 72, h: 42, label: "Elektra", type: "technisch" },
  { id: "lab", x: 468, y: 228, w: 110, h: 52, label: "Laboratorium", type: "technisch", details: "Kwaliteitscontrole laboratorium" },
  { id: "ar_mix_300bar", x: 468, y: 288, w: 110, h: 42, label: "Argon/Mix", sublabel: "300 Bar", type: "opslag_gas" },
  { id: "ar_mix_200_du", x: 468, y: 336, w: 110, h: 42, label: "Argon/Mix", sublabel: "200 bar – DU", type: "opslag_gas", details: "Duitse specificatie" },
  { id: "ar_mix_200_nl", x: 468, y: 384, w: 110, h: 42, label: "Argon/Mix", sublabel: "200 bar – NL", type: "opslag_gas", details: "Nederlandse specificatie" },
  { id: "o2_16cil", x: 595, y: 180, w: 80, h: 65, label: "O₂", sublabel: "16 Cil · 300 bar", type: "opslag_gas", details: "Zuurstof 16 cilinder pallet, 300 bar" },
  { id: "n2_16cil", x: 680, y: 180, w: 80, h: 65, label: "N₂", sublabel: "16 Cil", type: "opslag_gas", details: "Stikstof 16 cilinder pallet" },
  { id: "o2_16cil_200a", x: 765, y: 180, w: 80, h: 65, label: "O₂", sublabel: "16 Cil · 200 bar", type: "opslag_gas", details: "Zuurstof 16 cilinder pallet, 200 bar" },
  { id: "o2_16cil_200b", x: 850, y: 180, w: 80, h: 65, label: "O₂", sublabel: "16 Cil · 200 bar", type: "opslag_gas" },
  { id: "voorraad", x: 850, y: 255, w: 120, h: 38, label: "Vulpunt", sublabel: "Gasaansluiting", type: "vulstation", details: "Vulpunt – gasaansluiting voor cilindervulling" },
  { id: "cil_vol", x: 850, y: 298, w: 120, h: 32, label: "Vulpunt", sublabel: "Cilinders vol", type: "vulstation", details: "Vulpunt – volle cilinders aansluiting" },
  { id: "voeding", x: 850, y: 335, w: 120, h: 32, label: "Vulpunt", sublabel: "Voeding", type: "vulstation", details: "Vulpunt – voedingsaansluiting" },
  { id: "magazijn", x: 850, y: 460, w: 120, h: 55, label: "Magazijn", type: "logistiek" },
  { id: "wc_douche", x: 468, y: 460, w: 80, h: 38, label: "WC / Douche", type: "kantoor" },
  { id: "werkplaats", x: 555, y: 460, w: 120, h: 38, label: "Werkplaats", type: "technisch" },
  { id: "schoonmaak", x: 30, y: 565, w: 130, h: 38, label: "Schoonmaak", sublabel: "Cilinders", type: "technisch", details: "Chloortabletten, desinfectie spuit" },
  { id: "te_vullen", x: 168, y: 565, w: 110, h: 38, label: "Te Vullen", type: "logistiek" },
  { id: "retour_tilburg", x: 286, y: 565, w: 120, h: 38, label: "Retour Tilburg", type: "logistiek", details: "Cilinders retour naar Tilburg" },
  { id: "ontvangst", x: 30, y: 610, w: 80, h: 38, label: "Ontvangst", type: "logistiek" },
  { id: "vivisol_sluis", x: 595, y: 565, w: 110, h: 38, label: "Vivisol Sluis", type: "medisch" },
  { id: "vivisol_opslag", x: 710, y: 565, w: 90, h: 38, label: "Vivisol", sublabel: "Opslag", type: "medisch" },
  { id: "kantoor_vivisol", x: 808, y: 565, w: 80, h: 38, label: "Kantoor", type: "kantoor" },
  { id: "neophyr", x: 120, y: 655, w: 75, h: 58, label: "Neophyr", sublabel: "Argon MD", type: "medisch", details: "Neophyr / Argon medisch / Spec. Mengsels" },
  { id: "carbogeen_30", x: 200, y: 655, w: 65, h: 58, label: "Carbogeen", sublabel: "30", type: "medisch" },
  { id: "carbogeen_5", x: 270, y: 655, w: 65, h: 58, label: "Carbogeen", sublabel: "5", type: "medisch" },
  { id: "carbogeen_40", x: 340, y: 655, w: 65, h: 58, label: "Carbogeen", sublabel: "40", type: "medisch" },
  { id: "o2_med_200", x: 415, y: 655, w: 75, h: 58, label: "O₂ med.", sublabel: "200 bar", type: "medisch", details: "Medische zuurstof 200 bar" },
  { id: "o2_med_300", x: 495, y: 655, w: 75, h: 58, label: "O₂ med.", sublabel: "300 bar", type: "medisch", details: "Medische zuurstof 300 bar" },
  { id: "lucht_synth", x: 575, y: 655, w: 75, h: 58, label: "Lucht", sublabel: "Synth./Med.", type: "medisch", details: "Synthetische en medische lucht" },
  { id: "showroom", x: 720, y: 680, w: 60, h: 24, label: "Showroom", type: "kantoor" },
  { id: "showroom_start", x: 630, y: 750, w: 10, h: 10, label: "", type: "kantoor" },
  { id: "showroom_end", x: 848, y: 595, w: 10, h: 10, label: "", type: "kantoor" },
  { id: "kantoren", x: 340, y: 740, w: 300, h: 48, label: "K A N T O R E N", type: "kantoor", details: "Kantoorruimtes medewerkers" },
  { id: "entree", x: 540, y: 750, w: 90, h: 38, label: "Entrée", type: "kantoor" },
  { id: "uitsorteer", x: 750, y: 610, w: 220, h: 48, label: "Uitsorteerplatform", sublabel: "Lege cilinders", type: "logistiek", details: "Sorteerplatform voor lege cilinders" },
  { id: "uitsorteer_vol", x: 750, y: 665, w: 220, h: 48, label: "Uitsorteerplatform", sublabel: "Volle cilinders · Order pick", type: "logistiek", details: "Sorteerplatform voor volle cilinders, gebruikt voor order picken" },
  // Buitenopslag brandbare gassen (rechtsbovenin)
  { id: "buiten_brandbaar", x: 620, y: 30, w: 350, h: 110, label: "Buitenopslag", sublabel: "Brandbare gassen", type: "opslag_brandbaar", details: "Buitenopslag voor brandbare gassen – ADR/PGS 15 conform" },
  { id: "buiten_acetyleen", x: 630, y: 50, w: 100, h: 75, label: "Acetyleen", sublabel: "C₂H₂", type: "opslag_brandbaar", details: "UN1001 · Klasse 2.1 · GHS02/GHS04" },
  { id: "buiten_waterstof", x: 740, y: 50, w: 100, h: 75, label: "Waterstof", sublabel: "H₂", type: "opslag_brandbaar", details: "UN1049 · Klasse 2.1 · GHS02/GHS04" },
  { id: "buiten_methaan", x: 850, y: 50, w: 100, h: 75, label: "Methaan", sublabel: "CH₄", type: "opslag_brandbaar", details: "UN1971 · Klasse 2.1 · GHS02/GHS04" },
];

const STORAGE_KEY = "floorplan-positions";
const DEFAULTS_KEY = "floorplan-defaults";
const GRID_SNAP = 10;
const snap = (v: number) => Math.round(v / GRID_SNAP) * GRID_SNAP;

function loadPositions(): { zones: Record<string, { x: number; y: number; label?: string; sublabel?: string }>; tanks: Record<string, { cx: number; cy: number; label?: string; sublabel?: string }> } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePositions(zones: FloorZone[], tanks: BulkTank[]) {
  const zonePos: Record<string, { x: number; y: number; w: number; h: number; label: string; sublabel?: string; details?: string; rotation?: number; type?: string }> = {};
  zones.forEach(z => { zonePos[z.id] = { x: z.x, y: z.y, w: z.w, h: z.h, label: z.label, sublabel: z.sublabel, details: z.details, rotation: z.rotation, type: z.type }; });
  const tankPos: Record<string, { cx: number; cy: number; label: string; sublabel?: string; details?: string }> = {};
  tanks.forEach(t => { tankPos[t.id] = { cx: t.cx, cy: t.cy, label: t.label, sublabel: t.sublabel, details: t.details }; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ zones: zonePos, tanks: tankPos }));
}

function applyPositions(zones: FloorZone[], tanks: BulkTank[], saved: ReturnType<typeof loadPositions>) {
  if (!saved) return { zones, tanks };
  const newZones = zones.map(z => saved.zones[z.id] ? { ...z, ...saved.zones[z.id] } : z);
  const newTanks = tanks.map(t => saved.tanks[t.id] ? { ...t, ...saved.tanks[t.id] } : t);
  return { zones: newZones, tanks: newTanks };
}

function EditableText({ value, onSave, className, placeholder }: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  if (editing) {
    return (
      <input
        autoFocus
        className={cn("bg-transparent border-b border-primary outline-none w-full", className)}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={() => { onSave(text.trim()); setEditing(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(text.trim()); setEditing(false); }
          if (e.key === "Escape") { setText(value); setEditing(false); }
        }}
        placeholder={placeholder}
      />
    );
  }

  return (
    <span
      className={cn("cursor-pointer hover:border-b hover:border-dashed hover:border-muted-foreground/50 transition-colors", className, !value && "italic opacity-50")}
      onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      title="Klik om te bewerken"
    >
      {value || placeholder}
    </span>
  );
}

// Mapping zone IDs to gas type names for inventory overlay
const ZONE_GAS_MAPPING: Record<string, string> = {
  o2_trolley: "Zuurstof",
  o2_pakket: "Zuurstof",
  o2_16cil: "Zuurstof",
  o2_16cil_200a: "Zuurstof",
  o2_16cil_200b: "Zuurstof",
  co2_vulling: "Kooldioxide",
  ar_mix_trolley: "Argon",
  ar_mix_pakket: "Argon",
  ar_mix_300: "Argon",
  ar_mix_300bar: "Argon",
  ar_mix_200_du: "Argon",
  ar_mix_200_nl: "Argon",
  n2_16cil: "Stikstof",
  buiten_acetyleen: "Acetyleen",
  buiten_waterstof: "Waterstof",
  buiten_methaan: "Methaan",
};

const TANK_GAS_MAPPING: Record<string, string> = {
  tank_lin: "Stikstof",
  tank_lox: "Zuurstof",
  tank_lar: "Argon",
  tank_lco2_1: "Kooldioxide",
  tank_lco2_2: "Kooldioxide",
};

interface PgsSubstance {
  id: string;
  gas_type_id: string | null;
  current_stock_kg: number;
  max_allowed_kg: number;
  gas_types?: { name: string } | null;
}

interface BulkTankData {
  id: string;
  tank_name: string;
  current_level_kg: number;
  capacity_kg: number;
  gas_types?: { name: string } | null;
}

function getOccupancyColor(pct: number): string {
  if (pct >= 85) return "hsl(0 80% 50%)";
  if (pct >= 60) return "hsl(35 90% 50%)";
  return "hsl(140 60% 45%)";
}

interface InteractiveFloorPlanProps {
  className?: string;
}

export function InteractiveFloorPlan({ className }: InteractiveFloorPlanProps) {
  const saved = loadPositions();
  const initial = applyPositions([...DEFAULT_ZONES], [...DEFAULT_BULK_TANKS], saved);

  // Build ZONE_TYPES with custom labels
  const savedLabels = loadZoneTypeLabels();
  const [zoneTypeLabels, setZoneTypeLabels] = useState<Record<string, string>>(savedLabels);
  const ZONE_TYPES = Object.fromEntries(
    Object.entries(DEFAULT_ZONE_TYPES).map(([key, val]) => [
      key,
      { ...val, label: zoneTypeLabels[key] || val.label },
    ])
  ) as Record<ZoneType, ZoneTypeConfig>;

  const handleZoneTypeLabelEdit = useCallback((key: string, newLabel: string) => {
    if (!newLabel) return;
    setZoneTypeLabels(prev => {
      const updated = { ...prev, [key]: newLabel };
      localStorage.setItem(ZONE_TYPE_LABELS_KEY, JSON.stringify(updated));
      return updated;
    });
    toast.success("Categorienaam bijgewerkt");
  }, []);

  const [zones, setZones] = useState<FloorZone[]>(initial.zones);
  const [tanks, setTanks] = useState<BulkTank[]>(initial.tanks);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [autoFitDone, setAutoFitDone] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterType, setFilterType] = useState<ZoneType | "all">("all");
  const [editMode, setEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"zone" | "tank" | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingField, setEditingField] = useState<"label" | "sublabel" | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [terrainHeight, setTerrainHeight] = useState(() => {
    try { const v = localStorage.getItem("floorplan-terrain-height"); return v ? Number(v) : 180; } catch { return 180; }
  });
  const [resizingTerrain, setResizingTerrain] = useState(false);
  const [buildingWidth, setBuildingWidth] = useState(() => {
    try { const v = localStorage.getItem("floorplan-building-width"); return v ? Number(v) : 1060; } catch { return 1060; }
  });
  const [buildingHeight, setBuildingHeight] = useState(() => {
    try { const v = localStorage.getItem("floorplan-building-height"); return v ? Number(v) : 655; } catch { return 655; }
  });
  const [resizingBuilding, setResizingBuilding] = useState<"right" | "bottom" | "corner" | null>(null);
  const buildingResizeStart = useRef({ clientX: 0, clientY: 0, w: 0, h: 0 });
  const [canvasWidth, setCanvasWidth] = useState(() => {
    try { const v = localStorage.getItem("floorplan-canvas-width"); return v ? Number(v) : 1100; } catch { return 1100; }
  });
  const [canvasHeight, setCanvasHeight] = useState(() => {
    try { const v = localStorage.getItem("floorplan-canvas-height"); return v ? Number(v) : 900; } catch { return 900; }
  });
  const [resizingCanvas, setResizingCanvas] = useState<"right" | "bottom" | "corner" | "left" | "top" | null>(null);
  const [canvasOffsetX, setCanvasOffsetX] = useState(() => {
    try { const v = localStorage.getItem("floorplan-canvas-offset-x"); return v ? Number(v) : 0; } catch { return 0; }
  });
  const [canvasOffsetY, setCanvasOffsetY] = useState(() => {
    try { const v = localStorage.getItem("floorplan-canvas-offset-y"); return v ? Number(v) : 0; } catch { return 0; }
  });

  // Zone resize & rotation
  const [resizingZoneId, setResizingZoneId] = useState<string | null>(null);
  const [resizingCorner, setResizingCorner] = useState<"se" | "sw" | "ne" | "nw" | null>(null);
  const [rotatingZoneId, setRotatingZoneId] = useState<string | null>(null);

  // Zone type context menu
  const [contextMenu, setContextMenu] = useState<{ zoneId: string; screenX: number; screenY: number } | null>(null);
  const resizeZoneStart = useRef<{ x: number; y: number; w: number; h: number }>({ x: 0, y: 0, w: 0, h: 0 });
  const rotateZoneStart = useRef<{ angle: number; rotation: number }>({ angle: 0, rotation: 0 });

  const [showInventory, setShowInventory] = useState(true);

  const [pgsData, setPgsData] = useState<PgsSubstance[]>([]);
  const [bulkTankData, setBulkTankData] = useState<BulkTankData[]>([]);

  // Fetch inventory data
  useEffect(() => {
    const fetchInventory = async () => {
      const [pgsRes, tankRes] = await Promise.all([
        supabase.from("pgs_substances").select("id, gas_type_id, current_stock_kg, max_allowed_kg, gas_types(name)").eq("location", "sol_emmen"),
        supabase.from("bulk_storage_tanks").select("id, tank_name, current_level_kg, capacity_kg, gas_types(name)").eq("location", "sol_emmen"),
      ]);
      if (pgsRes.data) setPgsData(pgsRes.data as any);
      if (tankRes.data) setBulkTankData(tankRes.data as any);
    };
    fetchInventory();
  }, []);

  // Helper to get PGS data for a zone by gas name
  const getZoneInventory = useCallback((zoneId: string) => {
    const gasName = ZONE_GAS_MAPPING[zoneId];
    if (!gasName) return null;
    const substance = pgsData.find(p => p.gas_types?.name?.toLowerCase().includes(gasName.toLowerCase()));
    if (!substance || substance.max_allowed_kg <= 0) return null;
    const pct = Math.round((substance.current_stock_kg / substance.max_allowed_kg) * 100);
    return { current: substance.current_stock_kg, max: substance.max_allowed_kg, pct };
  }, [pgsData]);

  // Helper to get bulk tank data
  const getTankInventory = useCallback((tankId: string) => {
    const gasName = TANK_GAS_MAPPING[tankId];
    if (!gasName) return null;
    const tank = bulkTankData.find(t => t.gas_types?.name?.toLowerCase().includes(gasName.toLowerCase()));
    if (!tank || tank.capacity_kg <= 0) return null;
    const pct = Math.round((tank.current_level_kg / tank.capacity_kg) * 100);
    return { current: tank.current_level_kg, max: tank.capacity_kg, pct };
  }, [bulkTankData]);

  const svgRef = useRef<SVGSVGElement>(null);
  const resizeStartRef = useRef<{ clientX: number; clientY: number; offsetX: number; offsetY: number }>({ clientX: 0, clientY: 0, offsetX: 0, offsetY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const SVG_WIDTH = canvasWidth;
  const SVG_HEIGHT = canvasHeight;

  // Auto-fit zoom to fill container on mount and fullscreen toggle only
  useEffect(() => {
    // Skip auto-fit while user is actively resizing the canvas
    if (resizingCanvas) return;
    const fit = () => {
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const vbW = SVG_WIDTH - canvasOffsetX;
      const vbH = SVG_HEIGHT - canvasOffsetY;
      const containerAspect = rect.width / rect.height;
      const svgAspect = vbW / vbH;
      const fitZoom = containerAspect > svgAspect
        ? (containerAspect / svgAspect) * 0.97
        : (svgAspect / containerAspect) * 0.97;
      setZoom(Math.min(Math.max(fitZoom, 1), 3));
      setPan({ x: 0, y: 0 });
    };
    const timer = setTimeout(fit, 80);
    return () => clearTimeout(timer);
  }, [isFullscreen]); // Only re-fit on fullscreen toggle, not during resize

  // Convert mouse event to SVG coordinates
  const toSVG = useCallback((e: React.MouseEvent): { x: number; y: number } | null => {
    if (!svgRef.current) return null;
    const pt = svgRef.current.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svgRef.current.getScreenCTM();
    if (!ctm) return null;
    const svgPt = pt.matrixTransform(ctm.inverse());
    return { x: svgPt.x, y: svgPt.y };
  }, []);

  const dragOffset = useRef({ x: 0, y: 0 });
  const dragStartPos = useRef<{ x: number; y: number; cx: number; cy: number }>({ x: 0, y: 0, cx: 0, cy: 0 });

  const handleZoneDragStart = useCallback((e: React.MouseEvent, zoneId: string) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    const svgPt = toSVG(e);
    if (!svgPt) return;
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;
    dragOffset.current = { x: svgPt.x - zone.x, y: svgPt.y - zone.y };
    dragStartPos.current = { x: zone.x, y: zone.y, cx: 0, cy: 0 };
    setDraggingId(zoneId);
    setDragType("zone");
  }, [editMode, zones, toSVG]);

  const handleTankDragStart = useCallback((e: React.MouseEvent, tankId: string) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    const svgPt = toSVG(e);
    if (!svgPt) return;
    const tank = tanks.find(t => t.id === tankId);
    if (!tank) return;
    dragOffset.current = { x: svgPt.x - tank.cx, y: svgPt.y - tank.cy };
    dragStartPos.current = { x: 0, y: 0, cx: tank.cx, cy: tank.cy };
    setDraggingId(tankId);
    setDragType("tank");
  }, [editMode, tanks, toSVG]);

  const ALIGN_THRESHOLD = 8; // pixels threshold for snapping to alignment

  const alignSnap = useCallback((id: string, rawX: number, rawY: number): { x: number; y: number; guideX: number | null; guideY: number | null } => {
    let x = snap(rawX);
    let y = snap(rawY);
    let guideX: number | null = null;
    let guideY: number | null = null;
    const dragged = zones.find(z => z.id === id);
    if (!dragged) return { x, y, guideX, guideY };

    for (const z of zones) {
      if (z.id === id) continue;
      // Snap left edges
      if (Math.abs(x - z.x) < ALIGN_THRESHOLD) { x = z.x; guideX = x; }
      // Snap right edges
      if (Math.abs((x + dragged.w) - (z.x + z.w)) < ALIGN_THRESHOLD) { x = z.x + z.w - dragged.w; guideX = x + dragged.w; }
      // Snap left to right
      if (Math.abs(x - (z.x + z.w)) < ALIGN_THRESHOLD) { x = z.x + z.w; guideX = x; }
      // Snap top edges
      if (Math.abs(y - z.y) < ALIGN_THRESHOLD) { y = z.y; guideY = y; }
      // Snap bottom edges
      if (Math.abs((y + dragged.h) - (z.y + z.h)) < ALIGN_THRESHOLD) { y = z.y + z.h - dragged.h; guideY = y + dragged.h; }
      // Snap top to bottom
      if (Math.abs(y - (z.y + z.h)) < ALIGN_THRESHOLD) { y = z.y + z.h; guideY = y; }
    }
    return { x, y, guideX, guideY };
  }, [zones]);

  const [alignGuides, setAlignGuides] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    // Canvas resize
    if (resizingCanvas) {
      const svgPt = toSVG(e);
      if (!svgPt) return;
      if (resizingCanvas === "right" || resizingCanvas === "corner") {
        setCanvasWidth(Math.max(800, snap(svgPt.x + 10)));
      }
      if (resizingCanvas === "bottom" || resizingCanvas === "corner") {
        setCanvasHeight(Math.max(600, snap(svgPt.y + 10)));
      }
      if (resizingCanvas === "left") {
        const svgRect = svgRef.current!.getBoundingClientRect();
        const pxPerSvgUnit = svgRect.width / (SVG_WIDTH - canvasOffsetX);
        const deltaPx = e.clientX - resizeStartRef.current.clientX;
        const deltaSvg = deltaPx / pxPerSvgUnit;
        setCanvasOffsetX(Math.min(0, snap(resizeStartRef.current.offsetX + deltaSvg)));
      }
      if (resizingCanvas === "top") {
        const svgRect = svgRef.current!.getBoundingClientRect();
        const pxPerSvgUnit = svgRect.height / (SVG_HEIGHT - canvasOffsetY);
        const deltaPx = e.clientY - resizeStartRef.current.clientY;
        const deltaSvg = deltaPx / pxPerSvgUnit;
        setCanvasOffsetY(Math.min(0, snap(resizeStartRef.current.offsetY + deltaSvg)));
      }
      setHasChanges(true);
      return;
    }

    // Terrain resize
    if (resizingTerrain) {
      const svgPt = toSVG(e);
      if (!svgPt) return;
      const newH = Math.max(100, Math.min(400, snap(svgPt.y - 40)));
      setTerrainHeight(newH);
      setHasChanges(true);
      return;
    }

    // Building resize
    if (resizingBuilding) {
      const svgRect = svgRef.current!.getBoundingClientRect();
      const pxPerSvgUnitX = svgRect.width / (SVG_WIDTH - canvasOffsetX);
      const pxPerSvgUnitY = svgRect.height / (SVG_HEIGHT - canvasOffsetY);
      const dxPx = e.clientX - buildingResizeStart.current.clientX;
      const dyPx = e.clientY - buildingResizeStart.current.clientY;
      if (resizingBuilding === "right" || resizingBuilding === "corner") {
        setBuildingWidth(Math.max(400, snap(buildingResizeStart.current.w + dxPx / pxPerSvgUnitX)));
      }
      if (resizingBuilding === "bottom" || resizingBuilding === "corner") {
        setBuildingHeight(Math.max(300, snap(buildingResizeStart.current.h + dyPx / pxPerSvgUnitY)));
      }
      setHasChanges(true);
      return;
    }

    // Zone resize
    if (resizingZoneId && resizingCorner) {
      const svgPt = toSVG(e);
      if (!svgPt) return;
      const s = resizeZoneStart.current;
      let newX = s.x, newY = s.y, newW = s.w, newH = s.h;
      if (resizingCorner === "se") {
        newW = Math.max(40, snap(svgPt.x - s.x));
        newH = Math.max(20, snap(svgPt.y - s.y));
      } else if (resizingCorner === "sw") {
        newW = Math.max(40, snap(s.x + s.w - svgPt.x));
        newX = snap(svgPt.x);
        newH = Math.max(20, snap(svgPt.y - s.y));
      } else if (resizingCorner === "ne") {
        newW = Math.max(40, snap(svgPt.x - s.x));
        newH = Math.max(20, snap(s.y + s.h - svgPt.y));
        newY = snap(svgPt.y);
      } else if (resizingCorner === "nw") {
        newW = Math.max(40, snap(s.x + s.w - svgPt.x));
        newX = snap(svgPt.x);
        newH = Math.max(20, snap(s.y + s.h - svgPt.y));
        newY = snap(svgPt.y);
      }
      setZones(prev => prev.map(z => z.id === resizingZoneId ? { ...z, x: newX, y: newY, w: newW, h: newH } : z));
      setHasChanges(true);
      return;
    }

    // Zone rotation
    if (rotatingZoneId) {
      const svgPt = toSVG(e);
      if (!svgPt) return;
      const zone = zones.find(z => z.id === rotatingZoneId);
      if (!zone) return;
      const cx = zone.x + zone.w / 2;
      const cy = zone.y + zone.h / 2;
      const angle = Math.atan2(svgPt.y - cy, svgPt.x - cx) * (180 / Math.PI);
      const delta = angle - rotateZoneStart.current.angle;
      // Snap to 15° increments
      const newRot = Math.round((rotateZoneStart.current.rotation + delta) / 15) * 15;
      setZones(prev => prev.map(z => z.id === rotatingZoneId ? { ...z, rotation: newRot } : z));
      setHasChanges(true);
      return;
    }

    if (draggingId && dragType) {
      const svgPt = toSVG(e);
      if (!svgPt) return;
      const newX = svgPt.x - dragOffset.current.x;
      const newY = svgPt.y - dragOffset.current.y;

      if (dragType === "zone") {
        const { x, y, guideX, guideY } = alignSnap(draggingId, newX, newY);
        setZones(prev => prev.map(z => z.id === draggingId ? { ...z, x, y } : z));
        setAlignGuides({ x: guideX, y: guideY });
      } else {
        const snappedCx = snap(svgPt.x - dragOffset.current.x);
        const snappedCy = snap(svgPt.y - dragOffset.current.y);
        setTanks(prev => prev.map(t => t.id === draggingId ? { ...t, cx: snappedCx, cy: snappedCy } : t));
        setAlignGuides({ x: null, y: null });
      }
      setHasChanges(true);
      return;
    }

    // Panning
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [draggingId, dragType, isPanning, panStart, toSVG, alignSnap, resizingTerrain, resizingCanvas, canvasWidth, canvasHeight, canvasOffsetX, canvasOffsetY, resizingZoneId, resizingCorner, rotatingZoneId, zones, resizingBuilding]);

  // Check overlap between two rectangles
  const rectsOverlap = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  // Check overlap between circle and rect
  const circleRectOverlap = (c: { cx: number; cy: number; r: number }, r: { x: number; y: number; w: number; h: number }) => {
    const closestX = Math.max(r.x, Math.min(c.cx, r.x + r.w));
    const closestY = Math.max(r.y, Math.min(c.cy, r.y + r.h));
    const dx = c.cx - closestX;
    const dy = c.cy - closestY;
    return (dx * dx + dy * dy) < (c.r * c.r);
  };

  // Check overlap between two circles
  const circlesOverlap = (a: { cx: number; cy: number; r: number }, b: { cx: number; cy: number; r: number }) => {
    const dx = a.cx - b.cx;
    const dy = a.cy - b.cy;
    return Math.sqrt(dx * dx + dy * dy) < (a.r + b.r);
  };

  const handleSvgMouseUp = useCallback(() => {
    if (resizingCanvas) {
      localStorage.setItem("floorplan-canvas-width", String(canvasWidth));
      localStorage.setItem("floorplan-canvas-height", String(canvasHeight));
      localStorage.setItem("floorplan-canvas-offset-x", String(canvasOffsetX));
      localStorage.setItem("floorplan-canvas-offset-y", String(canvasOffsetY));
      setResizingCanvas(null);
    }
    if (resizingTerrain) {
      localStorage.setItem("floorplan-terrain-height", String(terrainHeight));
      setResizingTerrain(false);
    }
    if (resizingBuilding) {
      localStorage.setItem("floorplan-building-width", String(buildingWidth));
      localStorage.setItem("floorplan-building-height", String(buildingHeight));
      setResizingBuilding(null);
    }
    if (resizingZoneId) {
      setResizingZoneId(null);
      setResizingCorner(null);
      setHasChanges(true);
    }
    if (rotatingZoneId) {
      setRotatingZoneId(null);
      setHasChanges(true);
    }
    if (draggingId && dragType && editMode) {
      if (dragType === "zone") {
        const dragged = zones.find(z => z.id === draggingId);
        if (dragged) {
          const overlapping = zones.find(z => z.id !== draggingId && rectsOverlap(dragged, z));
          if (overlapping) {
            setZones(prev => prev.map(z => {
              if (z.id === draggingId) return { ...z, x: snap(overlapping.x), y: snap(overlapping.y) };
              if (z.id === overlapping.id) return { ...z, x: snap(dragStartPos.current.x), y: snap(dragStartPos.current.y) };
              return z;
            }));
            toast.info(`${dragged.label} ↔ ${overlapping.label} gewisseld`);
          }
          const overlappingTank = tanks.find(t => circleRectOverlap(t, dragged));
          if (overlappingTank && !overlapping) {
            const startCenterX = dragStartPos.current.x + dragged.w / 2;
            const startCenterY = dragStartPos.current.y + dragged.h / 2;
            const newZoneX = overlappingTank.cx - dragged.w / 2;
            const newZoneY = overlappingTank.cy - dragged.h / 2;
            setZones(prev => prev.map(z => z.id === draggingId ? { ...z, x: snap(newZoneX), y: snap(newZoneY) } : z));
            setTanks(prev => prev.map(t => t.id === overlappingTank.id ? { ...t, cx: snap(startCenterX), cy: snap(startCenterY) } : t));
            toast.info(`${dragged.label} ↔ ${overlappingTank.label} gewisseld`);
          }
        }
      } else if (dragType === "tank") {
        const dragged = tanks.find(t => t.id === draggingId);
        if (dragged) {
          const overlapping = tanks.find(t => t.id !== draggingId && circlesOverlap(dragged, t));
          if (overlapping) {
            setTanks(prev => prev.map(t => {
              if (t.id === draggingId) return { ...t, cx: snap(overlapping.cx), cy: snap(overlapping.cy) };
              if (t.id === overlapping.id) return { ...t, cx: snap(dragStartPos.current.cx), cy: snap(dragStartPos.current.cy) };
              return t;
            }));
            toast.info(`${dragged.label} ↔ ${overlapping.label} gewisseld`);
          }
          const overlappingZone = zones.find(z => circleRectOverlap(dragged, z));
          if (overlappingZone && !overlapping) {
            const zoneCenterX = overlappingZone.x + overlappingZone.w / 2;
            const zoneCenterY = overlappingZone.y + overlappingZone.h / 2;
            setTanks(prev => prev.map(t => t.id === draggingId ? { ...t, cx: snap(zoneCenterX), cy: snap(zoneCenterY) } : t));
            setZones(prev => prev.map(z => z.id === overlappingZone.id ? { ...z, x: snap(dragStartPos.current.cx - z.w / 2), y: snap(dragStartPos.current.cy - z.h / 2) } : z));
            toast.info(`${dragged.label} ↔ ${overlappingZone.label} gewisseld`);
          }
        }
      }
      setHasChanges(true);
    }
    setDraggingId(null);
    setDragType(null);
    setIsPanning(false);
    setAlignGuides({ x: null, y: null });
  }, [draggingId, dragType, editMode, zones, tanks, resizingCanvas, resizingTerrain, canvasWidth, canvasHeight, canvasOffsetX, canvasOffsetY, terrainHeight, resizingZoneId, rotatingZoneId]);

  // Inline text editing
  const handleStartEdit = useCallback((id: string, field: "label" | "sublabel", currentValue: string) => {
    if (!editMode) return;
    setEditingId(id);
    setEditingField(field);
    setEditingValue(currentValue);
  }, [editMode]);

  const handleFinishEdit = useCallback(() => {
    if (!editingId || !editingField) return;
    const val = editingValue.trim();
    if (!val && editingField === "label") {
      setEditingId(null);
      setEditingField(null);
      return;
    }
    const isZone = zones.some(z => z.id === editingId);
    const isTank = tanks.some(t => t.id === editingId);
    if (isZone) {
      setZones(prev => prev.map(z => z.id === editingId ? { ...z, [editingField]: val || undefined } : z));
    } else if (isTank) {
      setTanks(prev => prev.map(t => t.id === editingId ? { ...t, [editingField]: val || undefined } : t));
    }
    setHasChanges(true);
    setEditingId(null);
    setEditingField(null);
  }, [editingId, editingField, editingValue, zones, tanks]);

  const getEditOverlayStyle = useCallback((): React.CSSProperties => {
    if (!editingId || !svgRef.current || !containerRef.current) return { display: "none" };
    const zone = zones.find(z => z.id === editingId);
    const tank = tanks.find(t => t.id === editingId);
    if (!zone && !tank) return { display: "none" };

    const svgRect = svgRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    let svgX: number, svgY: number, svgW: number;
    if (zone) {
      svgX = zone.x;
      svgY = editingField === "sublabel" ? zone.y + zone.h / 2 + 2 : zone.y + (zone.sublabel ? zone.h / 2 - 14 : zone.h / 2 - 8);
      svgW = zone.w;
    } else {
      svgX = tank!.cx - tank!.r;
      svgY = editingField === "sublabel" ? tank!.cy + 2 : tank!.cy - 14;
      svgW = tank!.r * 2;
    }

    const scaleX = svgRect.width / SVG_WIDTH;
    const scaleY = svgRect.height / SVG_HEIGHT;
    const screenX = svgRect.left - containerRect.left + svgX * scaleX;
    const screenY = svgRect.top - containerRect.top + svgY * scaleY;
    const screenW = svgW * scaleX;

    return {
      position: "absolute" as const,
      left: screenX,
      top: screenY,
      width: Math.max(screenW, 60),
      zIndex: 50,
    };
  }, [editingId, editingField, zones, tanks]);

  const handleBgMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest("[data-zone]")) return;
    if (editMode) return; // Don't pan while editing, only drag zones
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan, editMode]);

  const handleSave = useCallback(() => {
    savePositions(zones, tanks);
    // Save current state as new defaults
    const zonePos: Record<string, any> = {};
    zones.forEach(z => { zonePos[z.id] = { x: z.x, y: z.y, w: z.w, h: z.h, label: z.label, sublabel: z.sublabel, details: z.details, type: z.type }; });
    const tankPos: Record<string, any> = {};
    tanks.forEach(t => { tankPos[t.id] = { cx: t.cx, cy: t.cy, r: t.r, label: t.label, sublabel: t.sublabel, details: t.details }; });
    localStorage.setItem(DEFAULTS_KEY, JSON.stringify({ zones: zonePos, tanks: tankPos }));
    setEditMode(false);
    setHasChanges(false);
    toast.success("Plattegrond opgeslagen als nieuwe standaard");
  }, [zones, tanks]);

  const handleReset = useCallback(() => {
    // Reset to saved defaults, or original hardcoded defaults
    const savedDefaults = localStorage.getItem(DEFAULTS_KEY);
    if (savedDefaults) {
      const defaults = JSON.parse(savedDefaults);
      const restored = applyPositions([...DEFAULT_ZONES], [...DEFAULT_BULK_TANKS], defaults);
      setZones(restored.zones);
      setTanks(restored.tanks);
    } else {
      setZones([...DEFAULT_ZONES]);
      setTanks([...DEFAULT_BULK_TANKS]);
    }
    localStorage.removeItem(STORAGE_KEY);
    setHasChanges(false);
    toast.info("Plattegrond teruggezet naar standaard");
  }, []);

  const handleCancel = useCallback(() => {
    const s = loadPositions();
    const restored = applyPositions([...DEFAULT_ZONES], [...DEFAULT_BULK_TANKS], s);
    setZones(restored.zones);
    setTanks(restored.tanks);
    setEditMode(false);
    setHasChanges(false);
  }, []);

  // Escape to exit edit mode
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && editMode) handleCancel();
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editMode, isFullscreen, handleCancel]);

  const selectedZoneData = zones.find(z => z.id === selectedZone);
  const selectedTankData = tanks.find(t => t.id === selectedZone);
  const filteredZones = filterType === "all" ? zones : zones.filter(z => z.type === filterType);
  const showTanks = filterType === "all" || filterType === "opslag_bulk";

  return (
    <Card className={cn(
      "glass-card w-full overflow-hidden transition-all duration-300",
      isFullscreen && "fixed inset-0 z-50 rounded-none h-screen w-screen bg-background/95 backdrop-blur-md",
      editMode && "ring-2 ring-primary/40",
      className
    )}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <MapPin className="h-4 w-4 text-primary" />
              Interactieve Plattegrond – SOL Emmen
              {editMode && (
                <Badge variant="default" className="text-[10px] ml-1 animate-pulse">
                  <GripVertical className="h-3 w-3 mr-0.5" />
                  Bewerkmodus
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="text-xs">
              {editMode
                ? "Sleep zones naar de gewenste positie • Dubbelklik op tekst om te bewerken • Klik op Opslaan als je klaar bent"
                : "Klik op een zone voor details • Scroll om te zoomen • Sleep om te pannen"
              }
            </CardDescription>
          </div>
          <div className="flex items-center gap-1">
            {/* Edit controls */}
            {editMode ? (
              <div className="flex items-center gap-1 bg-primary/10 p-1 rounded-md mr-2">
                <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={handleSave}>
                  <Save className="h-3 w-3" /> Opslaan
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={handleReset}>
                  <RotateCcw className="h-3 w-3" /> Reset
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={handleCancel}>
                  Annuleren
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mr-2">
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setEditMode(true)}>
                  <Pencil className="h-3 w-3" /> Indeling aanpassen
                </Button>
                <Button size="sm" variant={showInventory ? "default" : "outline"} className="h-7 text-xs gap-1" onClick={() => setShowInventory(v => !v)}>
                  {showInventory ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                  Voorraad
                </Button>
              </div>
            )}

            {/* Zoom controls */}
            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-md">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.max(z - 0.2, 0.5))}>
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <span className="w-10 text-center text-xs font-mono">{Math.round(zoom * 100)}%</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setZoom(z => Math.min(z + 0.2, 3))}>
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <div className="w-px h-4 bg-border mx-0.5" />
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }} title="Reset weergave">
                <Move className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setIsFullscreen(f => !f)}>
                {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Legend / Filter */}
        {!editMode && (
          <div className="flex flex-wrap gap-1.5 mt-3 items-center">
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
                <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: val.color }} />
                <EditableText
                  value={val.label}
                  onSave={(v) => handleZoneTypeLabelEdit(key, v)}
                  className="text-[10px]"
                  placeholder="Categorie..."
                />
              </Badge>
            ))}
            {/* Occupancy legend - only when inventory overlay is active */}
            {showInventory && (
              <>
                <span className="mx-1.5 text-muted-foreground text-[10px]">│</span>
                <span className="text-[10px] text-muted-foreground font-medium mr-1">Bezetting:</span>
                {[
                  { label: "< 60%", color: "hsl(140 60% 45%)" },
                  { label: "60–85%", color: "hsl(35 90% 50%)" },
                  { label: "> 85%", color: "hsl(0 80% 50%)" },
                ].map((item) => (
                  <span key={item.label} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
                    {item.label}
                  </span>
                ))}
              </>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 relative" ref={containerRef}>
        <div
          className={cn(
            "overflow-hidden select-none",
            editMode ? "cursor-default" : isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{ height: isFullscreen ? "calc(100vh - 160px)" : "clamp(350px, calc(100vh - 320px), 800px)" }}
          onMouseDown={handleBgMouseDown}
          onMouseMove={handleSvgMouseMove}
          onMouseUp={handleSvgMouseUp}
          onMouseLeave={handleSvgMouseUp}
          onWheel={(e) => {
            const delta = -e.deltaY * 0.001;
            setZoom(z => Math.min(Math.max(z + delta, 0.5), 3));
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`${canvasOffsetX} ${canvasOffsetY} ${SVG_WIDTH - canvasOffsetX} ${SVG_HEIGHT - canvasOffsetY}`}
            className="w-full h-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: (isPanning || draggingId) ? "none" : "transform 0.15s ease-out",
            }}
          >
            {/* Background */}
            <rect x={canvasOffsetX} y={canvasOffsetY} width={SVG_WIDTH - canvasOffsetX} height={SVG_HEIGHT - canvasOffsetY} fill="hsl(var(--background))" rx="8" />

            {/* Site perimeter – hekwerk */}
            <rect x={canvasOffsetX + 8} y={canvasOffsetY + 8} width={SVG_WIDTH - canvasOffsetX - 16} height={SVG_HEIGHT - canvasOffsetY - 16} rx="6" fill="none" stroke="hsl(var(--foreground) / 0.25)" strokeWidth="2" strokeDasharray="10 4 2 4" />
            {/* Fence post markers */}
            {Array.from({ length: Math.floor((SVG_WIDTH - canvasOffsetX - 16) / 60) + 1 }, (_, i) => canvasOffsetX + 8 + i * 60).map(x => (
              <g key={`fp-t${x}`}>
                <circle cx={Math.min(x, SVG_WIDTH - 8)} cy={canvasOffsetY + 8} r="3" fill="hsl(var(--foreground) / 0.2)" />
                <circle cx={Math.min(x, SVG_WIDTH - 8)} cy={SVG_HEIGHT - 8} r="3" fill="hsl(var(--foreground) / 0.2)" />
              </g>
            ))}
            {Array.from({ length: Math.floor((SVG_HEIGHT - canvasOffsetY - 16) / 60) + 1 }, (_, i) => canvasOffsetY + 8 + i * 60).map(y => (
              <g key={`fp-l${y}`}>
                <circle cx={canvasOffsetX + 8} cy={Math.min(y, SVG_HEIGHT - 8)} r="3" fill="hsl(var(--foreground) / 0.2)" />
                <circle cx={SVG_WIDTH - 8} cy={Math.min(y, SVG_HEIGHT - 8)} r="3" fill="hsl(var(--foreground) / 0.2)" />
              </g>
            ))}
            <text x="20" y="22" fill="hsl(var(--foreground) / 0.2)" fontSize="7" fontWeight="600" letterSpacing="1.5">TERREINGRENS</text>

            {/* Buitenterrein – bulktanks area */}
            <rect x="15" y="40" width={SVG_WIDTH - 30} height={terrainHeight} rx="4" fill="hsl(var(--muted) / 0.08)" stroke="hsl(var(--border) / 0.4)" strokeWidth="1" strokeDasharray="6 3" />
            <text x={SVG_WIDTH / 2} y="57" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="700" letterSpacing="2" opacity="0.3">BUITENTERREIN – BULKTANKS</text>

            {/* Terrain resize handle (edit mode only) */}
            {editMode && (
              <g
                className="cursor-ns-resize"
                onMouseDown={(e) => { e.stopPropagation(); setResizingTerrain(true); }}
              >
                {/* Invisible wide hit area */}
                <rect x="15" y={40 + terrainHeight - 10} width={SVG_WIDTH - 30} height={20} fill="transparent" />
                {/* Visible pill handle */}
                <rect x={SVG_WIDTH / 2 - 40} y={40 + terrainHeight - 4} width={80} height={8} rx="4" fill="hsl(var(--primary) / 0.6)" />
                <line x1={SVG_WIDTH / 2 - 15} y1={40 + terrainHeight - 1} x2={SVG_WIDTH / 2 + 15} y2={40 + terrainHeight - 1} stroke="hsl(var(--primary-foreground))" strokeWidth="1" opacity="0.8" />
                <line x1={SVG_WIDTH / 2 - 15} y1={40 + terrainHeight + 1.5} x2={SVG_WIDTH / 2 + 15} y2={40 + terrainHeight + 1.5} stroke="hsl(var(--primary-foreground))" strokeWidth="1" opacity="0.8" />
              </g>
            )}

            {/* Main building - hele overdekte gebied */}
            <rect x="20" y={40 + terrainHeight} width={Math.min(buildingWidth, SVG_WIDTH - 40)} height={buildingHeight} rx="5" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
            <text x="35" y={40 + terrainHeight - 2} fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="600" opacity="0.5">PRODUCTIEHAL</text>

            {/* Building resize handles (edit mode only) */}
            {editMode && (
              <>
                {/* Right edge */}
                <g className="cursor-ew-resize" onMouseDown={(e) => {
                  e.stopPropagation(); e.preventDefault();
                  buildingResizeStart.current = { clientX: e.clientX, clientY: e.clientY, w: buildingWidth, h: buildingHeight };
                  setResizingBuilding("right");
                }}>
                  <rect x={20 + Math.min(buildingWidth, SVG_WIDTH - 40) - 6} y={40 + terrainHeight + buildingHeight / 2 - 30} width={12} height={60} fill="transparent" />
                  <rect x={20 + Math.min(buildingWidth, SVG_WIDTH - 40) - 2} y={40 + terrainHeight + buildingHeight / 2 - 20} width={4} height={40} rx="2" fill="hsl(var(--primary) / 0.5)" />
                </g>
                {/* Bottom edge */}
                <g className="cursor-ns-resize" onMouseDown={(e) => {
                  e.stopPropagation(); e.preventDefault();
                  buildingResizeStart.current = { clientX: e.clientX, clientY: e.clientY, w: buildingWidth, h: buildingHeight };
                  setResizingBuilding("bottom");
                }}>
                  <rect x={20 + Math.min(buildingWidth, SVG_WIDTH - 40) / 2 - 30} y={40 + terrainHeight + buildingHeight - 6} width={60} height={12} fill="transparent" />
                  <rect x={20 + Math.min(buildingWidth, SVG_WIDTH - 40) / 2 - 20} y={40 + terrainHeight + buildingHeight - 2} width={40} height={4} rx="2" fill="hsl(var(--primary) / 0.5)" />
                </g>
                {/* Corner */}
                <g className="cursor-nwse-resize" onMouseDown={(e) => {
                  e.stopPropagation(); e.preventDefault();
                  buildingResizeStart.current = { clientX: e.clientX, clientY: e.clientY, w: buildingWidth, h: buildingHeight };
                  setResizingBuilding("corner");
                }}>
                  <rect x={20 + Math.min(buildingWidth, SVG_WIDTH - 40) - 10} y={40 + terrainHeight + buildingHeight - 10} width={16} height={16} fill="transparent" />
                  <rect x={20 + Math.min(buildingWidth, SVG_WIDTH - 40) - 5} y={40 + terrainHeight + buildingHeight - 5} width={8} height={8} rx="2" fill="hsl(var(--primary) / 0.7)" stroke="hsl(var(--background))" strokeWidth="1" />
                </g>
              </>
            )}

            {/* Medical bunker */}
            <rect x="110" y="645" width={550} height={72} rx="4" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
            <text x="115" y="643" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="600" opacity="0.5">CILINDERBUNKER – MEDISCHE GASSEN</text>

            {/* Office wing */}
            <rect x="330" y="730" width={320} height={58} rx="4" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />

            {/* Logistics strip */}
            <rect x="20" y="555" width={420} height={100} rx="4" fill="hsl(var(--muted) / 0.1)" stroke="hsl(var(--border) / 0.3)" strokeWidth="1" strokeDasharray="4 4" />
            <text x="35" y="553" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="600" opacity="0.5">LOGISTIEK & SCHOONMAAK</text>

            {/* Vivisol wing */}
            <rect x="585" y="555" width={310} height={55} rx="4" fill="hsl(var(--muted) / 0.1)" stroke="hsl(var(--border) / 0.3)" strokeWidth="1" strokeDasharray="4 4" />
            <text x="600" y="553" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="600" opacity="0.5">VIVISOL</text>

            {/* Showroom – curved path with draggable endpoints */}
            {(() => {
              const sr = zones.find(z => z.id === "showroom");
              const startZone = zones.find(z => z.id === "showroom_start");
              const endZone = zones.find(z => z.id === "showroom_end");
              if (!sr) return null;
              const defaultStart = { x: 630, y: 750, w: 10, h: 10 };
              const defaultEnd = { x: 848, y: 595, w: 10, h: 10 };
              const sz = startZone || defaultStart;
              const ez = endZone || defaultEnd;
              const sx = sz.x + sz.w / 2;
              const sy = sz.y + sz.h / 2;
              const ex = ez.x + ez.w / 2;
              const ey = ez.y + ez.h / 2;
              const cx = sr.x + sr.w / 2;
              const cy = sr.y + sr.h / 2;
              const d = `M ${sx} ${sy} C ${cx} ${sy} ${ex} ${cy} ${ex} ${ey}`;
              const mx = (sx + ex) / 2;
              const my = (sy + ey) / 2;
              const angle = Math.atan2(ey - sy, ex - sx) * (180 / Math.PI);
              return (
                <g>
                  <path d={d} fill="none" stroke="hsl(40 70% 50% / 0.12)" strokeWidth="44" strokeLinecap="round" />
                  <path d={d} fill="none" stroke="hsl(40 70% 50% / 0.35)" strokeWidth="1" strokeDasharray="6 4" strokeLinecap="round" />
                  <text x={mx} y={my} textAnchor="middle" fill="hsl(40 70% 50% / 0.5)" fontSize="8" fontWeight="700" letterSpacing="3" transform={`rotate(${angle}, ${mx}, ${my})`}>SHOWROOM</text>
                </g>
              );
            })()}

            {/* Grid (edit mode only) */}
            {editMode && (
              <>
                {Array.from({ length: Math.floor(SVG_WIDTH / GRID_SNAP) }, (_, i) => (i + 1) * GRID_SNAP).filter(x => x % 50 === 0).map(x => (
                  <line key={`eg${x}`} x1={x} y1="0" x2={x} y2={SVG_HEIGHT} stroke="hsl(var(--primary) / 0.08)" strokeWidth="0.5" />
                ))}
                {Array.from({ length: Math.floor(SVG_HEIGHT / GRID_SNAP) }, (_, i) => (i + 1) * GRID_SNAP).filter(y => y % 50 === 0).map(y => (
                  <line key={`egh${y}`} x1="0" y1={y} x2={SVG_WIDTH} y2={y} stroke="hsl(var(--primary) / 0.08)" strokeWidth="0.5" />
                ))}
              </>
            )}

            {/* Alignment guide lines */}
            {draggingId && alignGuides.x !== null && (
              <line x1={alignGuides.x} y1="0" x2={alignGuides.x} y2={SVG_HEIGHT} stroke="hsl(var(--primary))" strokeWidth="0.75" strokeDasharray="4 3" opacity="0.6" />
            )}
            {draggingId && alignGuides.y !== null && (
              <line x1="0" y1={alignGuides.y} x2={SVG_WIDTH} y2={alignGuides.y} stroke="hsl(var(--primary))" strokeWidth="0.75" strokeDasharray="4 3" opacity="0.6" />
            )}

            {/* Bulk tanks */}
            {showTanks && tanks.map((tank) => {
              const isSelected = selectedZone === tank.id;
              const isHovered = hoveredZone === tank.id;
              const isDragging = draggingId === tank.id;
              const tc = ZONE_TYPES.opslag_bulk;
              return (
                <g
                  key={tank.id}
                  data-zone={tank.id}
                  className={editMode ? "cursor-grab" : "cursor-pointer"}
                  style={{ opacity: isDragging ? 0.7 : 1 }}
                  onClick={(e) => { if (!editMode) { e.stopPropagation(); setSelectedZone(s => s === tank.id ? null : tank.id); } }}
                  onMouseDown={(e) => handleTankDragStart(e, tank.id)}
                  onMouseEnter={() => setHoveredZone(tank.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                >
                  <circle cx={tank.cx} cy={tank.cy} r={tank.r} fill={tc.bg}
                    stroke={isDragging ? tc.color : isSelected ? tc.color : isHovered ? tc.border : "hsl(var(--border) / 0.5)"}
                    strokeWidth={isDragging ? 3 : isSelected ? 2.5 : isHovered ? 2 : 1}
                    style={{ transition: isDragging ? "none" : "all 0.15s ease", filter: isHovered ? `drop-shadow(0 2px 8px ${tc.color}40)` : "none" }}
                  />
                  <circle cx={tank.cx} cy={tank.cy} r={tank.r * 0.55} fill="none" stroke={tc.border} strokeWidth="0.5" strokeDasharray="3 2" />
                  <text x={tank.cx} y={tank.cy - 3} textAnchor="middle" dominantBaseline="middle" fill={tc.color} fontSize="9" fontWeight="700"
                    style={{ pointerEvents: editMode ? "auto" : "none", cursor: editMode ? "text" : "default" }}
                    onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit(tank.id, "label", tank.label); }}
                  >{tank.label}</text>
                  <text x={tank.cx} y={tank.cy + 9} textAnchor="middle" dominantBaseline="middle" fill="hsl(var(--muted-foreground))" fontSize="6.5"
                    style={{ pointerEvents: editMode ? "auto" : "none", cursor: editMode ? "text" : "default" }}
                    onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit(tank.id, "sublabel", tank.sublabel || ""); }}
                  >{tank.sublabel}</text>
                  {editMode && <circle cx={tank.cx} cy={tank.cy - tank.r - 6} r="4" fill="hsl(var(--primary))" opacity="0.6"><title>Sleep om te verplaatsen</title></circle>}
                  {/* Tank inventory fill arc */}
                  {showInventory && !editMode && (() => {
                    const inv = getTankInventory(tank.id);
                    if (!inv) return null;
                    const col = getOccupancyColor(inv.pct);
                    const fillR = tank.r - 2;
                    const fillAngle = (inv.pct / 100) * 360;
                    const rad = (a: number) => ((a - 90) * Math.PI) / 180;
                    const x1 = tank.cx + fillR * Math.cos(rad(0));
                    const y1 = tank.cy + fillR * Math.sin(rad(0));
                    const x2 = tank.cx + fillR * Math.cos(rad(fillAngle));
                    const y2 = tank.cy + fillR * Math.sin(rad(fillAngle));
                    const largeArc = fillAngle > 180 ? 1 : 0;
                    if (inv.pct <= 0) return null;
                    if (inv.pct >= 100) {
                      return <circle cx={tank.cx} cy={tank.cy} r={fillR} fill={`${col}33`} stroke="none" />;
                    }
                    return (
                      <path d={`M ${tank.cx} ${tank.cy} L ${x1} ${y1} A ${fillR} ${fillR} 0 ${largeArc} 1 ${x2} ${y2} Z`} fill={`${col}33`} stroke="none" />
                    );
                  })()}
                </g>
              );
            })}

            {/* Zones */}
            {filteredZones.filter(z => !z.id.startsWith("showroom")).map((zone) => {
              const zt = ZONE_TYPES[zone.type];
              const isSelected = selectedZone === zone.id;
              const isHovered = hoveredZone === zone.id;
              const isDragging = draggingId === zone.id;
              const dimmed = filterType !== "all" && zone.type !== filterType;
              const rot = zone.rotation || 0;
              const cx = zone.x + zone.w / 2;
              const cy = zone.y + zone.h / 2;

              return (
                <g
                  key={zone.id}
                  data-zone={zone.id}
                  transform={rot ? `rotate(${rot} ${cx} ${cy})` : undefined}
                  className={editMode ? "cursor-grab" : "cursor-pointer"}
                  style={{ opacity: dimmed ? 0.25 : isDragging ? 0.7 : 1 }}
                  onClick={(e) => { if (!editMode) { e.stopPropagation(); setSelectedZone(s => s === zone.id ? null : zone.id); } }}
                  onContextMenu={(e) => {
                    if (!editMode) return;
                    e.preventDefault();
                    e.stopPropagation();
                    const container = containerRef.current;
                    if (!container) return;
                    const cr = container.getBoundingClientRect();
                    setContextMenu({ zoneId: zone.id, screenX: e.clientX - cr.left, screenY: e.clientY - cr.top });
                  }}
                  onMouseDown={(e) => handleZoneDragStart(e, zone.id)}
                  onMouseEnter={() => setHoveredZone(zone.id)}
                  onMouseLeave={() => setHoveredZone(null)}
                >
                  <rect
                    x={zone.x} y={zone.y} width={zone.w} height={zone.h} rx="4"
                    fill={zt.bg}
                    stroke={isDragging ? zt.color : isSelected ? zt.color : isHovered ? zt.border : "hsl(var(--border) / 0.5)"}
                    strokeWidth={isDragging ? 3 : isSelected ? 2.5 : isHovered ? 2 : 1}
                    style={{ transition: isDragging ? "none" : "all 0.15s ease", filter: isHovered ? `drop-shadow(0 2px 8px ${zt.color}40)` : "none" }}
                  />
                  <text
                    x={zone.x + zone.w / 2}
                    y={zone.y + (zone.sublabel ? zone.h / 2 - 5 : zone.h / 2 + 1)}
                    textAnchor="middle" dominantBaseline="middle"
                    fill={zt.color} fontSize={zone.w < 80 ? 9 : 10} fontWeight="600"
                    style={{ pointerEvents: editMode ? "auto" : "none", cursor: editMode ? "text" : "default" }}
                    onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit(zone.id, "label", zone.label); }}
                  >{zone.label}</text>
                  {zone.sublabel && (
                    <text
                      x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 + 9}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="hsl(var(--muted-foreground))" fontSize={zone.w < 80 ? 7 : 8}
                      style={{ pointerEvents: editMode ? "auto" : "none", cursor: editMode ? "text" : "default" }}
                      onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit(zone.id, "sublabel", zone.sublabel || ""); }}
                    >{zone.sublabel}</text>
                  )}
                  {editMode && !zone.sublabel && (
                    <text
                      x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 + 9}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="hsl(var(--muted-foreground))" fontSize={zone.w < 80 ? 6 : 7} opacity="0.3"
                      style={{ pointerEvents: "auto", cursor: "text" }}
                      onDoubleClick={(e) => { e.stopPropagation(); handleStartEdit(zone.id, "sublabel", ""); }}
                    >+ sublabel</text>
                  )}
                  {/* Edit mode: drag indicator */}
                  {editMode && (
                    <g style={{ pointerEvents: "none" }}>
                      <rect x={zone.x + zone.w / 2 - 8} y={zone.y + 2} width="16" height="8" rx="3" fill="hsl(var(--primary))" opacity="0.4" />
                      <line x1={zone.x + zone.w / 2 - 3} y1={zone.y + 4.5} x2={zone.x + zone.w / 2 + 3} y2={zone.y + 4.5} stroke="hsl(var(--primary-foreground))" strokeWidth="1" opacity="0.6" />
                      <line x1={zone.x + zone.w / 2 - 3} y1={zone.y + 7} x2={zone.x + zone.w / 2 + 3} y2={zone.y + 7} stroke="hsl(var(--primary-foreground))" strokeWidth="1" opacity="0.6" />
                    </g>
                  )}
                  {/* Edit mode: corner resize handles */}
                  {editMode && (isSelected || isHovered) && (
                    <>
                      {(["nw", "ne", "sw", "se"] as const).map(corner => {
                        const hx = corner.includes("w") ? zone.x : zone.x + zone.w;
                        const hy = corner.includes("n") ? zone.y : zone.y + zone.h;
                        const cursorMap = { nw: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize", se: "nwse-resize" };
                        return (
                          <g key={corner}>
                            <rect
                              x={hx - 6} y={hy - 6} width={12} height={12}
                              fill="transparent" style={{ cursor: cursorMap[corner] }}
                              onMouseDown={(e) => {
                                e.stopPropagation();
                                e.preventDefault();
                                resizeZoneStart.current = { x: zone.x, y: zone.y, w: zone.w, h: zone.h };
                                setResizingZoneId(zone.id);
                                setResizingCorner(corner);
                              }}
                            />
                            <rect
                              x={hx - 3} y={hy - 3} width={6} height={6} rx="1"
                              fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="1"
                              style={{ pointerEvents: "none" }}
                            />
                          </g>
                        );
                      })}
                    </>
                  )}
                  {/* Edit mode: rotation handle */}
                  {editMode && (isSelected || isHovered) && (
                    <g>
                      <line
                        x1={cx} y1={zone.y - 4} x2={cx} y2={zone.y - 20}
                        stroke="hsl(var(--primary) / 0.4)" strokeWidth="1.5"
                        style={{ pointerEvents: "none" }}
                      />
                      <circle
                        cx={cx} cy={zone.y - 22} r="5"
                        fill="hsl(var(--primary))" stroke="hsl(var(--background))" strokeWidth="1.5"
                        style={{ cursor: "grab" }}
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          const svgPt = toSVG(e);
                          if (!svgPt) return;
                          const angle = Math.atan2(svgPt.y - cy, svgPt.x - cx) * (180 / Math.PI);
                          rotateZoneStart.current = { angle, rotation: zone.rotation || 0 };
                          setRotatingZoneId(zone.id);
                        }}
                      />
                      {/* Rotation degree indicator */}
                      {rot !== 0 && (
                        <text
                          x={cx + 10} y={zone.y - 22}
                          fill="hsl(var(--primary))" fontSize="7" fontWeight="600"
                          dominantBaseline="middle"
                        >{rot}°</text>
                      )}
                    </g>
                  )}
                  {!editMode && isSelected && <circle cx={zone.x + zone.w - 8} cy={zone.y + 8} r="4" fill={zt.color} />}
                  {/* Inventory occupancy bar */}
                  {showInventory && !editMode && (() => {
                    const inv = getZoneInventory(zone.id);
                    if (!inv) return null;
                    const barW = zone.w - 8;
                    const fillW = Math.min((inv.pct / 100) * barW, barW);
                    const col = getOccupancyColor(inv.pct);
                    return (
                      <g>
                        <rect x={zone.x + 4} y={zone.y + zone.h - 8} width={barW} height={4} rx="2" fill="hsl(var(--muted) / 0.3)" />
                        <rect x={zone.x + 4} y={zone.y + zone.h - 8} width={fillW} height={4} rx="2" fill={col} />
                        <text x={zone.x + zone.w - 4} y={zone.y + zone.h - 10} textAnchor="end" fill={col} fontSize="6" fontWeight="700">{inv.pct}%</text>
                      </g>
                    );
                  })()}
                  {zone.type === "opslag_brandbaar" && zone.id !== "buiten_brandbaar" && (
                    <g>
                      <image href="/ghs/GHS02.svg" x={zone.x + zone.w - 18} y={zone.y + 2} width="16" height="16" opacity="0.7" />
                    </g>
                  )}
                </g>
              );
            })}

            {/* Section labels - binnen het kader */}
            <text x="85" y="165" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="700" letterSpacing="1" opacity="0.4">DROOGIJS</text>
            <text x="215" y="165" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="700" letterSpacing="1" opacity="0.4">VULSTATIONS</text>
            <text x="730" y="165" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="700" letterSpacing="1" opacity="0.4">PALLETS 16 CIL</text>

            {/* Showroom arc drag handles – rendered last so they're on top */}
            {editMode && (() => {
              const startZone = zones.find(z => z.id === "showroom_start");
              const endZone = zones.find(z => z.id === "showroom_end");
              const defaultStart = { x: 630, y: 750, w: 10, h: 10 };
              const defaultEnd = { x: 848, y: 595, w: 10, h: 10 };
              const sz = startZone || defaultStart;
              const ez = endZone || defaultEnd;
              const sx = sz.x + sz.w / 2;
              const sy = sz.y + sz.h / 2;
              const ex = ez.x + ez.w / 2;
              const ey = ez.y + ez.h / 2;
              return (
                <g>
                  <circle cx={sx} cy={sy} r="8" fill="hsl(40 70% 50%)" opacity="0.8" stroke="#fff" strokeWidth="2"
                    className="cursor-grab" onMouseDown={(e) => handleZoneDragStart(e, "showroom_start")}>
                    <title>Sleep: startpunt boog (Entrée-zijde)</title>
                  </circle>
                  <circle cx={ex} cy={ey} r="8" fill="hsl(40 70% 50%)" opacity="0.8" stroke="#fff" strokeWidth="2"
                    className="cursor-grab" onMouseDown={(e) => handleZoneDragStart(e, "showroom_end")}>
                    <title>Sleep: eindpunt boog (Kantoor-zijde)</title>
                  </circle>
                </g>
              );
            })()}

            {/* Canvas resize handles (edit mode) */}
            {editMode && (
              <>
                {/* Left edge */}
                <g className="cursor-ew-resize" onMouseDown={(e) => { e.stopPropagation(); resizeStartRef.current = { clientX: e.clientX, clientY: e.clientY, offsetX: canvasOffsetX, offsetY: canvasOffsetY }; setResizingCanvas("left"); }}>
                  <rect x={canvasOffsetX} y={SVG_HEIGHT / 2 - 30} width={12} height={60} fill="transparent" />
                  <rect x={canvasOffsetX + 2} y={SVG_HEIGHT / 2 - 20} width={4} height={40} rx="2" fill="hsl(var(--primary) / 0.5)" />
                </g>
                {/* Top edge */}
                <g className="cursor-ns-resize" onMouseDown={(e) => { e.stopPropagation(); resizeStartRef.current = { clientX: e.clientX, clientY: e.clientY, offsetX: canvasOffsetX, offsetY: canvasOffsetY }; setResizingCanvas("top"); }}>
                  <rect x={SVG_WIDTH / 2 - 30} y={canvasOffsetY} width={60} height={12} fill="transparent" />
                  <rect x={SVG_WIDTH / 2 - 20} y={canvasOffsetY + 2} width={40} height={4} rx="2" fill="hsl(var(--primary) / 0.5)" />
                </g>
                {/* Right edge */}
                <g className="cursor-ew-resize" onMouseDown={(e) => { e.stopPropagation(); setResizingCanvas("right"); }}>
                  <rect x={SVG_WIDTH - 12} y={SVG_HEIGHT / 2 - 30} width={12} height={60} fill="transparent" />
                  <rect x={SVG_WIDTH - 6} y={SVG_HEIGHT / 2 - 20} width={4} height={40} rx="2" fill="hsl(var(--primary) / 0.5)" />
                </g>
                {/* Bottom edge */}
                <g className="cursor-ns-resize" onMouseDown={(e) => { e.stopPropagation(); setResizingCanvas("bottom"); }}>
                  <rect x={SVG_WIDTH / 2 - 30} y={SVG_HEIGHT - 12} width={60} height={12} fill="transparent" />
                  <rect x={SVG_WIDTH / 2 - 20} y={SVG_HEIGHT - 6} width={40} height={4} rx="2" fill="hsl(var(--primary) / 0.5)" />
                </g>
                {/* Corner bottom-right */}
                <g className="cursor-nwse-resize" onMouseDown={(e) => { e.stopPropagation(); setResizingCanvas("corner"); }}>
                  <rect x={SVG_WIDTH - 16} y={SVG_HEIGHT - 16} width={16} height={16} fill="transparent" />
                  <path d={`M${SVG_WIDTH - 4} ${SVG_HEIGHT - 12} L${SVG_WIDTH - 4} ${SVG_HEIGHT - 4} L${SVG_WIDTH - 12} ${SVG_HEIGHT - 4}`} fill="none" stroke="hsl(var(--primary) / 0.6)" strokeWidth="2" strokeLinecap="round" />
                  <path d={`M${SVG_WIDTH - 4} ${SVG_HEIGHT - 7} L${SVG_WIDTH - 4} ${SVG_HEIGHT - 4} L${SVG_WIDTH - 7} ${SVG_HEIGHT - 4}`} fill="none" stroke="hsl(var(--primary) / 0.6)" strokeWidth="2" strokeLinecap="round" />
                </g>
              </>
            )}
          </svg>
        </div>

        {/* Detail panel */}
        {(selectedZoneData || selectedTankData) && (() => {
          const item = selectedZoneData || selectedTankData;
          const isZone = !!selectedZoneData;
          const color = selectedZoneData ? ZONE_TYPES[selectedZoneData.type].color : ZONE_TYPES.opslag_bulk.color;
          const typeLabel = selectedZoneData ? ZONE_TYPES[selectedZoneData.type].label : ZONE_TYPES.opslag_bulk.label;

          const handleDetailEdit = (field: "label" | "sublabel" | "details", value: string) => {
            const updatedZones = isZone
              ? zones.map(z => z.id === selectedZone ? { ...z, [field]: value || undefined } : z)
              : zones;
            const updatedTanks = !isZone
              ? tanks.map(t => t.id === selectedZone ? { ...t, [field]: value || undefined } : t)
              : tanks;
            if (isZone) setZones(updatedZones);
            else setTanks(updatedTanks);
            savePositions(updatedZones, updatedTanks);
            toast.success("Tekst bijgewerkt");
          };

          return (
            <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-80 bg-background/95 backdrop-blur-md border rounded-lg p-3 shadow-lg animate-in slide-in-from-bottom-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                    <EditableText
                      value={item?.label || ""}
                      onSave={(v) => handleDetailEdit("label", v)}
                      className="font-semibold text-sm"
                      placeholder="Label..."
                    />
                  </div>
                  <div className="ml-4.5">
                    <EditableText
                      value={item?.sublabel || ""}
                      onSave={(v) => handleDetailEdit("sublabel", v)}
                      className="text-xs text-muted-foreground"
                      placeholder="+ sublabel toevoegen"
                    />
                  </div>
                </div>
                <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: color, color }}>
                  {typeLabel}
                </Badge>
              </div>
              <div className="mt-2 flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                <EditableText
                  value={(selectedZoneData as FloorZone)?.details || (selectedTankData as BulkTank)?.details || ""}
                  onSave={(v) => handleDetailEdit("details", v)}
                  className="text-xs text-muted-foreground"
                  placeholder="+ details toevoegen"
                />
              </div>
              {/* Inventory info in detail panel */}
              {showInventory && (() => {
                const inv = isZone && selectedZone ? getZoneInventory(selectedZone) : (!isZone && selectedZone ? getTankInventory(selectedZone) : null);
                if (!inv) return null;
                const col = getOccupancyColor(inv.pct);
                return (
                  <div className="mt-2 p-2 rounded-md border" style={{ borderColor: `${col}40` }}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Bezetting</span>
                      <span className="font-bold" style={{ color: col }}>{inv.pct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'hsl(var(--muted) / 0.3)' }}>
                      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(inv.pct, 100)}%`, backgroundColor: col }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                      <span>{Math.round(inv.current)} kg</span>
                      <span>max {Math.round(inv.max)} kg</span>
                    </div>
                  </div>
                );
              })()}
              <Button variant="ghost" size="sm" className="mt-2 w-full text-xs h-7" onClick={() => setSelectedZone(null)}>
                Sluiten
              </Button>
            </div>
          );
        })()}

        {/* Hover tooltip */}
        {hoveredZone && !selectedZone && !draggingId && (() => {
          const zone = zones.find(z => z.id === hoveredZone);
          const tank = tanks.find(t => t.id === hoveredZone);
          const label = zone?.label || tank?.label;
          const sublabel = zone?.sublabel || tank?.sublabel;
          if (!label) return null;
          return (
            <div className="absolute top-2 left-2 bg-background/90 backdrop-blur-sm border rounded-md px-2.5 py-1.5 text-xs shadow pointer-events-none">
              <span className="font-medium">{label}</span>
              {sublabel && <span className="text-muted-foreground ml-1.5">{sublabel}</span>}
              {editMode && <span className="text-primary ml-2">⟵ Sleep</span>}
            </div>
          );
        })()}

        {/* Inline text editor overlay */}
        {editMode && editingId && (
          <div style={getEditOverlayStyle()}>
            <input
              autoFocus
              className="w-full bg-background border border-primary rounded px-1.5 py-0.5 text-xs text-center shadow-lg outline-none focus:ring-1 focus:ring-primary"
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              onBlur={handleFinishEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleFinishEdit();
                if (e.key === "Escape") { setEditingId(null); setEditingField(null); }
              }}
              placeholder={editingField === "sublabel" ? "Sublabel..." : "Label..."}
            />
          </div>
        )}

        {/* Unsaved changes indicator */}
        {editMode && hasChanges && (
          <div className="absolute bottom-2 left-2 text-[10px] text-muted-foreground bg-background/80 rounded px-2 py-1">
            Niet-opgeslagen wijzigingen
          </div>
        )}
      </CardContent>
    </Card>
  );
}
