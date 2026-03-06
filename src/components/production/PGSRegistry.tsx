import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { toast } from "sonner";
import { cn, formatNumber } from "@/lib/utils";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// GHS pictogram config with diamond styling
const GHS_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  GHS01: { color: "hsl(24 95% 53%)", label: "Explosief", icon: "01" },
  GHS02: { color: "hsl(0 84% 60%)", label: "Ontvlambaar", icon: "02" },
  GHS03: { color: "hsl(45 93% 47%)", label: "Oxiderend", icon: "03" },
  GHS04: { color: "hsl(217 91% 60%)", label: "Samengeperst gas", icon: "04" },
  GHS05: { color: "hsl(271 81% 56%)", label: "Corrosief", icon: "05" },
  GHS06: { color: "hsl(0 72% 38%)", label: "Giftig", icon: "06" },
  GHS07: { color: "hsl(24 95% 64%)", label: "Schadelijk", icon: "07" },
  GHS08: { color: "hsl(330 81% 60%)", label: "Gezondheidsgevaar", icon: "08" },
  GHS09: { color: "hsl(160 84% 39%)", label: "Milieugevaarlijk", icon: "09" },
};

// PGS guideline color mapping
const PGS_COLORS: Record<string, string> = {
  "PGS 9": "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
  "PGS 16": "bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30",
  "PGS 15": "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
};

function GHSDiamond({ symbol }: { symbol: string }) {
  const config = GHS_CONFIG[symbol];
  if (!config) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className="relative w-7 h-7 cursor-default"
          style={{ transform: "rotate(45deg)" }}
        >
          <div
            className="absolute inset-0 border-2 bg-background"
            style={{ borderColor: config.color }}
          />
          <span
            className="absolute inset-0 flex items-center justify-center text-[9px] font-black"
            style={{ transform: "rotate(-45deg)", color: config.color }}
          >
            {config.icon}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs font-medium">
        {symbol} — {config.label}
      </TooltipContent>
    </Tooltip>
  );
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
  gas_type_name?: string;
  gas_type_color?: string;
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
  gas_type_name?: string;
  gas_type_color?: string;
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
  gas_type_name?: string;
  gas_type_color?: string;
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

      const { data, error } = await query;
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

      setSubstances((data || []).map(s => ({
        ...s,
        hazard_symbols: s.hazard_symbols || [],
        gas_type_name: s.gas_type_id ? gasTypeMap[s.gas_type_id]?.name || "Onbekend" : "Onbekend",
        gas_type_color: s.gas_type_id ? gasTypeMap[s.gas_type_id]?.color || "#6b7280" : "#6b7280",
      })));
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
        gas_type_name: t.gas_type_id ? gasTypeMap[t.gas_type_id]?.name || "Onbekend" : "Onbekend",
        gas_type_color: t.gas_type_id ? gasTypeMap[t.gas_type_id]?.color || "#6b7280" : "#6b7280",
      })));
    } catch (err) {
      console.error("Error fetching bulk tanks:", err);
    }
  }, [locationTab]);

  useEffect(() => {
    fetchSubstances();
    fetchBulkTanks();
  }, [fetchSubstances, fetchBulkTanks]);

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
      "GHS Symbolen": (s.hazard_symbols || []).join(", "),
      "Max. Toegestaan (kg)": s.max_allowed_kg,
      "Huidige Voorraad (kg)": s.current_stock_kg,
      "Bezetting (%)": s.max_allowed_kg > 0 ? Math.round((s.current_stock_kg / s.max_allowed_kg) * 100) : 0,
      "H-zinnen": s.risk_phrases || "",
      "P-zinnen": s.safety_phrases || "",
      Locatie: s.location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg",
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
    const head = [["Gas", "PGS", "UN", "CAS", "GHS", "Opslagkl.", "Max (kg)", "Huidig (kg)", "Bez. (%)", "H-zinnen", "P-zinnen", "Locatie"]];
    const body = processedSubstances.map(s => {
      const pct = s.max_allowed_kg > 0 ? Math.round((s.current_stock_kg / s.max_allowed_kg) * 100) : 0;
      return [
        s.gas_type_name || "",
        s.pgs_guideline,
        s.un_number || "—",
        s.cas_number || "—",
        (s.hazard_symbols || []).join(", "),
        s.storage_class || "—",
        formatNumber(s.max_allowed_kg, 0),
        formatNumber(s.current_stock_kg, 0),
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

  const getPct = (s: PGSSubstance) => s.max_allowed_kg > 0 ? (s.current_stock_kg / s.max_allowed_kg) * 100 : 0;

  const processedSubstances = useMemo(() => {
    let result = substances.filter(s => {
      if (filterGuideline !== "all" && s.pgs_guideline !== filterGuideline) return false;
      if (filterStorageClass !== "all" && s.storage_class !== filterStorageClass) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchName = s.gas_type_name?.toLowerCase().includes(q);
        const matchUN = s.un_number?.toLowerCase().includes(q);
        const matchCAS = s.cas_number?.toLowerCase().includes(q);
        const matchPGS = s.pgs_guideline.toLowerCase().includes(q);
        if (!matchName && !matchUN && !matchCAS && !matchPGS) return false;
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

  const colSpan = isAdmin ? 9 : 8;

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
          <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-1.5">
            <FileText className="h-4 w-4" />
            PDF
          </Button>
          <Button variant="outline" size="sm" onClick={exportToExcel} className="gap-1.5">
            <Download className="h-4 w-4" />
            Excel
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

        <div className="flex-1" />

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-52">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Zoek gas, UN, CAS..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={filterGuideline} onValueChange={setFilterGuideline}>
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue placeholder="PGS Richtlijn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle richtlijnen</SelectItem>
              {guidelines.map(g => (
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
                {storageClasses.map(sc => (
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
                      <TableHead>GHS</TableHead>
                      <TableHead
                        className="cursor-pointer select-none group"
                        onClick={() => handleSort("pct")}
                      >
                        <span className="inline-flex items-center gap-1">Bezetting <SortIcon field="pct" /></span>
                      </TableHead>
                      <TableHead className="text-right">Max (kg)</TableHead>
                      <TableHead className="text-right">Huidig (kg)</TableHead>
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
                          onStartEdit={() => startEdit(substance)}
                          onCancelEdit={cancelEdit}
                          onSaveEdit={() => saveEdit(substance.id)}
                          onEditChange={setEditValues}
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
                        {tank.hazard_symbols.map(sym => (
                          <GHSDiamond key={sym} symbol={sym} />
                        ))}
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
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-muted-foreground w-12">Niveau:</span>
                              <Input
                                type="number"
                                value={bulkEditValue}
                                onChange={e => setBulkEditValue(Number(e.target.value))}
                                className="h-6 w-20 text-[11px] text-right"
                              />
                              <span className="text-muted-foreground">kg</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-muted-foreground w-12">Cap.:</span>
                              <Input
                                type="number"
                                value={bulkEditCapacity}
                                onChange={e => setBulkEditCapacity(Number(e.target.value))}
                                className="h-6 w-20 text-[11px] text-right"
                              />
                              <span className="text-muted-foreground">kg</span>
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
  onToggle: () => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditChange: (v: { max_allowed_kg: number; current_stock_kg: number }) => void;
}

function SubstanceRow({
  substance, pct, isWarning, isCritical, isExpanded, isEditing, isEven,
  isAdmin, editValues, colSpan, onToggle, onStartEdit, onCancelEdit, onSaveEdit, onEditChange,
}: SubstanceRowProps) {
  const pgsClass = PGS_COLORS[substance.pgs_guideline] || "bg-muted text-muted-foreground border-border";

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
            <span className="font-semibold text-sm">{substance.gas_type_name}</span>
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
            {(substance.hazard_symbols || []).map(sym => (
              <GHSDiamond key={sym} symbol={sym} />
            ))}
          </div>
        </TableCell>
        <TableCell className="w-36">
          <div className="space-y-1">
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
          {isEditing ? (
            <Input
              type="number"
              value={editValues.current_stock_kg}
              onChange={e => onEditChange({ ...editValues, current_stock_kg: Number(e.target.value) })}
              className="h-7 w-24 text-right text-sm ml-auto"
            />
          ) : (
            <span className={cn("text-sm tabular-nums", isWarning && "font-bold text-destructive")}>
              {formatNumber(substance.current_stock_kg, 0)}
            </span>
          )}
        </TableCell>
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
