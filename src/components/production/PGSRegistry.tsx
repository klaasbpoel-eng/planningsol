import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Separator } from "@/components/ui/separator";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Download,
  FileText,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Pencil,
  X,
  Check,
  Search,
  Beaker,
  MapPin,
  Flame,
  Activity,
  Container,
  CalendarClock,
  Link2,
  Calculator,
  Zap,
  Info,
  Plus,
  HelpCircle,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatNumber } from "@/lib/utils";
import * as XLSX from "xlsx";
import { getGasColor } from "@/constants/gasColors";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StoragePlacesManager } from "./StoragePlacesManager";
import { PGSAssignStoragePlaceDialog } from "./PGSAssignStoragePlaceDialog";
import { PGSExpansionRequestsDialog } from "./PGSExpansionRequestsDialog";
import { generatePGSPerPlacePDF, generatePGSPerPlaceExcel } from "@/utils/generatePGSPerPlaceReport";

// GHS pictogram config with diamond styling
const GHS_CONFIG: Record<string, { label: string; src: string }> = {
  GHS01: { label: "Explosief", src: "/ghs/GHS01.svg" },
  GHS02: { label: "Ontvlambaar", src: "/ghs/GHS02.svg" },
  GHS03: { label: "Oxiderend", src: "/ghs/GHS03.svg" },
  GHS04: { label: "Samengeperst gas", src: "/ghs/GHS04.svg" },
  GHS05: { label: "Corrosief", src: "/ghs/GHS05.svg" },
  GHS06: { label: "Giftig", src: "/ghs/GHS06.svg" },
  GHS07: { label: "Schadelijk", src: "/ghs/GHS07.svg" },
  GHS08: { label: "Gezondheidsgevaar", src: "/ghs/GHS08.svg" },
  GHS09: { label: "Milieugevaarlijk", src: "/ghs/GHS09.svg" },
};

// ADR transport label config
const ADR_CONFIG: Record<string, { label: string; src: string }> = {
  "ADR 2.1": { label: "Brandbare gassen", src: "/adr/ADR_2.1.svg" },
  "ADR 2.2": { label: "Niet-brandbare gassen", src: "/adr/ADR_2.2.svg" },
  "ADR 2.3": { label: "Giftige gassen", src: "/adr/ADR_2.3.svg" },
  "ADR 3":   { label: "Brandbare vloeistoffen", src: "/adr/ADR_3.svg" },
  "ADR 5.1": { label: "Oxiderende stoffen", src: "/adr/ADR_5.1.svg" },
  "ADR 6.1": { label: "Giftige stoffen", src: "/adr/ADR_6.1.svg" },
  "ADR 8":   { label: "Bijtende stoffen", src: "/adr/ADR_8.svg" },
  "ADR 9":   { label: "Diverse gevaarlijke stoffen", src: "/adr/ADR_9.svg" },
};

// Mapping from GHS codes to ADR codes
const GHS_TO_ADR: Record<string, string[]> = {
  GHS01: [],
  GHS02: ["ADR 2.1", "ADR 3"],
  GHS03: ["ADR 5.1"],
  GHS04: ["ADR 2.2"],
  GHS05: ["ADR 8"],
  GHS06: ["ADR 6.1"],
  GHS07: [],
  GHS08: [],
  GHS09: ["ADR 9"],
};

type PictogramMode = "ghs" | "adr" | "both";

// PGS guideline color mapping
/** Strip purity grades (e.g. "4.8", "5.0", "E.P.") from gas names for PGS display */
function stripPurity(name?: string): string {
  if (!name) return "";
  return name
    .replace(/\s+\d+\.\d+$/, "")
    .replace(/\s+E\.P\.$/, "")
    .replace(/\s+(Industrieel|Koeltechnisch|Medicinaal\b.*|MD APC)$/i, "")
    .trim();
}

/**
 * Returns kg of gas per liter of cylinder water volume.
 * - Compressed gases: real gas density at 200 bar fill pressure, 15 °C
 * - Liquefied/dissolved gases: standard fill ratio (independent of pressure)
 * Returns null for unknown gas types → user must enter kg/cilinder manually.
 */
function getGasKgPerLiter(gasName: string): number | null {
  // Normalize: lowercase, strip everything after first word boundary that looks like purity
  const n = gasName.toLowerCase().trim();

  // ── Liquefied / dissolved gases (fill ratio, kg gas per L water volume) ──
  if (n.includes("acetyleen") || n.includes("acetylene"))  return 0.15;  // dissolved in acetone
  if (n.includes("kooldioxide") || n.includes("co2"))       return 0.75;  // EU fill ratio
  if (n.includes("lachgas") || n.includes("distikstofoxide") || n.includes("n2o")) return 0.67;
  if (n.includes("ammoniak") || n.includes("ammonia"))      return 0.60;
  if (n.includes("propaan") || n.includes("propane"))        return 0.43;
  if (n.includes("butaan") || n.includes("butane"))          return 0.51;
  if (n.includes("chloor") || n.includes("chlorine"))        return 1.25;
  if (n.includes("zwaveldioxide") || n.includes("so2"))      return 1.23;
  if (n.includes("dimethylether") || n.includes("dme"))      return 0.58;

  // ── Compressed gases at 200 bar, 15 °C (real gas densities, kg/L) ──
  if (n.includes("argon"))                                   return 0.343;
  if (n.includes("helium"))                                  return 0.0325;
  if (n.startsWith("stikstof") || n === "stikstof" || n.includes("nitrogen") || n.includes("n2"))  return 0.233;
  if (n.includes("zuurstof") || n.includes("oxygen") || n.includes("o2"))    return 0.276;
  if (n.includes("waterstof") || n.includes("hydrogen") || n.includes("h2")) return 0.0164;
  if (n.includes("methaan") || n.includes("methane"))        return 0.149;
  if (n.includes("ethaan") || n.includes("ethane"))          return 0.318;  // supercritical at 200 bar
  if (n.includes("lucht") || n.includes("perslucht") || n.includes("air"))  return 0.242;
  if (n.includes("neon"))                                    return 0.083;
  if (n.includes("krypton"))                                 return 0.710;
  if (n.includes("xenon"))                                   return 1.19;
  if (n.includes("koolmonoxide") || n.includes("co ") || n === "co") return 0.234;
  if (n.includes("fluoride") || n.includes("hf"))            return null;  // corrosive, varies

  return null; // unknown → manual input
}

const PGS_COLORS: Record<string, string> = {
  "PGS 9": "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  "PGS 16": "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  "PGS 15": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

/** Renders a single pictogram (GHS or ADR) with tooltip */
function PictogramIcon({ code, config }: { code: string; config: { label: string; src: string } }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <img
          src={config.src}
          alt={`${code} — ${config.label}`}
          className="w-8 h-8 cursor-default"
        />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs font-medium">
        {code} — {config.label}
      </TooltipContent>
    </Tooltip>
  );
}

/** Renders hazard pictograms based on the selected display mode */
function HazardPictograms({ symbols, mode }: { symbols: string[]; mode: PictogramMode }) {
  const elements: React.ReactNode[] = [];
  for (const sym of symbols) {
    if ((mode === "ghs" || mode === "both") && GHS_CONFIG[sym]) {
      elements.push(<PictogramIcon key={`ghs-${sym}`} code={sym} config={GHS_CONFIG[sym]} />);
    }
    if (mode === "adr" || mode === "both") {
      const adrCodes = GHS_TO_ADR[sym] || [];
      for (const adr of adrCodes) {
        if (ADR_CONFIG[adr]) {
          elements.push(<PictogramIcon key={`adr-${sym}-${adr}`} code={adr} config={ADR_CONFIG[adr]} />);
        }
      }
    }
  }
  if (elements.length === 0 && mode === "adr") {
    return <span className="text-[10px] text-muted-foreground italic">—</span>;
  }
  return <>{elements}</>;
}

/** Helper to get pictogram labels for export */
function getExportSymbols(symbols: string[], mode: PictogramMode): string {
  if (mode === "ghs") return symbols.join(", ");
  if (mode === "adr") {
    const adrs = symbols.flatMap(s => GHS_TO_ADR[s] || []);
    return [...new Set(adrs)].join(", ") || "—";
  }
  const adrs = symbols.flatMap(s => GHS_TO_ADR[s] || []);
  return [...symbols, ...new Set(adrs)].join(", ");
}

interface CylinderBreakdownItem {
  description: string;
  capacity: number;
  countVol: number;
  countLeeg: number;
  weightKg: number;
}

/** Live breakdown item calculated from "Voorraad" table */
interface LiveBreakdownItem {
  description: string;  // ContainerTypeDescr or ContentDescription
  capacity: number;     // Capacity in liters
  count: number;        // sum of Aantal
  weightKg: number;     // Aantal × Capacity × gas density (for full)
}

interface PGSSubstance {
  id: string;
  gas_type_id: string | null;
  location: string;
  pgs_guideline: string;
  max_allowed_kg: number;
  current_stock_kg: number;
  storage_class: string | null;
  hazard_symbols: string[];
  un_number: string | null;
  cas_number: string | null;
  risk_phrases: string | null;
  safety_phrases: string | null;
  notes: string | null;
  is_active: boolean;
  gevi_number: string | null;
  wms_classification: string | null;
  storage_location: string | null;
  cylinder_breakdown?: CylinderBreakdownItem[];
  gas_type_name?: string;
  gas_type_color?: string;
  // Live fields calculated from "Voorraad" table
  live?: boolean;
  liveStockKg?: number;
  liveCylinderBreakdown?: LiveBreakdownItem[];
}

interface BulkTank {
  id: string;
  tank_name: string;
  tank_number: string | null;
  gas_type_id: string | null;
  location: string;
  capacity_kg: number;
  current_level_kg: number;
  last_inspection_date: string | null;
  next_inspection_date: string | null;
  pgs_guideline: string;
  un_number: string | null;
  hazard_symbols: string[];
  storage_class: string | null;
  is_active: boolean;
  notes: string | null;
  gevi_number: string | null;
  wms_classification: string | null;
  gas_type_name?: string;
  gas_type_color?: string;
}

/** Paginated fetch helper — same pattern as VoorraadBeheer */
async function fetchAllRows(tableName: string): Promise<any[]> {
  const all: any[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await (supabase.from(tableName as never) as any)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) { console.error(`[fetchAllRows] "${tableName}":`, error); break; }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

/** Build live breakdown + stock for a substance from matched Voorraad rows */
function buildLiveData(matched: any[]): { liveStockKg: number; liveCylinderBreakdown: LiveBreakdownItem[] } {
  const map = new Map<string, LiveBreakdownItem>();
  for (const row of matched) {
    const rawDesc = row.ContentDescription || row.CD_CONTENT_TYPE || "";
    const containerDesc = row.ContainerTypeDescr || "";
    const isLeeg = rawDesc.toLowerCase().includes("leeg") || rawDesc.toLowerCase().includes("empty") || 
                   containerDesc.toLowerCase().includes("leeg") || containerDesc.toLowerCase().includes("empty") ||
                   (row.DS_CENTER_DESCRIPTION || "").toLowerCase().includes("leeg");

    const desc = rawDesc || containerDesc;
    const key = `${desc}__${row.Capacity || 0}`;
    const density = getGasKgPerLiter(desc);
    const aantal = Number(row.Aantal) || 0;
    const cap = Number(row.Capacity) || 0;

    const weight = (!isLeeg && density !== null) ? aantal * cap * density : 0;

    const ex = map.get(key);
    if (ex) { 
      ex.count += aantal;
      ex.weightKg += weight; 
    }
    else { 
      map.set(key, { 
        description: desc, 
        capacity: cap, 
        count: aantal,
        weightKg: weight 
      }); 
    }
  }
  const liveCylinderBreakdown = [...map.values()].sort((a, b) => {
    if (a.description === b.description) return b.capacity - a.capacity;
    return a.description.localeCompare(b.description);
  });
  const liveStockKg = liveCylinderBreakdown.reduce((s, b) => s + b.weightKg, 0);
  return { liveStockKg, liveCylinderBreakdown };
}

interface PGSRegistryProps {
  location: string;
  isAdmin?: boolean;
}

type SortField = "name" | "pgs" | "un" | "pct";
type SortDir = "asc" | "desc";

export function PGSRegistry({ location: initialLocation, isAdmin = false }: PGSRegistryProps) {
  const [substances, setSubstances] = useState<PGSSubstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterGuideline, setFilterGuideline] = useState<string>("all");
  const [filterStorageClass, setFilterStorageClass] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ max_allowed_kg: 0, current_stock_kg: 0 });
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [locationTab, setLocationTab] = useState(initialLocation);
  const [bulkTanks, setBulkTanks] = useState<BulkTank[]>([]);
  const [editingBulkId, setEditingBulkId] = useState<string | null>(null);
  const [bulkEditValue, setBulkEditValue] = useState(0);
  const [bulkEditCapacity, setBulkEditCapacity] = useState(0);
  const [pictogramMode, setPictogramMode] = useState<PictogramMode>(() => {
    return (localStorage.getItem("pgs-pictogram-mode") as PictogramMode) || "ghs";
  });
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkingSubstance, setLinkingSubstance] = useState<PGSSubstance | null>(null);
  const [allGasTypes, setAllGasTypes] = useState<{ id: string; name: string }[]>([]);
  const [detailEditOpen, setDetailEditOpen] = useState(false);
  const [detailEditSaving, setDetailEditSaving] = useState(false);
  const [detailEditForm, setDetailEditForm] = useState({
    id: "",
    gas_type_name: "",
    pgs_guideline: "",
    location: "",
    max_allowed_kg: 0,
    current_stock_kg: 0,
    hazard_symbols: [] as string[],
    gevi_number: "",
    storage_class: "",
    wms_classification: "",
    un_number: "",
    risk_phrases: "",
    safety_phrases: "",
    storage_location: "",
  });

  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    gas_type_name: "",
    location: "sol_emmen" as "sol_emmen" | "sol_tilburg",
    pgs_guideline: "PGS 9",
    max_allowed_kg: "" as string | number,
    current_stock_kg: "" as string | number,
    un_number: "",
  });
  const [cylinderSizes, setCylinderSizes] = useState<Array<{ id: string; name: string; capacity_liters: number | null }>>([]);
  // PGS 15:2021 per-opslagplaats add-ons
  const [placesManagerOpen, setPlacesManagerOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [expansionDialogOpen, setExpansionDialogOpen] = useState(false);
  const [filterPlaceType, setFilterPlaceType] = useState<"all" | "incidental">("all");

  const handlePictogramModeChange = (value: string) => {
    if (value) {
      setPictogramMode(value as PictogramMode);
      localStorage.setItem("pgs-pictogram-mode", value);
    }
  };

  const fetchSubstances = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("pgs_substances")
        .select("*")
        .eq("is_active", true)
        .order("pgs_guideline", { ascending: true });

      if (locationTab !== "all") {
        query = query.eq("location", locationTab as "sol_emmen" | "sol_tilburg");
      }

      // Parallel: fetch substances + gas types + live Voorraad
      const [{ data, error }, voorraadRows] = await Promise.all([
        query,
        fetchAllRows("Voorraad"),
      ]);
      if (error) throw error;

      const gasTypeIds = [...new Set((data || []).map(s => s.gas_type_id).filter(Boolean))];
      let gasTypeMap: Record<string, { name: string; color: string }> = {};

      if (gasTypeIds.length > 0) {
        const { data: gasTypes } = await supabase
          .from("gas_types")
          .select("id, name, color")
          .in("id", gasTypeIds);

        if (gasTypes) {
          gasTypeMap = Object.fromEntries(gasTypes.map(gt => [gt.id, { name: gt.name, color: gt.color }]));
        }
      }

      setSubstances((data || []).map(s => {
        const gasTypeName = s.gas_type_id ? stripPurity(gasTypeMap[s.gas_type_id]?.name) || "Onbekend" : "Onbekend";
        const gasTypeColor = s.gas_type_id ? getGasColor(stripPurity(gasTypeMap[s.gas_type_id]?.name) || "", gasTypeMap[s.gas_type_id]?.color || "#6b7280") : "#6b7280";

        // Match Voorraad rows: same location + gas name keyword in ContentDescription
        const normalizedGasName = gasTypeName.toLowerCase();
        const matched = gasTypeName !== "Onbekend" ? voorraadRows.filter(row => {
          const loc = (row.DS_CENTER_DESCRIPTION || "").toLowerCase().includes("emmen") ? "sol_emmen" : "sol_tilburg";
          const descForGas = row.ContentDescription || row.CD_CONTENT_TYPE || "";
          const content = descForGas.toLowerCase();
          return loc === s.location && normalizedGasName && content.includes(normalizedGasName);
        }) : [];

        const { liveStockKg, liveCylinderBreakdown } = buildLiveData(matched);
        const live = matched.length > 0;

        return {
          ...s,
          hazard_symbols: s.hazard_symbols || [],
          cylinder_breakdown: (Array.isArray(s.cylinder_breakdown) ? s.cylinder_breakdown : []) as unknown as CylinderBreakdownItem[],
          gas_type_name: gasTypeName,
          gas_type_color: gasTypeColor,
          live,
          liveStockKg,
          liveCylinderBreakdown,
        };
      }));
    } catch (err) {
      console.error("Error fetching PGS data:", err);
      toast.error("Fout bij ophalen PGS-gegevens");
    } finally {
      setLoading(false);
    }
  }, [locationTab]);

  const fetchBulkTanks = useCallback(async () => {
    try {
      let query = supabase
        .from("bulk_storage_tanks")
        .select("*")
        .eq("is_active", true)
        .order("tank_name", { ascending: true });

      if (locationTab !== "all") {
        query = query.eq("location", locationTab as "sol_emmen" | "sol_tilburg");
      }

      const { data, error } = await query;
      if (error) throw error;

      const gasTypeIds = [...new Set((data || []).map(t => t.gas_type_id).filter(Boolean))];
      let gasTypeMap: Record<string, { name: string; color: string }> = {};
      if (gasTypeIds.length > 0) {
        const { data: gasTypes } = await supabase.from("gas_types").select("id, name, color").in("id", gasTypeIds);
        if (gasTypes) gasTypeMap = Object.fromEntries(gasTypes.map(gt => [gt.id, { name: gt.name, color: gt.color }]));
      }

      setBulkTanks((data || []).map(t => ({
        ...t,
        hazard_symbols: t.hazard_symbols || [],
        gas_type_name: t.gas_type_id ? stripPurity(gasTypeMap[t.gas_type_id]?.name) || "Onbekend" : "Onbekend",
        gas_type_color: t.gas_type_id ? getGasColor(stripPurity(gasTypeMap[t.gas_type_id]?.name) || "", gasTypeMap[t.gas_type_id]?.color || "#6b7280") : "#6b7280",
      })));
    } catch (err) {
      console.error("Error fetching bulk tanks:", err);
    }
  }, [locationTab]);

  useEffect(() => {
    fetchSubstances();
    fetchBulkTanks();
  }, [fetchSubstances, fetchBulkTanks]);

  // Fetch all gas types for linking dialog
  useEffect(() => {
    const fetchGasTypes = async () => {
      const { data } = await supabase.from("gas_types").select("id, name").eq("is_active", true).order("name");
      if (data) setAllGasTypes(data);
    };
    fetchGasTypes();
  }, []);

  const openLinkDialog = (substance: PGSSubstance) => {
    setLinkingSubstance(substance);
    setLinkDialogOpen(true);
  };

  const handleLinkGasType = async (gasTypeId: string) => {
    if (!linkingSubstance) return;
    try {
      const { error } = await supabase
        .from("pgs_substances")
        .update({ gas_type_id: gasTypeId, updated_at: new Date().toISOString() })
        .eq("id", linkingSubstance.id);
      if (error) throw error;
      toast.success("Gastype succesvol gekoppeld");
      setLinkDialogOpen(false);
      setLinkingSubstance(null);
      fetchSubstances();
    } catch (err) {
      console.error("Error linking gas type:", err);
      toast.error("Fout bij koppelen gastype");
    }
  };

  const handleAddSubstance = async () => {
    const name = addForm.gas_type_name.trim();
    const maxKg = Number(addForm.max_allowed_kg);
    if (!name || maxKg <= 0) {
      toast.error("Vul een gasnaam en de maximale hoeveelheid in");
      return;
    }
    setAddSaving(true);
    try {
      // Look up existing gas_type by name (case-insensitive), or create new
      const existing = allGasTypes.find(gt => gt.name.toLowerCase() === name.toLowerCase());
      let gasTypeId: string;
      if (existing) {
        gasTypeId = existing.id;
      } else {
        const { data: newType, error: typeErr } = await supabase
          .from("gas_types")
          .insert({ name, color: "#6b7280", is_active: true })
          .select("id")
          .single();
        if (typeErr || !newType) throw typeErr ?? new Error("Aanmaken gastype mislukt");
        gasTypeId = newType.id;
      }
      const { error } = await supabase.from("pgs_substances").insert({
        gas_type_id: gasTypeId,
        location: addForm.location,
        pgs_guideline: addForm.pgs_guideline,
        max_allowed_kg: maxKg,
        current_stock_kg: Number(addForm.current_stock_kg) || 0,
        is_active: true,
        hazard_symbols: [],
        cylinder_breakdown: [],
        un_number: addForm.un_number.trim() || null,
      });
      if (error) throw error;
      toast.success(`${name} toegevoegd aan het PGS Register`);
      setAddDialogOpen(false);
      setAddForm({ gas_type_name: "", location: "sol_emmen", pgs_guideline: "PGS 9", max_allowed_kg: "", current_stock_kg: "", un_number: "" });
      fetchSubstances();
    } catch (err) {
      console.error(err);
      toast.error("Fout bij opslaan");
    } finally {
      setAddSaving(false);
    }
  };

  const openDetailEdit = (substance: PGSSubstance) => {
    setDetailEditForm({
      id: substance.id,
      gas_type_name: substance.gas_type_name || "",
      pgs_guideline: substance.pgs_guideline,
      location: substance.location,
      max_allowed_kg: substance.max_allowed_kg,
      current_stock_kg: substance.current_stock_kg,
      hazard_symbols: substance.hazard_symbols || [],
      gevi_number: substance.gevi_number || "",
      storage_class: substance.storage_class || "",
      wms_classification: substance.wms_classification || "",
      un_number: substance.un_number || "",
      risk_phrases: substance.risk_phrases || "",
      safety_phrases: substance.safety_phrases || "",
      storage_location: substance.storage_location || "",
    });
    setDetailEditOpen(true);
  };

  const deleteDetailEdit = async () => {
    if (!confirm("Weet je zeker dat je dit gas wilt verbergen uit het register? (Je kunt het later via de database weer terughalen indien nodig).")) return;
    setDetailEditSaving(true);
    try {
      const { error } = await supabase
        .from("pgs_substances")
        .update({
          is_active: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", detailEditForm.id);
      if (error) throw error;
      toast.success("Gas succesvol verborgen");
      setDetailEditOpen(false);
      fetchSubstances();
    } catch (err) {
      console.error(err);
      toast.error("Fout bij verbergen");
    } finally {
      setDetailEditSaving(false);
    }
  };

  const saveDetailEdit = async () => {
    setDetailEditSaving(true);
    try {
      const { error } = await supabase
        .from("pgs_substances")
        .update({
          max_allowed_kg: detailEditForm.max_allowed_kg,
          current_stock_kg: detailEditForm.current_stock_kg,
          hazard_symbols: detailEditForm.hazard_symbols,
          gevi_number: detailEditForm.gevi_number.trim() || null,
          storage_class: detailEditForm.storage_class.trim() || null,
          wms_classification: detailEditForm.wms_classification.trim() || null,
          un_number: detailEditForm.un_number.trim() || null,
          risk_phrases: detailEditForm.risk_phrases.trim() || null,
          safety_phrases: detailEditForm.safety_phrases.trim() || null,
          storage_location: detailEditForm.storage_location.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", detailEditForm.id);
      if (error) throw error;
      toast.success("Gegevens opgeslagen");
      setDetailEditOpen(false);
      fetchSubstances();
    } catch (err) {
      console.error(err);
      toast.error("Fout bij opslaan");
    } finally {
      setDetailEditSaving(false);
    }
  };

  useEffect(() => {
    supabase
      .from("cylinder_sizes")
      .select("id, name, capacity_liters")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => { if (data) setCylinderSizes(data); });
  }, []);
  // Realtime subscription for bulk tanks
  useEffect(() => {
    const channel = supabase
      .channel("bulk-tanks-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "bulk_storage_tanks" },
        () => {
          fetchBulkTanks();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchBulkTanks]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  const startEdit = (substance: PGSSubstance) => {
    setEditingId(substance.id);
    setEditValues({ max_allowed_kg: substance.max_allowed_kg, current_stock_kg: substance.current_stock_kg });
  };

  const cancelEdit = () => setEditingId(null);

  const saveEdit = async (id: string) => {
    try {
      const { error } = await supabase
        .from("pgs_substances")
        .update({
          max_allowed_kg: editValues.max_allowed_kg,
          current_stock_kg: editValues.current_stock_kg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Waarden opgeslagen");
      setEditingId(null);
      fetchSubstances();
    } catch (err) {
      console.error("Error saving:", err);
      toast.error("Fout bij opslaan");
    }
  };

  const startBulkEdit = (tank: BulkTank) => {
    setEditingBulkId(tank.id);
    setBulkEditValue(tank.current_level_kg);
    setBulkEditCapacity(tank.capacity_kg);
  };

  const saveBulkEdit = async (id: string) => {
    try {
      const { error } = await supabase
        .from("bulk_storage_tanks")
        .update({
          current_level_kg: bulkEditValue,
          capacity_kg: bulkEditCapacity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
      toast.success("Tank bijgewerkt");
      setEditingBulkId(null);
    } catch (err) {
      console.error("Error saving bulk:", err);
      toast.error("Fout bij opslaan");
    }
  };

  const exportToExcel = () => {
    const rows = processedSubstances.map(s => ({
      Gas: s.gas_type_name,
      "PGS Richtlijn": s.pgs_guideline,
      "UN Nummer": s.un_number || "",
      "CAS Nummer": s.cas_number || "",
      "Opslagklasse": s.storage_class || "",
      "Pictogrammen": getExportSymbols(s.hazard_symbols || [], pictogramMode),
      "GEVI": s.gevi_number || "",
      "WMS": s.wms_classification || "",
      "Max. Toegestaan (kg)": s.max_allowed_kg,
      "Huidige Voorraad (kg)": s.live ? (s.liveStockKg ?? 0) : s.current_stock_kg,
      "Bezetting (%)": Math.round(getPct(s)),
      "Bron": s.live ? "Live (Voorraad)" : "Handmatig",
      "H-zinnen": s.risk_phrases || "",
      "P-zinnen": s.safety_phrases || "",
      Locatie: s.location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg",
      Opslagplaats: s.storage_location || "",
      Opmerkingen: s.notes || "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PGS Register");
    XLSX.writeFile(wb, `PGS_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel geëxporteerd");
  };

  const exportToPDF = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const now = new Date();
    const dateStr = now.toLocaleDateString("nl-NL", { day: "2-digit", month: "2-digit", year: "numeric" });
    const timeStr = now.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
    const locLabel = locationTab === "all" ? "Alle locaties" : locationTab === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg";

    // Header
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("PGS Register — Gevaarlijke Stoffen", 14, 18);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Locatie: ${locLabel}  |  Datum: ${dateStr}  |  Tijd: ${timeStr}`, 14, 24);
    doc.text(`Aantal stoffen: ${processedSubstances.length}  |  Waarschuwingen: ${stats.warning}  |  Kritiek: ${stats.critical}`, 14, 29);

    // Separator line
    doc.setDrawColor(200);
    doc.line(14, 31, 283, 31);

    // Table
    const pictoLabel = pictogramMode === "adr" ? "ADR" : pictogramMode === "both" ? "GHS/ADR" : "GHS";
    const head = [["Gas", "PGS", "UN", "CAS", pictoLabel, "GEVI", "WMS", "Opslagkl.", "Max (kg)", "Huidig (kg)", "Bez. (%)", "H-zinnen", "P-zinnen", "Locatie"]];
    const body = processedSubstances.map(s => {
      const pct = Math.round(getPct(s));
      const stockKg = s.live ? (s.liveStockKg ?? 0) : s.current_stock_kg;
      return [
        s.gas_type_name || "",
        s.pgs_guideline,
        s.un_number || "—",
        s.cas_number || "—",
        getExportSymbols(s.hazard_symbols || [], pictogramMode),
        s.gevi_number || "—",
        s.wms_classification || "—",
        s.storage_class || "—",
        formatNumber(s.max_allowed_kg, 0),
        formatNumber(stockKg, 0),
        `${pct}%`,
        s.risk_phrases || "—",
        s.safety_phrases || "—",
        s.location === "sol_emmen" ? "Emmen" : "Tilburg",
      ];
    });

    autoTable(doc, {
      startY: 34,
      head,
      body,
      theme: "grid",
      headStyles: { fillColor: [41, 50, 65], fontSize: 7, fontStyle: "bold", halign: "left" },
      bodyStyles: { fontSize: 7, cellPadding: 1.5 },
      alternateRowStyles: { fillColor: [245, 245, 245] },
      columnStyles: {
        0: { cellWidth: 28 },
        6: { halign: "right" },
        7: { halign: "right" },
        8: { halign: "center" },
      },
      didParseCell: (data) => {
        // Color critical/warning rows
        if (data.section === "body" && data.column.index === 8) {
          const val = parseInt(data.cell.text[0] || "0");
          if (val >= 95) {
            data.cell.styles.textColor = [220, 38, 38];
            data.cell.styles.fontStyle = "bold";
          } else if (val >= 80) {
            data.cell.styles.textColor = [234, 88, 12];
            data.cell.styles.fontStyle = "bold";
          }
        }
      },
      margin: { left: 14, right: 14 },
    });

    // Footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(`PGS Register — ${dateStr} — Pagina ${i} van ${pageCount}`, 14, doc.internal.pageSize.height - 8);
      doc.text("Vertrouwelijk — Alleen voor intern gebruik en inspectiedoeleinden", doc.internal.pageSize.width - 14, doc.internal.pageSize.height - 8, { align: "right" });
    }

    doc.save(`PGS_Register_${now.toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF geëxporteerd");
  };

  // Derived data
  const guidelines = useMemo(() => [...new Set(substances.map(s => s.pgs_guideline))].sort(), [substances]);
  const storageClasses = useMemo(() => [...new Set(substances.map(s => s.storage_class).filter(Boolean))].sort(), [substances]);

  const getPct = (s: PGSSubstance) => {
    const stockKg = s.live ? (s.liveStockKg ?? 0) : s.current_stock_kg;
    return s.max_allowed_kg > 0 ? (stockKg / s.max_allowed_kg) * 100 : 0;
  };

  const processedSubstances = useMemo(() => {
    let result = substances.filter(s => {
      if (s.gas_type_name === "Onbekend") return false;
      if (filterGuideline !== "all" && s.pgs_guideline !== filterGuideline) return false;
      if (filterStorageClass !== "all" && s.storage_class !== filterStorageClass) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = s.gas_type_name?.toLowerCase().includes(q);
        const matchUN = s.un_number?.toLowerCase().includes(q);
        const matchCAS = s.cas_number?.toLowerCase().includes(q);
        const matchPGS = s.pgs_guideline.toLowerCase().includes(q);
        const matchNotes = s.notes?.toLowerCase().includes(q);
        if (!matchName && !matchUN && !matchCAS && !matchPGS && !matchNotes) return false;
      }
      return true;
    });

    result.sort((a, b) => {
      const dir = sortDir === "asc" ? 1 : -1;
      switch (sortField) {
        case "name": return dir * (a.gas_type_name || "").localeCompare(b.gas_type_name || "");
        case "pgs": return dir * a.pgs_guideline.localeCompare(b.pgs_guideline);
        case "un": return dir * (a.un_number || "").localeCompare(b.un_number || "");
        case "pct": return dir * (getPct(a) - getPct(b));
        default: return 0;
      }
    });

    return result;
  }, [substances, filterGuideline, filterStorageClass, searchQuery, sortField, sortDir]);

  // KPI stats
const stats = useMemo(() => {
    const total = substances.length;
    const ok = substances.filter(s => getPct(s) < 80).length;
    const warning = substances.filter(s => { const p = getPct(s); return p >= 80 && p < 95; }).length;
    const critical = substances.filter(s => getPct(s) >= 95).length;
    return { total, ok, warning, critical };
  }, [substances]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ChevronDown className="h-3 w-3 opacity-0 group-hover:opacity-30" />;
    return sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />;
  };

  const colSpan = isAdmin ? 12 : 11;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="pt-5 pb-4 px-4 h-20" />
            </Card>
          ))}
        </div>
        <Card className="animate-pulse">
          <CardContent className="h-64" />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-destructive/10">
            <ShieldAlert className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground leading-tight">PGS Register</h2>
            <p className="text-xs text-muted-foreground">Gevaarlijke stoffen conform PGS-richtlijnen</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <Button size="sm" onClick={() => setAddDialogOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Nieuwe stof
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setPlacesManagerOpen(true)} className="gap-1.5">
            <MapPin className="h-4 w-4" />
            Opslagplaatsen
          </Button>
          <Button variant="outline" size="sm" onClick={() => setAssignDialogOpen(true)} className="gap-1.5">
            <Link2 className="h-4 w-4" />
            Toewijzen
          </Button>
          <Button variant="outline" size="sm" onClick={() => setExpansionDialogOpen(true)} className="gap-1.5">
            <Activity className="h-4 w-4" />
            Uitbreiding
          </Button>
          <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-1.5">
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-1.5">
            <Download className="h-4 w-4" />
            Excel
          </Button>
          <Select value={filterPlaceType} onValueChange={(v) => setFilterPlaceType(v as any)}>
            <SelectTrigger className="w-[200px] h-9 text-xs">
              <SelectValue placeholder="Filter opslagplaats..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle plaatsen</SelectItem>
              <SelectItem value="permanent">Vast (permanent)</SelectItem>
              <SelectItem value="temporary">Tijdelijk / incidenteel</SelectItem>
              <SelectItem value="crossdock">Crossdock</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generatePGSPerPlacePDF(locationTab !== "both" ? locationTab : undefined, filterPlaceType).catch(() => toast.error("PDF mislukt"))}
            className="gap-1.5"
            title="PDF gegroepeerd per opslagplaats (PGS 15:2021)"
          >
            <FileText className="h-4 w-4" />
            PDF / plaats
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => generatePGSPerPlaceExcel(locationTab !== "both" ? locationTab : undefined, filterPlaceType).catch(() => toast.error("Excel mislukt"))}
            className="gap-1.5"
            title="Excel gegroepeerd per opslagplaats"
          >
            <Download className="h-4 w-4" />
            Excel / plaats
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          value={stats.total}
          label="Geregistreerde stoffen"
          icon={<Beaker className="h-4 w-4 text-primary" />}
          iconBgColor="bg-primary/10"
        />
        <StatCard
          value={stats.ok}
          label="Status OK"
          icon={<ShieldCheck className="h-4 w-4 text-emerald-600" />}
          iconBgColor="bg-emerald-500/10"
        />
        <StatCard
          value={stats.warning}
          label="Waarschuwing (>80%)"
          icon={<AlertTriangle className="h-4 w-4 text-orange-500" />}
          iconBgColor="bg-orange-500/10"
        />
        <StatCard
          value={stats.critical}
          label="Kritiek (>95%)"
          icon={<Flame className="h-4 w-4 text-destructive" />}
          iconBgColor="bg-destructive/10"
        />
      </div>

      {/* Location tabs + filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <Tabs value={locationTab} onValueChange={setLocationTab} className="w-auto">
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-xs px-3 gap-1.5">
              <MapPin className="h-3 w-3" />
              Alle locaties
            </TabsTrigger>
            <TabsTrigger value="sol_emmen" className="text-xs px-3">Emmen</TabsTrigger>
            <TabsTrigger value="sol_tilburg" className="text-xs px-3">Tilburg</TabsTrigger>
          </TabsList>
        </Tabs>

        <ToggleGroup type="single" value={pictogramMode} onValueChange={handlePictogramModeChange} variant="outline" size="sm">
          <ToggleGroupItem value="ghs" className="text-xs px-2.5 h-9">GHS</ToggleGroupItem>
          <ToggleGroupItem value="adr" className="text-xs px-2.5 h-9">ADR</ToggleGroupItem>
          <ToggleGroupItem value="both" className="text-xs px-2.5 h-9">Beide</ToggleGroupItem>
        </ToggleGroup>

        <div className="flex-1" />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[160px] max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Zoek gas, UN, CAS..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 pl-8 pr-8 text-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Wis zoekterm"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <Select value={filterGuideline} onValueChange={setFilterGuideline}>
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue placeholder="PGS Richtlijn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle richtlijnen</SelectItem>
              {guidelines.filter(g => g && g.trim() !== "").map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {storageClasses.length > 0 && (
            <Select value={filterStorageClass} onValueChange={setFilterStorageClass}>
              <SelectTrigger className="h-9 w-40 text-xs">
                <SelectValue placeholder="Opslagklasse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle klassen</SelectItem>
                {storageClasses.filter(sc => sc && sc.trim() !== "").map(sc => (
                  <SelectItem key={sc!} value={sc!}>{sc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {/* Data table */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {processedSubstances.length === 0 ? (
            <div className="py-4">
              <EmptyState
                variant="search"
                title="Geen stoffen gevonden"
                description={searchQuery ? "Pas je zoekopdracht aan of verwijder filters." : "Er zijn geen PGS-registraties voor deze locatie."}
                size="md"
              />
            </div>
          ) : (
            <div className="overflow-auto max-h-[600px]">
              <TooltipProvider delayDuration={150}>
                <Table>
                  <TableHeader className="sticky top-0 z-10 bg-muted/80 backdrop-blur-sm">
                    <TableRow className="hover:bg-transparent border-b-2 border-border/50">
                      <TableHead className="w-8" />
                      <TableHead
                        className="cursor-pointer select-none group"
                        onClick={() => handleSort("name")}
                      >
                        <span className="inline-flex items-center gap-1">Gas <SortIcon field="name" /></span>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none group"
                        onClick={() => handleSort("pgs")}
                      >
                        <span className="inline-flex items-center gap-1">PGS <SortIcon field="pgs" /></span>
                      </TableHead>
                      <TableHead
                        className="cursor-pointer select-none group"
                        onClick={() => handleSort("un")}
                      >
                        <span className="inline-flex items-center gap-1">UN <SortIcon field="un" /></span>
                      </TableHead>
                      <TableHead>{pictogramMode === "adr" ? "ADR" : pictogramMode === "both" ? "GHS / ADR" : "GHS"}</TableHead>
                      <TableHead className="text-xs">GEVI</TableHead>
                      <TableHead className="text-xs">WMS</TableHead>
                      <TableHead
                        className="cursor-pointer select-none group"
                        onClick={() => handleSort("pct")}
                      >
                        <span className="inline-flex items-center gap-1">Bezetting <SortIcon field="pct" /></span>
                      </TableHead>
                      <TableHead className="text-right">Max (kg)</TableHead>
                      <TableHead className="text-right">
                        <span className="inline-flex items-center justify-end gap-1">
                          Huidig (kg)
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="opacity-40 hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                <Info className="h-3.5 w-3.5" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent side="left" align="start" className="w-80 text-sm p-0 overflow-hidden">
                              <div className="bg-muted/60 border-b px-4 py-2.5 font-semibold text-sm flex items-center gap-2">
                                <Zap className="h-4 w-4 text-emerald-500" />
                                Gewichtberekening — Live
                              </div>
                              <div className="px-4 py-3 space-y-3 text-xs text-muted-foreground">
                                <p>Het gewicht per stof wordt automatisch berekend uit de live <strong className="text-foreground">Voorraad</strong>-tabel:</p>
                                <div className="rounded-md bg-muted/50 border px-3 py-2 font-mono text-[11px] leading-relaxed">
                                  <span className="text-foreground">Gewicht (kg)</span>{" = "}<br />
                                  <span className="pl-2">Aantal × Inhoud (L) × Dichtheid (kg/L)</span>
                                </div>
                                <div className="space-y-1">
                                  <p className="font-semibold text-foreground">Gasdichtheden (bij vuldruk)</p>
                                  <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
                                    {([
                                      ["Zuurstof", "0,276 kg/L · 200 bar"],
                                      ["Stikstof", "0,233 kg/L · 200 bar"],
                                      ["Argon", "0,343 kg/L · 200 bar"],
                                      ["Helium", "0,033 kg/L · 200 bar"],
                                      ["Waterstof", "0,016 kg/L · 200 bar"],
                                      ["CO₂", "0,75 kg/L · vloeibaar"],
                                      ["Lachgas", "0,67 kg/L · vloeibaar"],
                                      ["Acetyleen", "0,15 kg/L · opgelost"],
                                      ["Propaan", "0,43 kg/L · vloeibaar"],
                                    ] as [string, string][]).map(([gas, val]) => (
                                      <span key={gas} className="contents">
                                        <span className="text-foreground">{gas}</span>
                                        <span className="tabular-nums">{val}</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                                <div className="border-t pt-2 space-y-1">
                                  <p><strong className="text-foreground">Koppeling:</strong> elke Voorraad-rij wordt via sleutelwoord (gasnaam) en locatie automatisch aan een PGS-stof gekoppeld.</p>
                                  <p><strong className="text-foreground">Grijs "handmatig":</strong> geen Voorraad-match — gewicht uit handmatig ingevoerde waarde.</p>
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        </span>
                      </TableHead>
                      <TableHead className="text-xs">Opslagplaats</TableHead>
                      {isAdmin && <TableHead className="w-16" />}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedSubstances.map((substance, idx) => {
                      const pct = getPct(substance);
                      const isWarning = pct >= 80;
                      const isCritical = pct >= 95;
                      const isExpanded = expandedRows.has(substance.id);
                      const isEditing = editingId === substance.id;
                      const isEven = idx % 2 === 0;

                      return (
                        <SubstanceRow
                          key={substance.id}
                          substance={substance}
                          pct={pct}
                          isWarning={isWarning}
                          isCritical={isCritical}
                          isExpanded={isExpanded}
                          isEditing={isEditing}
                          isEven={isEven}
                          isAdmin={isAdmin}
                          editValues={editValues}
                          colSpan={colSpan}
                          onToggle={() => toggleRow(substance.id)}
                          onStartEdit={() => openDetailEdit(substance)}
                          onCancelEdit={cancelEdit}
                          onSaveEdit={() => saveEdit(substance.id)}
                          onEditChange={setEditValues}
                          pictogramMode={pictogramMode}
                          onLinkGasType={isAdmin ? openLinkDialog : undefined}
                          cylinderSizes={cylinderSizes}
                        />
                      );
                    })}
                  </TableBody>
                </Table>
              </TooltipProvider>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Storage Tanks */}
      {bulkTanks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Container className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Bulkopslag</h3>
            <Badge variant="secondary" className="text-[10px]">{bulkTanks.length} tank(s)</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {bulkTanks.map(tank => {
              const pct = tank.capacity_kg > 0 ? (tank.current_level_kg / tank.capacity_kg) * 100 : 0;
              const isLow = pct < 20;
              const isBulkEditing = editingBulkId === tank.id;
              const inspectionOverdue = tank.next_inspection_date && new Date(tank.next_inspection_date) < new Date();

              return (
                <Card key={tank.id} className={cn("overflow-hidden transition-all", inspectionOverdue && "ring-1 ring-orange-400/50")}>
                  <CardContent className="p-4 space-y-3">
                    {/* Tank header */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full ring-2 ring-background shadow-sm flex-shrink-0"
                          style={{ backgroundColor: tank.gas_type_color }}
                        />
                        <div>
                          <p className="font-semibold text-sm leading-tight">{tank.tank_name}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{tank.tank_number}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <HazardPictograms symbols={tank.hazard_symbols} mode={pictogramMode} />
                      </div>
                    </div>

                    {/* Level bar */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Niveau</span>
                        <span className={cn("font-medium", isLow ? "text-orange-500" : "text-foreground")}>
                          {formatNumber(pct, 0)}%
                        </span>
                      </div>
                      <Progress
                        value={Math.min(pct, 100)}
                        className={cn(
                          "h-2.5 rounded-full",
                          isLow ? "[&>div]:bg-orange-500" : pct > 80 ? "[&>div]:bg-emerald-500" : "[&>div]:bg-primary"
                        )}
                      />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        {isBulkEditing ? (
                          <div className="space-y-2 w-full">
                            <Slider
                              value={[bulkEditValue]}
                              min={0}
                              max={bulkEditCapacity}
                              step={Math.max(1, Math.round(bulkEditCapacity / 100))}
                              onValueChange={([v]) => setBulkEditValue(v)}
                              className="w-full"
                            />
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="font-medium tabular-nums">{formatNumber(bulkEditValue, 0)} kg</span>
                              <div className="flex items-center gap-1">
                                <span className="text-muted-foreground">/</span>
                                <Input 
                                  type="number" 
                                  min={0}
                                  value={bulkEditCapacity}
                                  onChange={e => setBulkEditCapacity(Number(e.target.value) || 0)}
                                  className="h-6 w-20 text-[11px] px-2 py-0 text-right"
                                />
                                <span className="text-muted-foreground">kg</span>
                              </div>
                            </div>
                            <div className="flex gap-1 justify-end">
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => saveBulkEdit(tank.id)}>
                                <Check className="h-3 w-3 text-emerald-500" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setEditingBulkId(null)}>
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <span>{formatNumber(tank.current_level_kg, 0)} kg</span>
                            <div className="flex items-center gap-1">
                              <span>/ {formatNumber(tank.capacity_kg, 0)} kg</span>
                              {isAdmin && (
                                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => startBulkEdit(tank)}>
                                  <Pencil className="h-2.5 w-2.5 text-muted-foreground" />
                                </Button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Meta info */}
                    <Separator className="opacity-50" />
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <Badge variant="outline" className={cn("text-[9px] px-1 py-0 border", PGS_COLORS[tank.pgs_guideline] || "")}>
                          {tank.pgs_guideline}
                        </Badge>
                      </span>
                      {tank.un_number && <span className="font-mono">{tank.un_number}</span>}
                      {tank.next_inspection_date && (
                        <span className={cn("flex items-center gap-0.5", inspectionOverdue && "text-orange-500 font-medium")}>
                          <CalendarClock className="h-2.5 w-2.5" />
                          Keuring: {new Date(tank.next_inspection_date).toLocaleDateString("nl-NL")}
                        </span>
                      )}
                      <span>{tank.location === "sol_emmen" ? "Emmen" : "Tilburg"}</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer count */}
      {processedSubstances.length > 0 && (
        <p className="text-xs text-muted-foreground text-right">
          {processedSubstances.length} van {substances.length} stof(fen)
        </p>
      )}

      {/* Detail Edit Dialog */}
      <Dialog open={detailEditOpen} onOpenChange={setDetailEditOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-primary" />
              {detailEditForm.gas_type_name} bewerken
              <span className="text-muted-foreground font-normal text-sm">
                — {detailEditForm.pgs_guideline} · {detailEditForm.location === "sol_emmen" ? "Emmen" : "Tilburg"}
              </span>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="space-y-5 pr-4 pb-2">

              {/* GHS Symbol Picker */}
              <div className="space-y-2">
                <label className="text-sm font-semibold">Gevaarssymbolen (GHS)</label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(GHS_CONFIG).map(([code, cfg]) => {
                    const active = detailEditForm.hazard_symbols.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        onClick={() => setDetailEditForm(f => ({
                          ...f,
                          hazard_symbols: active
                            ? f.hazard_symbols.filter(s => s !== code)
                            : [...f.hazard_symbols, code],
                        }))}
                        className={cn(
                          "flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-all text-[10px] font-medium w-16",
                          active
                            ? "border-primary bg-primary/5 opacity-100"
                            : "border-border bg-muted/30 opacity-40 hover:opacity-70"
                        )}
                      >
                        <img src={cfg.src} alt={code} className="w-9 h-9" />
                        <span>{code}</span>
                      </button>
                    );
                  })}
                </div>
                {detailEditForm.hazard_symbols.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Geselecteerd: {detailEditForm.hazard_symbols.map(s => GHS_CONFIG[s]?.label).join(", ")}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Max kg */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Max. toegestaan (kg)</label>
                  <Input
                    type="number" min={0}
                    value={detailEditForm.max_allowed_kg}
                    onChange={e => setDetailEditForm(f => ({ ...f, max_allowed_kg: Number(e.target.value) }))}
                  />
                </div>
                {/* Huidig kg — only if not live */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Huidig (kg) <span className="text-muted-foreground font-normal text-xs">handmatig</span></label>
                  <Input
                    type="number" min={0}
                    value={detailEditForm.current_stock_kg}
                    onChange={e => setDetailEditForm(f => ({ ...f, current_stock_kg: Number(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* UN-nummer */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">UN-nummer</label>
                  <Input
                    placeholder="bijv. UN1978"
                    value={detailEditForm.un_number}
                    onChange={e => setDetailEditForm(f => ({ ...f, un_number: e.target.value }))}
                  />
                </div>
                {/* GEVI */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">GEVI-nummer</label>
                  <Input
                    placeholder="bijv. 23"
                    value={detailEditForm.gevi_number}
                    onChange={e => setDetailEditForm(f => ({ ...f, gevi_number: e.target.value }))}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Opslagklasse */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Opslagklasse</label>
                  <Input
                    placeholder="bijv. 2A"
                    value={detailEditForm.storage_class}
                    onChange={e => setDetailEditForm(f => ({ ...f, storage_class: e.target.value }))}
                  />
                </div>
                {/* WMS */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">WMS Classificatie</label>
                  <Input
                    placeholder="bijv. Ontvlambaar"
                    value={detailEditForm.wms_classification}
                    onChange={e => setDetailEditForm(f => ({ ...f, wms_classification: e.target.value }))}
                  />
                </div>
              </div>

              {/* Opslagplaats */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Opslagplaats <span className="font-normal text-muted-foreground text-xs">(fysieke locatie / hal)</span></label>
                <Input
                  placeholder="bijv. Vak A, Hal 3"
                  value={detailEditForm.storage_location}
                  onChange={e => setDetailEditForm(f => ({ ...f, storage_location: e.target.value }))}
                />
              </div>

              {/* H-zinnen */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">H-zinnen <span className="font-normal text-muted-foreground text-xs">(gevaarszinnen)</span></label>
                <Input
                  placeholder="bijv. H220; H280"
                  value={detailEditForm.risk_phrases}
                  onChange={e => setDetailEditForm(f => ({ ...f, risk_phrases: e.target.value }))}
                />
              </div>

              {/* P-zinnen */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium">P-zinnen <span className="font-normal text-muted-foreground text-xs">(veiligheidsaanbevelingen)</span></label>
                <Input
                  placeholder="bijv. P210; P377; P381"
                  value={detailEditForm.safety_phrases}
                  onChange={e => setDetailEditForm(f => ({ ...f, safety_phrases: e.target.value }))}
                />
              </div>

            </div>
          </ScrollArea>

          <div className="flex items-center justify-between pt-3 border-t shrink-0">
            <Button 
              variant="outline" 
              className="text-destructive hover:text-white hover:bg-destructive hover:border-destructive h-9 gap-1.5"
              onClick={deleteDetailEdit}
              disabled={detailEditSaving}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Verberg uit register</span>
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setDetailEditOpen(false)} disabled={detailEditSaving}>
                Annuleren
              </Button>
              <Button onClick={saveDetailEdit} disabled={detailEditSaving} className="min-w-[90px]">
                {detailEditSaving ? "Opslaan..." : "Opslaan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add New Substance Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Nieuwe PGS-stof toevoegen
            </DialogTitle>
            <DialogDescription>
              Vul de gegevens in. Als de gasnaam nog niet bestaat wordt er automatisch een nieuw gastype aangemaakt.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Gas naam */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Gasnaam *</label>
              <Input
                placeholder="bijv. Propaan"
                list="gas-type-suggestions"
                value={addForm.gas_type_name}
                onChange={e => setAddForm(f => ({ ...f, gas_type_name: e.target.value }))}
              />
              <datalist id="gas-type-suggestions">
                {allGasTypes.map(gt => <option key={gt.id} value={gt.name} />)}
              </datalist>
              {addForm.gas_type_name && !allGasTypes.some(gt => gt.name.toLowerCase() === addForm.gas_type_name.toLowerCase()) && (
                <p className="text-xs text-amber-600">Nieuw gastype — wordt aangemaakt bij opslaan.</p>
              )}
            </div>

            {/* Locatie */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Locatie *</label>
              <div className="flex gap-3">
                {(["sol_emmen", "sol_tilburg"] as const).map(loc => (
                  <label key={loc} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="add-location"
                      value={loc}
                      checked={addForm.location === loc}
                      onChange={() => setAddForm(f => ({ ...f, location: loc }))}
                      className="accent-primary"
                    />
                    <span className="text-sm">{loc === "sol_emmen" ? "Emmen" : "Tilburg"}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* PGS Richtlijn */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium">PGS Richtlijn *</label>
              <Select value={addForm.pgs_guideline} onValueChange={v => setAddForm(f => ({ ...f, pgs_guideline: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...new Set(["PGS 9", "PGS 15", "PGS 16", ...guidelines])].map(g => (
                    <SelectItem key={g} value={g}>{g}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Max kg + Huidig kg side by side */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Max. toegestaan (kg) *</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={addForm.max_allowed_kg}
                  onChange={e => setAddForm(f => ({ ...f, max_allowed_kg: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Huidig (kg)</label>
                <Input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={addForm.current_stock_kg}
                  onChange={e => setAddForm(f => ({ ...f, current_stock_kg: e.target.value }))}
                />
              </div>
            </div>

            {/* UN-nummer */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">UN-nummer <span className="font-normal">(optioneel)</span></label>
              <Input
                placeholder="bijv. UN1978"
                value={addForm.un_number}
                onChange={e => setAddForm(f => ({ ...f, un_number: e.target.value }))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <Button variant="outline" onClick={() => setAddDialogOpen(false)} disabled={addSaving}>
              Annuleren
            </Button>
            <Button onClick={handleAddSubstance} disabled={addSaving || !addForm.gas_type_name.trim() || Number(addForm.max_allowed_kg) <= 0}>
              {addSaving ? "Opslaan..." : "Toevoegen"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Link Gas Type Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Gastype koppelen
            </DialogTitle>
            <DialogDescription>
              Koppel deze onbekende stof aan een bestaand gastype.
              {linkingSubstance?.notes && (
                <span className="block mt-2 text-xs bg-muted rounded-md px-3 py-2">
                  <strong>Opmerking:</strong> {linkingSubstance.notes}
                </span>
              )}
              {linkingSubstance?.un_number && (
                <span className="block mt-1 text-xs">
                  <strong>UN-nummer:</strong> {linkingSubstance.un_number}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Select onValueChange={handleLinkGasType}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecteer een gastype..." />
              </SelectTrigger>
              <SelectContent>
                {allGasTypes.map(gt => (
                  <SelectItem key={gt.id} value={gt.id}>{gt.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </DialogContent>
      </Dialog>
      <StoragePlacesManager
        open={placesManagerOpen}
        onOpenChange={setPlacesManagerOpen}
        isAdmin={isAdmin}
        initialLocation={locationTab !== "both" ? (locationTab as any) : "sol_emmen"}
      />
      <PGSAssignStoragePlaceDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        isAdmin={isAdmin}
        defaultLocation={locationTab !== "both" ? (locationTab as any) : "sol_emmen"}
        onChanged={() => { /* substances kept in local state — refresh via tab switch */ }}
      />
      <PGSExpansionRequestsDialog
        open={expansionDialogOpen}
        onOpenChange={setExpansionDialogOpen}
        isAdmin={isAdmin}
        defaultLocation={locationTab !== "both" ? (locationTab as any) : "sol_emmen"}
      />
    </div>
  );
}

// Extracted row component for clarity
interface SubstanceRowProps {
  substance: PGSSubstance;
  pct: number;
  isWarning: boolean;
  isCritical: boolean;
  isExpanded: boolean;
  isEditing: boolean;
  isEven: boolean;
  isAdmin: boolean;
  editValues: { max_allowed_kg: number; current_stock_kg: number };
  colSpan: number;
  pictogramMode: PictogramMode;
  cylinderSizes: Array<{ id: string; name: string; capacity_liters: number | null }>;
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditChange: (v: { max_allowed_kg: number; current_stock_kg: number }) => void;
  onLinkGasType?: (substance: PGSSubstance) => void;
}

function SubstanceRow({
  substance, pct, isWarning, isCritical, isExpanded, isEditing, isEven,
  isAdmin, editValues, colSpan, pictogramMode, cylinderSizes, onToggle, onStartEdit, onCancelEdit, onSaveEdit, onEditChange, onLinkGasType,
}: SubstanceRowProps) {
  const pgsClass = PGS_COLORS[substance.pgs_guideline] || "bg-muted text-muted-foreground border-border";
  const isUnknown = substance.gas_type_name === "Onbekend";
  const [showCalc, setShowCalc] = useState(false);
  // count per size; kgPerCyl only used when gas type is unknown
  const [cylEntries, setCylEntries] = useState<Record<string, { count: string; kgPerCyl: string }>>({});

  // Auto kg/L from gas type lookup (null = manual entry needed)
  const gasKgPerLiter = getGasKgPerLiter(substance.gas_type_name || "");

  const calcTotal = cylinderSizes.reduce((sum, size) => {
    const e = cylEntries[size.id];
    const count = parseFloat(e?.count || "0") || 0;
    const kgPerCyl =
      gasKgPerLiter !== null && size.capacity_liters != null
        ? size.capacity_liters * gasKgPerLiter
        : parseFloat(e?.kgPerCyl || "0") || 0;
    return sum + count * kgPerCyl;
  }, 0);

  const setCylEntry = (id: string, field: "count" | "kgPerCyl", val: string) =>
    setCylEntries(prev => ({ ...prev, [id]: { ...(prev[id] || { count: "", kgPerCyl: "" }), [field]: val } }));

  return (
    <>
      <TableRow
        className={cn(
          "transition-colors cursor-pointer",
          isWarning && !isCritical && "bg-orange-500/5 hover:bg-orange-500/10",
          isCritical && "bg-destructive/5 hover:bg-destructive/10",
          !isWarning && isEven && "bg-muted/20",
        )}
        onClick={onToggle}
      >
        <TableCell className="p-2" onClick={e => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggle}>
            <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
              <ChevronRight className="h-3.5 w-3.5" />
            </motion.div>
          </Button>
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 ring-2 ring-background shadow-sm"
              style={{ backgroundColor: substance.gas_type_color }}
            />
            <span className={cn("font-semibold text-sm", isUnknown && "text-orange-500 dark:text-orange-400")}>
              {substance.gas_type_name}
            </span>
            {isUnknown && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-orange-400/50 bg-orange-500/10 text-orange-600 dark:text-orange-400 gap-1">
                    <AlertTriangle className="h-2.5 w-2.5" />
                    Niet gekoppeld
                  </Badge>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-xs text-xs">
                  <p className="font-medium">Geen gastype gekoppeld</p>
                  <p className="text-muted-foreground mt-0.5">
                    Deze stof is niet gekoppeld aan een gastype — live voorraadberekening is niet mogelijk.
                    {substance.notes && <span className="block mt-1"><strong>Info:</strong> {substance.notes}</span>}
                    {substance.un_number && <span className="block"><strong>UN:</strong> {substance.un_number}</span>}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
            {isAdmin && onLinkGasType && (isUnknown || !substance.live) && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5 text-primary hover:text-primary"
                    onClick={(e) => { e.stopPropagation(); onLinkGasType(substance); }}
                  >
                    <Link2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">{isUnknown ? "Koppel aan gastype" : "Gastype opnieuw koppelen"}</TooltipContent>
              </Tooltip>
            )}
            {substance.location && (
              <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-normal">
                {substance.location === "sol_emmen" ? "Emmen" : "Tilburg"}
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant="outline" className={cn("text-[11px] font-semibold border", pgsClass)}>
            {substance.pgs_guideline}
          </Badge>
        </TableCell>
        <TableCell className="text-sm font-mono text-muted-foreground">{substance.un_number || "—"}</TableCell>
        <TableCell onClick={e => e.stopPropagation()}>
          <div className="flex gap-1.5 items-center">
            <HazardPictograms symbols={substance.hazard_symbols || []} mode={pictogramMode} />
          </div>
        </TableCell>
        <TableCell className="text-xs font-mono text-muted-foreground">{substance.gevi_number || "—"}</TableCell>
        <TableCell className="text-xs text-muted-foreground">{substance.wms_classification || "—"}</TableCell>
        <TableCell className="w-36" onClick={e => e.stopPropagation()}>
          <Popover>
            <PopoverTrigger asChild>
              <div className="space-y-1 cursor-pointer hover:opacity-80 transition-opacity">
                <Progress
                  value={Math.min(pct, 100)}
                  className={cn(
                    "h-2 rounded-full",
                    isCritical && "[&>div]:bg-destructive",
                    isWarning && !isCritical && "[&>div]:bg-orange-500",
                    !isWarning && "[&>div]:bg-emerald-500"
                  )}
                />
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "text-[10px] font-medium",
                    isCritical ? "text-destructive" : isWarning ? "text-orange-500" : "text-muted-foreground"
                  )}>
                    {formatNumber(pct, 0)}%
                  </span>
                  {isCritical && <AlertTriangle className="h-3 w-3 text-destructive" />}
                </div>
              </div>
            </PopoverTrigger>
            <PopoverContent className="w-[520px] p-0" align="end" side="left">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <Container className="h-4 w-4 text-primary" />
                  Cilinderoverzicht
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-2.5 h-2.5 rounded-full ring-1 ring-background"
                    style={{ backgroundColor: substance.gas_type_color }}
                  />
                  <span className="text-xs font-medium text-foreground">{substance.gas_type_name}</span>
                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                    {substance.location === "sol_emmen" ? "Emmen" : "Tilburg"}
                  </Badge>
                </div>
              </div>
              {substance.live && substance.liveCylinderBreakdown && substance.liveCylinderBreakdown.length > 0 ? (
                <>
                  <div className="px-3 py-1.5 bg-emerald-50 dark:bg-emerald-950/20 border-b flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                    <Zap className="h-3 w-3" />
                    Live data uit Voorraad tabel
                  </div>
                  <ScrollArea className="h-auto max-h-[400px] overflow-auto">
                    <div className="p-3">
                      <div className="space-y-1">
                        {substance.liveCylinderBreakdown.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-3 rounded-md px-2.5 py-1.5 hover:bg-muted/50 transition-colors text-xs"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-foreground font-medium leading-tight break-words">
                                {item.description || "Onbekend type"}
                              </p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {item.capacity} L cilinder
                              </p>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0 tabular-nums">
                              <div className="text-center min-w-[36px]">
                                <span className="font-semibold text-foreground">{item.count}</span>
                                <p className="text-[9px] text-muted-foreground leading-none mt-0.5">stuks</p>
                              </div>
                              <div className="text-right min-w-[52px]">
                                <span className="font-semibold">{formatNumber(item.weightKg, 1)}</span>
                                <p className="text-[9px] text-muted-foreground leading-none mt-0.5">kg</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                  <div className="px-4 py-2.5 border-t bg-muted/30 flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground">Totaal</span>
                    <div className="flex items-center gap-4 tabular-nums">
                      <span className="text-muted-foreground">
                        {substance.liveCylinderBreakdown.reduce((s, i) => s + i.count, 0)} stuks
                      </span>
                      <span className="font-bold">
                        {formatNumber(substance.liveCylinderBreakdown.reduce((s, i) => s + i.weightKg, 0), 1)} kg
                      </span>
                    </div>
                  </div>
                </>
              ) : substance.cylinder_breakdown && substance.cylinder_breakdown.length > 0 ? (
                <ScrollArea className="h-auto max-h-[400px] overflow-auto">
                  <div className="p-3">
                    <div className="space-y-1">
                      {substance.cylinder_breakdown.map((item, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-3 rounded-md px-2.5 py-1.5 hover:bg-muted/50 transition-colors text-xs"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-foreground font-medium leading-tight break-words">
                              {item.description}
                            </p>
                            <p className="text-[10px] text-muted-foreground mt-0.5">
                              {item.capacity}L cilinder
                            </p>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0 tabular-nums">
                            <div className="text-center min-w-[36px]">
                              <span className="font-semibold text-foreground">{item.countVol + item.countLeeg}</span>
                              <p className="text-[9px] text-muted-foreground leading-none mt-0.5">stuks</p>
                            </div>
                            <div className="text-right min-w-[52px]">
                              <span className="font-semibold">{formatNumber(item.weightKg, 1)}</span>
                              <p className="text-[9px] text-muted-foreground leading-none mt-0.5">kg</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </ScrollArea>
              ) : (
                <div className="px-4 py-8 text-center">
                  <Container className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Geen cilinderdata beschikbaar</p>
                  <p className="text-[10px] text-muted-foreground/70 mt-1">
                    Controleer of dit gastype een koppeling heeft in de Voorraad tabel
                  </p>
                </div>
              )}
              {!substance.live && substance.cylinder_breakdown && substance.cylinder_breakdown.length > 0 && (
                <div className="px-4 py-2.5 border-t bg-muted/30 flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">Totaal</span>
                  <div className="flex items-center gap-4 tabular-nums">
                    <span className="text-muted-foreground">
                      {substance.cylinder_breakdown.reduce((s, i) => s + i.countVol + i.countLeeg, 0)} stuks
                    </span>
                    <span className="font-bold">
                      {formatNumber(substance.cylinder_breakdown.reduce((s, i) => s + i.weightKg, 0), 1)} kg
                    </span>
                  </div>
                </div>
              )}
            </PopoverContent>
          </Popover>
        </TableCell>
        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
          {isEditing ? (
            <Input
              type="number"
              value={editValues.max_allowed_kg}
              onChange={e => onEditChange({ ...editValues, max_allowed_kg: Number(e.target.value) })}
              className="h-7 w-24 text-right text-sm ml-auto"
            />
          ) : (
            <span className="text-sm tabular-nums">{formatNumber(substance.max_allowed_kg, 0)}</span>
          )}
        </TableCell>
        <TableCell className="text-right" onClick={e => e.stopPropagation()}>
          {isEditing && !substance.live ? (
            <div className="flex items-center justify-end gap-1">
              <Input
                type="number"
                value={editValues.current_stock_kg}
                onChange={e => onEditChange({ ...editValues, current_stock_kg: Number(e.target.value) })}
                className="h-7 w-20 text-right text-sm"
              />
              {cylinderSizes.length > 0 && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={showCalc ? "secondary" : "ghost"}
                      size="icon"
                      className="h-7 w-7 shrink-0"
                      onClick={() => setShowCalc(v => !v)}
                    >
                      <Calculator className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs">Bereken via cilinders</TooltipContent>
                </Tooltip>
              )}
            </div>
          ) : substance.live ? (
            <div className="flex items-center justify-end gap-1.5">
              <span className={cn("text-sm tabular-nums font-semibold", isWarning && "text-destructive")}>
                {formatNumber(substance.liveStockKg ?? 0, 0)}
              </span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="flex items-center gap-0.5 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium cursor-help">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    live
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Automatisch berekend vanuit de live Voorraad tabel</TooltipContent>
              </Tooltip>
            </div>
          ) : (
            <div className="flex items-center justify-end gap-1.5">
              <span className={cn("text-sm tabular-nums", isWarning && "font-bold text-destructive")}>
                {formatNumber(substance.current_stock_kg, 0)}
              </span>
              <span className="text-[10px] text-muted-foreground/50">handmatig</span>
            </div>
          )}
        </TableCell>
        <TableCell className="text-xs text-muted-foreground">{substance.storage_location || "—"}</TableCell>
        {isAdmin && (
          <TableCell onClick={e => e.stopPropagation()}>
            {isEditing ? (
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onSaveEdit}>
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onCancelEdit}>
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </div>
            ) : (
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onStartEdit}>
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            )}
          </TableCell>
        )}
      </TableRow>

      {/* Cylinder calculator panel */}
      <AnimatePresence>
        {isEditing && showCalc && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={colSpan} className="p-0 border-b border-border/20">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-6 py-3 bg-blue-50/60 dark:bg-blue-950/20 border-l-2 border-blue-400/50">
                  <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1.5">
                    <Calculator className="h-3.5 w-3.5" />
                    Bereken voorraad via cilinders
                    {gasKgPerLiter !== null && (
                      <span className="ml-1 font-normal text-[10px] text-blue-500 dark:text-blue-400">
                        ({substance.gas_type_name} — {gasKgPerLiter} kg/L · 200 bar)
                      </span>
                    )}
                  </p>
                  <div className="space-y-1.5">
                    {/* Header */}
                    <div className="grid grid-cols-[130px_56px_96px_16px_80px_16px_76px] gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wide pb-1 border-b border-border/30">
                      <span>Maat</span>
                      <span>Inhoud</span>
                      <span className="text-center">kg/cilinder</span>
                      <span />
                      <span className="text-center">Aantal</span>
                      <span />
                      <span className="text-right">Subtotaal</span>
                    </div>
                    {cylinderSizes.map(size => {
                      const e = cylEntries[size.id] || { count: "", kgPerCyl: "" };
                      const autoKgPerCyl =
                        gasKgPerLiter !== null && size.capacity_liters != null
                          ? size.capacity_liters * gasKgPerLiter
                          : null;
                      const kgPerCyl = autoKgPerCyl ?? (parseFloat(e.kgPerCyl) || 0);
                      const count = parseFloat(e.count) || 0;
                      const sub = count * kgPerCyl;
                      return (
                        <div key={size.id} className="grid grid-cols-[130px_56px_96px_16px_80px_16px_76px] gap-1.5 items-center">
                          <span className="text-xs font-medium">{size.name}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {size.capacity_liters ? `${size.capacity_liters} L` : "—"}
                          </span>
                          {/* kg per cylinder — auto or manual */}
                          {autoKgPerCyl !== null ? (
                            <span className="text-xs text-center tabular-nums text-emerald-700 dark:text-emerald-400 font-medium">
                              {autoKgPerCyl % 1 === 0 ? autoKgPerCyl.toFixed(0) : autoKgPerCyl.toFixed(2)} kg
                            </span>
                          ) : (
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              placeholder="kg/cil."
                              value={e.kgPerCyl}
                              onChange={ev => setCylEntry(size.id, "kgPerCyl", ev.target.value)}
                              className="h-6 text-xs text-center px-1"
                            />
                          )}
                          <span className="text-[10px] text-muted-foreground text-center">×</span>
                          <Input
                            type="number"
                            min="0"
                            placeholder="0"
                            value={e.count}
                            onChange={ev => setCylEntry(size.id, "count", ev.target.value)}
                            className="h-6 text-xs text-center px-1"
                          />
                          <span className="text-[10px] text-muted-foreground text-center">=</span>
                          <span className={cn(
                            "text-xs text-right tabular-nums",
                            sub > 0 ? "text-foreground font-medium" : "text-muted-foreground"
                          )}>
                            {sub > 0 ? `${sub % 1 === 0 ? sub.toFixed(0) : sub.toFixed(1)} kg` : "—"}
                          </span>
                        </div>
                      );
                    })}
                    <div className="flex items-center justify-between pt-2 border-t border-border/30 mt-1">
                      <span className="text-sm font-semibold">
                        Totaal: <span className="text-blue-700 dark:text-blue-300">{calcTotal % 1 === 0 ? calcTotal.toFixed(0) : calcTotal.toFixed(1)} kg</span>
                      </span>
                      <Button
                        size="sm"
                        className="h-7 text-xs gap-1.5"
                        disabled={calcTotal === 0}
                        onClick={() => {
                          onEditChange({ ...editValues, current_stock_kg: Math.round(calcTotal * 10) / 10 });
                          setShowCalc(false);
                        }}
                      >
                        <Check className="h-3 w-3" />
                        Gebruik {calcTotal % 1 === 0 ? calcTotal.toFixed(0) : calcTotal.toFixed(1)} kg
                      </Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>

      {/* Expanded details */}
      <AnimatePresence>
        {isExpanded && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={colSpan} className="p-0 border-b-2 border-border/30">
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
                className="overflow-hidden"
              >
                <div className="px-6 py-4 bg-muted/20 space-y-4">
                  {/* Unknown substance alert */}
                  {isUnknown && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-orange-500/10 border border-orange-400/30">
                      <HelpCircle className="h-4 w-4 text-orange-500 flex-shrink-0 mt-0.5" />
                      <div className="text-xs space-y-1">
                        <p className="font-semibold text-orange-600 dark:text-orange-400">Onbekende stof — niet gekoppeld aan een gastype</p>
                        <p className="text-muted-foreground">
                          Deze stof heeft geen koppeling met een gastype — daardoor kan de voorraad niet automatisch worden berekend.
                          Gebruik de koppelknop (<Link2 className="h-3 w-3 inline" />) om dit op te lossen.
                        </p>
                        {substance.notes && (
                          <p className="text-foreground"><strong>Opmerking:</strong> {substance.notes}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Three sections */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Identification */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <Activity className="h-3 w-3" />
                        Identificatie
                      </h4>
                      <Separator className="opacity-50" />
                      <div className="space-y-1.5 text-sm">
                        <DetailRow label="UN-nummer" value={substance.un_number} mono />
                        <DetailRow label="CAS-nummer" value={substance.cas_number} mono />
                        <DetailRow label="PGS-richtlijn" value={substance.pgs_guideline} />
                        <DetailRow label="GEVI-nummer" value={substance.gevi_number} mono />
                        <DetailRow label="WMS-klasse" value={substance.wms_classification} />
                      </div>
                    </div>

                    {/* Storage */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <MapPin className="h-3 w-3" />
                        Opslag
                      </h4>
                      <Separator className="opacity-50" />
                      <div className="space-y-1.5 text-sm">
                        <DetailRow label="Opslagklasse" value={substance.storage_class} />
                        <DetailRow label="Locatie" value={substance.location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg"} />
                        <DetailRow label="Opslagplaats" value={substance.storage_location} />
                        {substance.notes && <DetailRow label="Opmerking" value={substance.notes} />}
                      </div>
                    </div>

                    {/* Safety */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                        <ShieldAlert className="h-3 w-3" />
                        Veiligheid
                      </h4>
                      <Separator className="opacity-50" />
                      <div className="space-y-2">
                        {substance.risk_phrases && (
                          <div>
                            <span className="text-[11px] text-muted-foreground font-medium">H-zinnen</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {substance.risk_phrases.split(",").map((h, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive border-destructive/20">
                                  {h.trim()}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {substance.safety_phrases && (
                          <div>
                            <span className="text-[11px] text-muted-foreground font-medium">P-zinnen</span>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {substance.safety_phrases.split(",").map((p, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 bg-blue-500/10 text-blue-700 dark:text-blue-300 border-blue-500/20">
                                  {p.trim()}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {!substance.risk_phrases && !substance.safety_phrases && (
                          <p className="text-xs text-muted-foreground italic">Geen H/P-zinnen beschikbaar</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            </TableCell>
          </TableRow>
        )}
      </AnimatePresence>
    </>
  );
}

function DetailRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("text-foreground", mono && "font-mono")}>{value || "—"}</span>
    </div>
  );
}

export default PGSRegistry;
