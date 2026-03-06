import { useState, useCallback, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, ZoomIn, ZoomOut, Move, Maximize2, Minimize2, Info, Pencil, Save, RotateCcw, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  { id: "tank_lin", cx: 95, cy: 95, r: 28, label: "LIN", sublabel: "N₂ vloeibaar", details: "Vloeibare stikstof tank – 32.000 kg" },
  { id: "tank_lox", cx: 160, cy: 95, r: 28, label: "LOX", sublabel: "O₂ vloeibaar", details: "Vloeibare zuurstof tank – 30.000 kg" },
  { id: "tank_lar", cx: 225, cy: 95, r: 22, label: "LAR", sublabel: "Ar vloeibaar", details: "Vloeibaar argon tank – 12.000 kg" },
  { id: "tank_lco2_1", cx: 285, cy: 95, r: 28, label: "LCO₂", sublabel: "CO₂ vloeibaar", details: "Vloeibaar CO₂ tank 1 – 22.000 kg" },
  { id: "tank_lco2_2", cx: 350, cy: 95, r: 28, label: "LCO₂", sublabel: "CO₂ vloeibaar", details: "Vloeibaar CO₂ tank 2 – 22.000 kg" },
];

const DEFAULT_ZONES: FloorZone[] = [
  { id: "droogijs1", x: 30, y: 160, w: 110, h: 100, label: "Droogijs", sublabel: "Productie", type: "opslag_droogijs", details: "Droogijsproductie-installatie" },
  { id: "droogijs_cont", x: 30, y: 268, w: 110, h: 80, label: "Droogijs", sublabel: "Containers (schoon)", type: "opslag_droogijs", details: "Schone droogijs containers" },
  { id: "vs3a", x: 30, y: 356, w: 110, h: 42, label: "Vulstation 3A", sublabel: "Trolley 40x", type: "vulstation", details: "Trolley vulstation, 40 posities" },
  { id: "vs3b", x: 30, y: 404, w: 110, h: 42, label: "Vulstation 3B", sublabel: "Trolley 40x", type: "vulstation", details: "Trolley vulstation, 40 posities" },
  { id: "opslag_ruimte", x: 30, y: 452, w: 110, h: 42, label: "Opslag ruimte", type: "logistiek" },
  { id: "boiler", x: 30, y: 500, w: 110, h: 35, label: "Boiler ruimte", type: "technisch" },
  { id: "non_conform", x: 150, y: 160, w: 100, h: 42, label: "Non conform", type: "logistiek", details: "Non-conforme cilinders" },
  { id: "vs4a", x: 150, y: 208, w: 130, h: 42, label: "Vulstation 4A", sublabel: "O₂ 300B Trolley", type: "vulstation", details: "Zuurstof 300 bar trolley vulstation" },
  { id: "vs4b", x: 150, y: 256, w: 130, h: 42, label: "Vulstation 4B", sublabel: "O₂ 300B Pakket", type: "vulstation", details: "Zuurstof 300 bar pakket vulstation" },
  { id: "vs1a", x: 150, y: 306, w: 130, h: 42, label: "Vulstation 1A", sublabel: "Zuurstof Rek 1", type: "vulstation", details: "Zuurstof vulrek 1" },
  { id: "vs1b", x: 150, y: 354, w: 130, h: 42, label: "Vulstation 1B", sublabel: "Zuurstof Rek 2", type: "vulstation", details: "Zuurstof vulrek 2" },
  { id: "vs2a", x: 150, y: 404, w: 130, h: 42, label: "Vulstation 2A", sublabel: "Trolley 26x", type: "vulstation", details: "Trolley vulstation, 26 posities" },
  { id: "vs2b", x: 150, y: 452, w: 130, h: 42, label: "Vulstation 2B", sublabel: "Pakket quarantaine", type: "vulstation", details: "Pakket vulstation met quarantaine zone" },
  { id: "co2_vulling", x: 290, y: 160, w: 90, h: 52, label: "CO₂ vulling", sublabel: "Pakket", type: "opslag_gas", details: "CO₂ vulstation (pakketvulling)" },
  { id: "ar_mix_trolley", x: 290, y: 220, w: 90, h: 46, label: "Ar-Mix", sublabel: "Trolley 200 Bar", type: "opslag_gas", details: "Argon/Mix trolleys 200 bar" },
  { id: "ar_mix_pakket", x: 290, y: 272, w: 90, h: 46, label: "Ar-Mix", sublabel: "Pakket 200 Bar", type: "opslag_gas", details: "Argon/Mix pakketten 200 bar" },
  { id: "ar_mix_300", x: 290, y: 324, w: 90, h: 46, label: "Ar-Mix", sublabel: "300 Bar pakket", type: "opslag_gas", details: "Argon/Mix pakketten 300 bar" },
  { id: "o2_trolley", x: 388, y: 160, w: 72, h: 52, label: "Zuurstof", sublabel: "Trolley", type: "opslag_gas" },
  { id: "o2_pakket", x: 388, y: 220, w: 72, h: 46, label: "Zuurstof", sublabel: "Pakket", type: "opslag_gas" },
  { id: "elektra", x: 468, y: 160, w: 72, h: 42, label: "Elektra", type: "technisch" },
  { id: "lab", x: 468, y: 208, w: 110, h: 52, label: "Laboratorium", type: "technisch", details: "Kwaliteitscontrole laboratorium" },
  { id: "ar_mix_300bar", x: 468, y: 268, w: 110, h: 42, label: "Argon/Mix", sublabel: "300 Bar", type: "opslag_gas" },
  { id: "ar_mix_200_du", x: 468, y: 316, w: 110, h: 42, label: "Argon/Mix", sublabel: "200 bar – DU", type: "opslag_gas", details: "Duitse specificatie" },
  { id: "ar_mix_200_nl", x: 468, y: 364, w: 110, h: 42, label: "Argon/Mix", sublabel: "200 bar – NL", type: "opslag_gas", details: "Nederlandse specificatie" },
  { id: "o2_16cil", x: 595, y: 160, w: 80, h: 65, label: "O₂", sublabel: "16 Cil · 300 bar", type: "opslag_gas", details: "Zuurstof 16 cilinder pallet, 300 bar" },
  { id: "n2_16cil", x: 680, y: 160, w: 80, h: 65, label: "N₂", sublabel: "16 Cil", type: "opslag_gas", details: "Stikstof 16 cilinder pallet" },
  { id: "o2_16cil_200a", x: 765, y: 160, w: 80, h: 65, label: "O₂", sublabel: "16 Cil · 200 bar", type: "opslag_gas", details: "Zuurstof 16 cilinder pallet, 200 bar" },
  { id: "o2_16cil_200b", x: 850, y: 160, w: 80, h: 65, label: "O₂", sublabel: "16 Cil · 200 bar", type: "opslag_gas" },
  { id: "voorraad", x: 850, y: 235, w: 120, h: 38, label: "Voorraad", type: "logistiek", details: "Voorraadopslag cilinders" },
  { id: "cil_vol", x: 850, y: 278, w: 120, h: 32, label: "Cilinders vol", type: "logistiek" },
  { id: "voeding", x: 850, y: 315, w: 120, h: 32, label: "Voeding", type: "technisch" },
  { id: "magazijn", x: 850, y: 440, w: 120, h: 55, label: "Magazijn", type: "logistiek" },
  { id: "wc_douche", x: 468, y: 440, w: 80, h: 38, label: "WC / Douche", type: "kantoor" },
  { id: "werkplaats", x: 555, y: 440, w: 120, h: 38, label: "Werkplaats", type: "technisch" },
  { id: "schoonmaak", x: 30, y: 545, w: 130, h: 38, label: "Schoonmaak", sublabel: "Cilinders", type: "technisch", details: "Chloortabletten, desinfectie spuit" },
  { id: "te_vullen", x: 168, y: 545, w: 110, h: 38, label: "Te Vullen", type: "logistiek" },
  { id: "retour_tilburg", x: 286, y: 545, w: 120, h: 38, label: "Retour Tilburg", type: "logistiek", details: "Cilinders retour naar Tilburg" },
  { id: "ontvangst", x: 30, y: 590, w: 80, h: 38, label: "Ontvangst", type: "logistiek" },
  { id: "vivisol_sluis", x: 595, y: 545, w: 110, h: 38, label: "Vivisol Sluis", type: "medisch" },
  { id: "vivisol_opslag", x: 710, y: 545, w: 90, h: 38, label: "Vivisol", sublabel: "Opslag", type: "medisch" },
  { id: "kantoor_vivisol", x: 808, y: 545, w: 80, h: 38, label: "Kantoor", type: "kantoor" },
  { id: "neophyr", x: 120, y: 635, w: 75, h: 58, label: "Neophyr", sublabel: "Argon MD", type: "medisch", details: "Neophyr / Argon medisch / Spec. Mengsels" },
  { id: "carbogeen_30", x: 200, y: 635, w: 65, h: 58, label: "Carbogeen", sublabel: "30", type: "medisch" },
  { id: "carbogeen_5", x: 270, y: 635, w: 65, h: 58, label: "Carbogeen", sublabel: "5", type: "medisch" },
  { id: "carbogeen_40", x: 340, y: 635, w: 65, h: 58, label: "Carbogeen", sublabel: "40", type: "medisch" },
  { id: "o2_med_200", x: 415, y: 635, w: 75, h: 58, label: "O₂ med.", sublabel: "200 bar", type: "medisch", details: "Medische zuurstof 200 bar" },
  { id: "o2_med_300", x: 495, y: 635, w: 75, h: 58, label: "O₂ med.", sublabel: "300 bar", type: "medisch", details: "Medische zuurstof 300 bar" },
  { id: "lucht_synth", x: 575, y: 635, w: 75, h: 58, label: "Lucht", sublabel: "Synth./Med.", type: "medisch", details: "Synthetische en medische lucht" },
  { id: "showroom", x: 595, y: 590, w: 130, h: 28, label: "Showroom", type: "kantoor" },
  { id: "kantoren", x: 340, y: 720, w: 300, h: 48, label: "K A N T O R E N", type: "kantoor", details: "Kantoorruimtes medewerkers" },
  { id: "entree", x: 540, y: 730, w: 90, h: 38, label: "Entrée", type: "kantoor" },
];

const STORAGE_KEY = "floorplan-positions";
const GRID_SNAP = 10;
const snap = (v: number) => Math.round(v / GRID_SNAP) * GRID_SNAP;

function loadPositions(): { zones: Record<string, { x: number; y: number }>; tanks: Record<string, { cx: number; cy: number }> } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function savePositions(zones: FloorZone[], tanks: BulkTank[]) {
  const zonePos: Record<string, { x: number; y: number }> = {};
  zones.forEach(z => { zonePos[z.id] = { x: z.x, y: z.y }; });
  const tankPos: Record<string, { cx: number; cy: number }> = {};
  tanks.forEach(t => { tankPos[t.id] = { cx: t.cx, cy: t.cy }; });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ zones: zonePos, tanks: tankPos }));
}

function applyPositions(zones: FloorZone[], tanks: BulkTank[], saved: ReturnType<typeof loadPositions>) {
  if (!saved) return { zones, tanks };
  const newZones = zones.map(z => saved.zones[z.id] ? { ...z, ...saved.zones[z.id] } : z);
  const newTanks = tanks.map(t => saved.tanks[t.id] ? { ...t, ...saved.tanks[t.id] } : t);
  return { zones: newZones, tanks: newTanks };
}

interface InteractiveFloorPlanProps {
  className?: string;
}

export function InteractiveFloorPlan({ className }: InteractiveFloorPlanProps) {
  const saved = loadPositions();
  const initial = applyPositions([...DEFAULT_ZONES], [...DEFAULT_BULK_TANKS], saved);

  const [zones, setZones] = useState<FloorZone[]>(initial.zones);
  const [tanks, setTanks] = useState<BulkTank[]>(initial.tanks);
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [hoveredZone, setHoveredZone] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterType, setFilterType] = useState<ZoneType | "all">("all");
  const [editMode, setEditMode] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragType, setDragType] = useState<"zone" | "tank" | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);

  const SVG_WIDTH = 1000;
  const SVG_HEIGHT = 800;

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

  const handleZoneDragStart = useCallback((e: React.MouseEvent, zoneId: string) => {
    if (!editMode) return;
    e.stopPropagation();
    e.preventDefault();
    const svgPt = toSVG(e);
    if (!svgPt) return;
    const zone = zones.find(z => z.id === zoneId);
    if (!zone) return;
    dragOffset.current = { x: svgPt.x - zone.x, y: svgPt.y - zone.y };
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
    setDraggingId(tankId);
    setDragType("tank");
  }, [editMode, tanks, toSVG]);

  const handleSvgMouseMove = useCallback((e: React.MouseEvent) => {
    if (draggingId && dragType) {
      const svgPt = toSVG(e);
      if (!svgPt) return;
      const newX = svgPt.x - dragOffset.current.x;
      const newY = svgPt.y - dragOffset.current.y;

      if (dragType === "zone") {
        setZones(prev => prev.map(z => z.id === draggingId ? { ...z, x: snap(newX), y: snap(newY) } : z));
      } else {
        const snappedCx = snap(svgPt.x - dragOffset.current.x);
        const snappedCy = snap(svgPt.y - dragOffset.current.y);
        setTanks(prev => prev.map(t => t.id === draggingId ? { ...t, cx: snappedCx, cy: snappedCy } : t));
      }
      setHasChanges(true);
      return;
    }

    // Panning
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [draggingId, dragType, isPanning, panStart, toSVG]);

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
    if (draggingId && dragType && editMode) {
      if (dragType === "zone") {
        const dragged = zones.find(z => z.id === draggingId);
        if (dragged) {
          // Check zone-zone overlap → swap positions
          const overlapping = zones.find(z => z.id !== draggingId && rectsOverlap(dragged, z));
          if (overlapping) {
            setZones(prev => prev.map(z => {
              if (z.id === draggingId) return { ...z, x: snap(overlapping.x), y: snap(overlapping.y) };
              if (z.id === overlapping.id) return { ...z, x: snap(dragged.x), y: snap(dragged.y) };
              return z;
            }));
            toast.info(`${dragged.label} ↔ ${overlapping.label} gewisseld`);
          }
          // Check zone-tank overlap → swap center/position
          const overlappingTank = tanks.find(t => circleRectOverlap(t, dragged));
          if (overlappingTank && !overlapping) {
            const zoneCenterX = dragged.x + dragged.w / 2;
            const zoneCenterY = dragged.y + dragged.h / 2;
            const newZoneX = overlappingTank.cx - dragged.w / 2;
            const newZoneY = overlappingTank.cy - dragged.h / 2;
            setZones(prev => prev.map(z => z.id === draggingId ? { ...z, x: snap(newZoneX), y: snap(newZoneY) } : z));
            setTanks(prev => prev.map(t => t.id === overlappingTank.id ? { ...t, cx: snap(zoneCenterX), cy: snap(zoneCenterY) } : t));
            toast.info(`${dragged.label} ↔ ${overlappingTank.label} gewisseld`);
          }
        }
      } else if (dragType === "tank") {
        const dragged = tanks.find(t => t.id === draggingId);
        if (dragged) {
          // Check tank-tank overlap → swap
          const overlapping = tanks.find(t => t.id !== draggingId && circlesOverlap(dragged, t));
          if (overlapping) {
            setTanks(prev => prev.map(t => {
              if (t.id === draggingId) return { ...t, cx: snap(overlapping.cx), cy: snap(overlapping.cy) };
              if (t.id === overlapping.id) return { ...t, cx: snap(dragged.cx), cy: snap(dragged.cy) };
              return t;
            }));
            toast.info(`${dragged.label} ↔ ${overlapping.label} gewisseld`);
          }
          // Check tank-zone overlap → swap
          const overlappingZone = zones.find(z => circleRectOverlap(dragged, z));
          if (overlappingZone && !overlapping) {
            const zoneCenterX = overlappingZone.x + overlappingZone.w / 2;
            const zoneCenterY = overlappingZone.y + overlappingZone.h / 2;
            setTanks(prev => prev.map(t => t.id === draggingId ? { ...t, cx: snap(zoneCenterX), cy: snap(zoneCenterY) } : t));
            setZones(prev => prev.map(z => z.id === overlappingZone.id ? { ...z, x: snap(dragged.cx - z.w / 2), y: snap(dragged.cy - z.h / 2) } : z));
            toast.info(`${dragged.label} ↔ ${overlappingZone.label} gewisseld`);
          }
        }
      }
      setHasChanges(true);
    }
    setDraggingId(null);
    setDragType(null);
    setIsPanning(false);
  }, [draggingId, dragType, editMode, zones, tanks]);

  const handleBgMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest("[data-zone]")) return;
    if (editMode) return; // Don't pan while editing, only drag zones
    setIsPanning(true);
    setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  }, [pan, editMode]);

  const handleSave = useCallback(() => {
    savePositions(zones, tanks);
    setEditMode(false);
    setHasChanges(false);
    toast.success("Plattegrond opgeslagen");
  }, [zones, tanks]);

  const handleReset = useCallback(() => {
    setZones([...DEFAULT_ZONES]);
    setTanks([...DEFAULT_BULK_TANKS]);
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
                ? "Sleep zones naar de gewenste positie • Klik op Opslaan als je klaar bent"
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
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 mr-2" onClick={() => setEditMode(true)}>
                <Pencil className="h-3 w-3" /> Indeling aanpassen
              </Button>
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
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: val.color }} />
                {val.label}
              </Badge>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0 relative">
        <div
          className={cn(
            "overflow-hidden select-none",
            editMode ? "cursor-default" : isPanning ? "cursor-grabbing" : "cursor-grab"
          )}
          style={{ height: isFullscreen ? "calc(100vh - 200px)" : 550 }}
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
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="w-full h-full"
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "center center",
              transition: (isPanning || draggingId) ? "none" : "transform 0.15s ease-out",
            }}
          >
            {/* Background */}
            <rect x="0" y="0" width={SVG_WIDTH} height={SVG_HEIGHT} fill="hsl(var(--background))" rx="8" />

            {/* Terrain */}
            <rect x="15" y="15" width={SVG_WIDTH - 30} height={140} rx="4" fill="hsl(var(--muted) / 0.2)" stroke="hsl(var(--border) / 0.3)" strokeWidth="1" strokeDasharray="6 3" />
            <text x={SVG_WIDTH / 2} y="32" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="9" fontWeight="700" letterSpacing="2" opacity="0.4">BUITENTERREIN – BULKTANKS</text>

            {/* Main building */}
            <rect x="20" y="150" width={SVG_WIDTH - 40} height="395" rx="5" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="2" />
            <text x="35" y="148" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="600" opacity="0.5">PRODUCTIEHAL</text>

            {/* Medical bunker */}
            <rect x="110" y="625" width={550} height={72} rx="4" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />
            <text x="115" y="623" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="600" opacity="0.5">CILINDERBUNKER – MEDISCHE GASSEN</text>

            {/* Office wing */}
            <rect x="330" y="710" width={320} height={58} rx="4" fill="hsl(var(--card))" stroke="hsl(var(--border))" strokeWidth="1.5" />

            {/* Logistics strip */}
            <rect x="20" y="535" width={420} height={100} rx="4" fill="hsl(var(--muted) / 0.1)" stroke="hsl(var(--border) / 0.3)" strokeWidth="1" strokeDasharray="4 4" />
            <text x="35" y="533" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="600" opacity="0.5">LOGISTIEK & SCHOONMAAK</text>

            {/* Vivisol wing */}
            <rect x="585" y="535" width={310} height={55} rx="4" fill="hsl(var(--muted) / 0.1)" stroke="hsl(var(--border) / 0.3)" strokeWidth="1" strokeDasharray="4 4" />
            <text x="600" y="533" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="600" opacity="0.5">VIVISOL</text>

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
                  <text x={tank.cx} y={tank.cy - 3} textAnchor="middle" dominantBaseline="middle" fill={tc.color} fontSize="9" fontWeight="700" style={{ pointerEvents: "none" }}>{tank.label}</text>
                  <text x={tank.cx} y={tank.cy + 9} textAnchor="middle" dominantBaseline="middle" fill="hsl(var(--muted-foreground))" fontSize="6.5" style={{ pointerEvents: "none" }}>{tank.sublabel}</text>
                  {editMode && <circle cx={tank.cx} cy={tank.cy - tank.r - 6} r="4" fill="hsl(var(--primary))" opacity="0.6"><title>Sleep om te verplaatsen</title></circle>}
                </g>
              );
            })}

            {/* Zones */}
            {filteredZones.map((zone) => {
              const zt = ZONE_TYPES[zone.type];
              const isSelected = selectedZone === zone.id;
              const isHovered = hoveredZone === zone.id;
              const isDragging = draggingId === zone.id;
              const dimmed = filterType !== "all" && zone.type !== filterType;

              return (
                <g
                  key={zone.id}
                  data-zone={zone.id}
                  className={editMode ? "cursor-grab" : "cursor-pointer"}
                  style={{ opacity: dimmed ? 0.25 : isDragging ? 0.7 : 1 }}
                  onClick={(e) => { if (!editMode) { e.stopPropagation(); setSelectedZone(s => s === zone.id ? null : zone.id); } }}
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
                    style={{ pointerEvents: "none" }}
                  >{zone.label}</text>
                  {zone.sublabel && (
                    <text
                      x={zone.x + zone.w / 2} y={zone.y + zone.h / 2 + 9}
                      textAnchor="middle" dominantBaseline="middle"
                      fill="hsl(var(--muted-foreground))" fontSize={zone.w < 80 ? 7 : 8}
                      style={{ pointerEvents: "none" }}
                    >{zone.sublabel}</text>
                  )}
                  {/* Edit mode drag indicator */}
                  {editMode && (
                    <g style={{ pointerEvents: "none" }}>
                      <rect x={zone.x + zone.w / 2 - 8} y={zone.y - 6} width="16" height="8" rx="3" fill="hsl(var(--primary))" opacity="0.6" />
                      <line x1={zone.x + zone.w / 2 - 3} y1={zone.y - 3.5} x2={zone.x + zone.w / 2 + 3} y2={zone.y - 3.5} stroke="hsl(var(--primary-foreground))" strokeWidth="1" opacity="0.8" />
                      <line x1={zone.x + zone.w / 2 - 3} y1={zone.y - 1} x2={zone.x + zone.w / 2 + 3} y2={zone.y - 1} stroke="hsl(var(--primary-foreground))" strokeWidth="1" opacity="0.8" />
                    </g>
                  )}
                  {!editMode && isSelected && <circle cx={zone.x + zone.w - 8} cy={zone.y + 8} r="4" fill={zt.color} />}
                </g>
              );
            })}

            {/* Section labels */}
            <text x="85" y="150" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="700" letterSpacing="1" opacity="0.4">DROOGIJS</text>
            <text x="215" y="150" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="700" letterSpacing="1" opacity="0.4">VULSTATIONS</text>
            <text x="730" y="150" textAnchor="middle" fill="hsl(var(--muted-foreground))" fontSize="8" fontWeight="700" letterSpacing="1" opacity="0.4">PALLETS 16 CIL</text>
          </svg>
        </div>

        {/* Detail panel (view mode only) */}
        {!editMode && (selectedZoneData || selectedTankData) && (
          <div className="absolute bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:w-72 bg-background/95 backdrop-blur-md border rounded-lg p-3 shadow-lg animate-in slide-in-from-bottom-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: selectedZoneData ? ZONE_TYPES[selectedZoneData.type].color : ZONE_TYPES.opslag_bulk.color }} />
                  <span className="font-semibold text-sm">{selectedZoneData?.label || selectedTankData?.label}</span>
                </div>
                {(selectedZoneData?.sublabel || selectedTankData?.sublabel) && (
                  <p className="text-xs text-muted-foreground ml-4.5">{selectedZoneData?.sublabel || selectedTankData?.sublabel}</p>
                )}
              </div>
              <Badge variant="outline" className="text-[10px] shrink-0" style={{
                borderColor: selectedZoneData ? ZONE_TYPES[selectedZoneData.type].color : ZONE_TYPES.opslag_bulk.color,
                color: selectedZoneData ? ZONE_TYPES[selectedZoneData.type].color : ZONE_TYPES.opslag_bulk.color,
              }}>
                {selectedZoneData ? ZONE_TYPES[selectedZoneData.type].label : ZONE_TYPES.opslag_bulk.label}
              </Badge>
            </div>
            {(selectedZoneData?.details || selectedTankData?.details) && (
              <p className="text-xs text-muted-foreground mt-2 flex items-start gap-1.5">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                {selectedZoneData?.details || selectedTankData?.details}
              </p>
            )}
            <Button variant="ghost" size="sm" className="mt-2 w-full text-xs h-7" onClick={() => setSelectedZone(null)}>
              Sluiten
            </Button>
          </div>
        )}

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
