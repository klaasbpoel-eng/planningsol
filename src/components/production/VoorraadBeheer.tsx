import { useState, useMemo, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { cn, formatNumber } from "@/lib/utils";
import { getStockStatus, type StockStatus } from "./StockStatusBadge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Search,
  Printer,
  RefreshCw,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Info,
  Cylinder,
  X,
  MapPin,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";
type SortField = "subCode" | "description" | "locatie" | "numberOnStock" | "capacity" | "dailyRate" | "difference" | "avgInterval";
type SortDir = "asc" | "desc";

interface StockRow {
  subCode: string;
  description: string;
  locatie: "emmen" | "tilburg";
  capacity: number;
  numberOnStock: number;
  totalAfname: number;
  spanDays: number;
  dailyRate: number;
  difference: number;
  deliveryCount: number;
  avgInterval: number | null;
  lastDelivery: Date | null;
}

interface VoorraadBeheerProps {
  selectedLocation?: ProductionLocation;
  refreshKey?: number;
}

// Parse Datum from jsonb — handles ISO strings, numbers, arrays, and objects
function parseDatum(raw: unknown): Date | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof raw === "number") {
    const d = new Date(raw);
    return isNaN(d.getTime()) ? null : d;
  }
  if (Array.isArray(raw) && raw.length > 0) return parseDatum(raw[0]);
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.date ?? obj.value ?? obj.datum ?? Object.values(obj)[0];
    return parseDatum(candidate);
  }
  return null;
}

async function fetchAllRows(tableName: string): Promise<any[]> {
  const all: any[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await (supabase.from(tableName as never) as any)
      .select("*")
      .order("created_at", { ascending: true }) // Cache buster / sorting
      .range(from, from + PAGE - 1);
    if (error) {
      console.error(`[fetchAllRows] Error fetching "${tableName}":`, error);
      throw new Error(`${tableName}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`[fetchAllRows] "${tableName}": ${all.length} rows`);
  return all;
}

const STATUS_CONFIG: Record<StockStatus, {
  label: string;
  icon: typeof ShieldAlert;
  color: string;
  textColor: string;
  bg: string;
  rowBg: string;
  border: string;
}> = {
  critical: {
    label: "Kritiek",
    icon: ShieldAlert,
    color: "text-red-600",
    textColor: "text-red-700",
    bg: "bg-red-100 hover:bg-red-200 text-red-700 border-red-300",
    rowBg: "bg-red-50 dark:bg-red-950/20",
    border: "border-l-red-500",
  },
  low: {
    label: "Laag",
    icon: AlertTriangle,
    color: "text-orange-500",
    textColor: "text-orange-700",
    bg: "bg-orange-100 hover:bg-orange-200 text-orange-700 border-orange-300",
    rowBg: "bg-orange-50 dark:bg-orange-950/20",
    border: "border-l-orange-400",
  },
  ok: {
    label: "Goed",
    icon: CheckCircle,
    color: "text-green-600",
    textColor: "text-green-700",
    bg: "bg-green-100 hover:bg-green-200 text-green-700 border-green-300",
    rowBg: "",
    border: "border-l-green-400",
  },
  surplus: {
    label: "Over",
    icon: TrendingUp,
    color: "text-cyan-500",
    textColor: "text-cyan-700",
    bg: "bg-cyan-100 hover:bg-cyan-200 text-cyan-700 border-cyan-300",
    rowBg: "bg-cyan-50/50 dark:bg-cyan-950/10",
    border: "border-l-cyan-400",
  },
};

export function VoorraadBeheer({ selectedLocation = "all", refreshKey }: VoorraadBeheerProps) {
  const [allRows, setAllRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StockStatus | null>(null);
  const [locFilter, setLocFilter] = useState<"all" | "emmen" | "tilburg">(() => {
    if (selectedLocation === "sol_emmen") return "emmen";
    if (selectedLocation === "sol_tilburg") return "tilburg";
    return "all";
  });

  useEffect(() => {
    if (selectedLocation === "sol_emmen") setLocFilter("emmen");
    else if (selectedLocation === "sol_tilburg") setLocFilter("tilburg");
    else setLocFilter("all");
  }, [selectedLocation]);

  const [sortField, setSortField] = useState<SortField>("difference");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [debugText, setDebugText] = useState<string>("Loading debug...");
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [voorraadRows, afnameRows] = await Promise.all([
        fetchAllRows("Voorraad"),
        fetchAllRows("Afname"),
      ]);
      // --- Aggregate Voorraad by description + locatie + capacity ---
      // Exclude empty cylinders (description contains "Leeg" / "leeg")
      // Column names: ContentDescription, CD_CONTENT_TYPE, DS_CENTER_DESCRIPTION, Capacity, Aantal
      const voorraadMap = new Map<string, {
        subCode: string;
        description: string;
        locatie: "emmen" | "tilburg";
        capacity: number;
        aantal: number;
      }>();

      for (const row of voorraadRows) {
        const description: string = row.ContentDescription || row.CD_CONTENT_TYPE || "";
        if (!description) continue;
        if (description.toLowerCase().includes("leeg")) continue;

        const subCode: string = row.CD_CONTENT_TYPE || description;
        const center: string = row.DS_CENTER_DESCRIPTION || "";
        const locatie: "emmen" | "tilburg" = center.toLowerCase().includes("emmen") ? "emmen" : "tilburg";
        const cap = Number(row.Capacity) || 0;
        const aantal = Number(row.Aantal) || 0;

        const key = `${description}__${locatie}__${cap}`;
        const existing = voorraadMap.get(key);
        if (existing) {
          existing.aantal += aantal;
        } else {
          voorraadMap.set(key, { subCode, description, locatie, capacity: cap, aantal });
        }
      }

      // --- Aggregate Afname by description + locatie + capacity ---
      // Column names: ContentDescription, CenterDescription, Capacity, Aantal, Datum
      const afnameMap = new Map<string, { total: number; dates: Date[] }>();

      for (const row of afnameRows) {
        const description: string = row.ContentDescription || "";
        if (!description) continue;
        if (description.toLowerCase().includes("leeg")) continue;

        const center: string = row.CenterDescription || row.DS_CENTER_DESCRIPTION || "";
        const locatie: "emmen" | "tilburg" = center.toLowerCase().includes("emmen") ? "emmen" : "tilburg";
        const afnameCap = Number(row.Capacity) || 0;
        const aantal = Number(row.Aantal) || 0;
        const date = parseDatum(row.Datum);

        const key = `${description}__${locatie}__${afnameCap}`;
        const existing = afnameMap.get(key);
        if (existing) {
          existing.total += aantal;
          if (date) existing.dates.push(date);
        } else {
          afnameMap.set(key, { total: aantal, dates: date ? [date] : [] });
        }
      }

      // --- Build StockRows ---
      const rows: StockRow[] = [];
      for (const [key, v] of voorraadMap.entries()) {
        const afname = afnameMap.get(key);
        const totalAfname = afname?.total ?? 0;
        const dates = afname?.dates ?? [];

        dates.sort((a, b) => a.getTime() - b.getTime());
        const lastDelivery = dates.length > 0 ? dates[dates.length - 1] : null;
        const firstDelivery = dates.length > 0 ? dates[0] : null;

        const spanDays =
          firstDelivery && lastDelivery && firstDelivery.getTime() !== lastDelivery.getTime()
            ? Math.max(differenceInDays(lastDelivery, firstDelivery), 1)
            : totalAfname > 0 ? 90 : 0;

        const deliveryCount = dates.length;
        const avgInterval =
          deliveryCount >= 2 ? Math.round(spanDays / (deliveryCount - 1)) : null;

        const dailyRate =
          spanDays > 0 && totalAfname > 0 ? totalAfname / spanDays : 0;

        const dekking =
          dailyRate > 0 ? v.aantal / dailyRate : v.aantal > 0 ? 999 : 0;

        rows.push({
          subCode: v.subCode,
          description: v.description,
          locatie: v.locatie,
          capacity: v.capacity,
          numberOnStock: v.aantal,
          totalAfname,
          spanDays,
          dailyRate,
          difference: dekking,
          deliveryCount,
          avgInterval,
          lastDelivery,
        });
      }

      setAllRows(rows);
      setLastUpdate(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, []);

  // Automatically fetch on selectedLocation (global) or locFilter (local) change
  useEffect(() => {
    fetchData();
    
    const channel = supabase
      .channel("voorraad-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "Voorraad" }, () => {
        fetchData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "Afname" }, () => {
        fetchData();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData, refreshKey, selectedLocation, locFilter]);

  // Debounced auto-fetch on typing text in search
  useEffect(() => {
    if (!search && search !== "") return;
    const timeoutId = setTimeout(() => {
      fetchData();
    }, 400); // 400ms debounce
    return () => clearTimeout(timeoutId);
  }, [search, fetchData]);

  const locationFiltered = useMemo(() => {
    if (locFilter === "all") return allRows;
    return allRows.filter(r => r.locatie === locFilter);
  }, [allRows, locFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<StockStatus, number> = { critical: 0, low: 0, ok: 0, surplus: 0 };
    locationFiltered.forEach(r => counts[getStockStatus(r.difference)]++);
    return counts;
  }, [locationFiltered]);

  const displayRows = useMemo(() => {
    let rows = locationFiltered;
    const term = search.toLowerCase().trim();
    if (term) {
      rows = rows.filter(r =>
        (r.description + " " + r.subCode).toLowerCase().includes(term)
      );
    }
    if (statusFilter) {
      rows = rows.filter(r => getStockStatus(r.difference) === statusFilter);
    }
    return [...rows].sort((a, b) => {
      const av: any = a[sortField as keyof StockRow];
      const bv: any = b[sortField as keyof StockRow];
      const an = av === null ? Infinity : av;
      const bn = bv === null ? Infinity : bv;
      if (typeof an === "string") return sortDir === "asc" ? an.localeCompare(bn) : bn.localeCompare(an);
      return sortDir === "asc" ? an - bn : bn - an;
    });
  }, [locationFiltered, search, statusFilter, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="h-3 w-3 opacity-30" />;
    return sortDir === "asc" ? <ArrowUp className="h-3 w-3 text-primary" /> : <ArrowDown className="h-3 w-3 text-primary" />;
  };

  const dekkingLabel = (days: number) => days >= 999 ? "∞" : `${formatNumber(days, 0)} dgn`;

  const colSpan = 9;
  const hasActiveFilters = !!(search || statusFilter);
  const clearFilters = () => { setSearch(""); setStatusFilter(null); };

  const locCounts = useMemo(() => ({
    all: allRows.length,
    emmen: allRows.filter(r => r.locatie === "emmen").length,
    tilburg: allRows.filter(r => r.locatie === "tilburg").length,
  }), [allRows]);

  return (
    <TooltipProvider>
    <div className="space-y-3">

      {/* ── Row 1: Locatie + acties ── */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 bg-muted/60 rounded-lg p-1">
          {([
            { key: "all",     label: "Alle locaties", count: locCounts.all },
            { key: "emmen",   label: "Emmen",         count: locCounts.emmen },
            { key: "tilburg", label: "Tilburg",       count: locCounts.tilburg },
          ] as const).map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setLocFilter(key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all",
                locFilter === key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {key !== "all" && <MapPin className="h-3 w-3" />}
              {label}
              <span className={cn(
                "text-[10px] font-bold tabular-nums",
                locFilter === key ? "text-foreground" : "text-muted-foreground"
              )}>
                {count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          {lastUpdate && (
            <span className="text-xs text-muted-foreground hidden lg:inline whitespace-nowrap">
              Bijgewerkt {format(lastUpdate, "d MMM HH:mm", { locale: nl })}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-8 gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            <span className="hidden sm:inline">Verversen</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()} className="h-8 gap-1.5">
            <Printer className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Print</span>
          </Button>
        </div>
      </div>

      {/* ── Row 2: Zoek + status chips ── */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Zoek op omschrijving of artikelcode..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9 text-sm"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Wis zoekterm"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {(["critical", "low", "ok", "surplus"] as StockStatus[]).map(s => {
            const cfg = STATUS_CONFIG[s];
            const Icon = cfg.icon;
            const active = statusFilter === s;
            const count = statusCounts[s];
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(active ? null : s)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border",
                  active
                    ? cfg.bg + " shadow-sm ring-1 ring-current/20"
                    : "bg-background border-border text-muted-foreground hover:border-current hover:" + cfg.color,
                  count === 0 && !active && "opacity-40"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{cfg.label}</span>
                <span className={cn(
                  "min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold",
                  active ? "bg-white/40" : "bg-muted"
                )}>
                  {count}
                </span>
              </button>
            );
          })}

          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/60 hover:bg-muted border border-transparent transition-all"
            >
              <X className="h-3 w-3" />
              Wis
            </button>
          )}
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* ── Skeleton loader ── */}
      {loading && (
        <div className="rounded-lg border overflow-hidden">
          <div className="bg-muted/50 h-10 border-b" />
          <div className="divide-y">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-11 px-4 flex items-center gap-3">
                <div className="h-4 w-14 rounded bg-muted/60 animate-pulse" />
                <div className="h-4 w-28 rounded bg-muted/40 animate-pulse" />
                <div className="h-4 flex-1 rounded bg-muted/40 animate-pulse" />
                <div className="h-4 w-12 rounded bg-muted/40 animate-pulse ml-auto" />
                <div className="h-4 w-16 rounded bg-muted/40 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Table ── */}
      {!loading && !error && (
        <>
          <div className="rounded-lg border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/60 border-b">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide w-24">
                      Status
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer hover:text-foreground select-none hidden sm:table-cell" onClick={() => toggleSort("subCode")}>
                      <span className="flex items-center gap-1">Code <SortIcon field="subCode" /></span>
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("description")}>
                      <span className="flex items-center gap-1">Omschrijving <SortIcon field="description" /></span>
                    </th>
                    <th className="px-3 py-2.5 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer hover:text-foreground select-none hidden md:table-cell" onClick={() => toggleSort("locatie")}>
                      <span className="flex items-center gap-1">Locatie <SortIcon field="locatie" /></span>
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer hover:text-foreground select-none hidden lg:table-cell" onClick={() => toggleSort("capacity")}>
                      <span className="flex items-center gap-1 justify-end">
                        <Cylinder className="h-3 w-3" />Cap.
                        <Tooltip>
                          <TooltipTrigger asChild><Info className="h-3 w-3 opacity-40 cursor-help" /></TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">Cilinderinhoud per eenheid (liter)</TooltipContent>
                        </Tooltip>
                        <SortIcon field="capacity" />
                      </span>
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("numberOnStock")}>
                      <span className="flex items-center gap-1 justify-end">Voorraad <SortIcon field="numberOnStock" /></span>
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer hover:text-foreground select-none hidden md:table-cell" onClick={() => toggleSort("dailyRate")}>
                      <span className="flex items-center gap-1 justify-end">
                        Afname/dag
                        <Tooltip>
                          <TooltipTrigger asChild><Info className="h-3 w-3 opacity-40 cursor-help" /></TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px] text-xs">
                            Werkelijk verbruik per dag op basis van de gemeten periode.
                          </TooltipContent>
                        </Tooltip>
                        <SortIcon field="dailyRate" />
                      </span>
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer hover:text-foreground select-none hidden lg:table-cell" onClick={() => toggleSort("avgInterval")}>
                      <span className="flex items-center gap-1 justify-end">
                        Interval
                        <Tooltip>
                          <TooltipTrigger asChild><Info className="h-3 w-3 opacity-40 cursor-help" /></TooltipTrigger>
                          <TooltipContent side="top" className="max-w-[200px] text-xs">
                            Gemiddeld aantal dagen tussen leveringen.
                          </TooltipContent>
                        </Tooltip>
                        <SortIcon field="avgInterval" />
                      </span>
                    </th>
                    <th className="px-3 py-2.5 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide cursor-pointer hover:text-foreground select-none" onClick={() => toggleSort("difference")}>
                      <span className="flex items-center gap-1 justify-end">Dekking <SortIcon field="difference" /></span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60 select-text">
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} className="px-4 py-12 text-center text-muted-foreground">
                        <Search className="h-8 w-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm">Geen artikelen gevonden</p>
                        {search && <p className="text-xs mt-1">Probeer een andere zoekterm</p>}
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((row) => {
                      const status = getStockStatus(row.difference);
                      const cfg = STATUS_CONFIG[status];
                      const Icon = cfg.icon;
                      const today = new Date();
                      const daysSinceLast = row.lastDelivery ? differenceInDays(today, row.lastDelivery) : null;
                      const orderAdvice = row.avgInterval !== null && row.difference < 999
                        ? Math.round(row.difference - row.avgInterval * 0.5)
                        : null;

                      return (
                        <tr
                          key={`${row.subCode}-${row.locatie}-${row.capacity}`}
                          className={cn(
                            "border-l-2 transition-colors hover:bg-muted/30",
                            cfg.rowBg,
                            cfg.border,
                          )}
                        >
                          <td className="px-3 py-2.5">
                            <span className={cn(
                              "inline-flex items-center gap-1 text-xs font-semibold rounded-md px-1.5 py-0.5",
                              cfg.bg.split(" ")[0],
                              cfg.textColor,
                            )}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-xs text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                            {row.subCode}
                          </td>
                          <td className="px-3 py-2.5 font-medium min-w-[200px]">
                            <span className="break-words" title={row.description}>{row.description}</span>
                            <span className="sm:hidden text-xs text-muted-foreground font-normal font-mono block mt-0.5">{row.subCode}</span>
                          </td>
                          <td className="px-3 py-2.5 hidden md:table-cell">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-semibold capitalize",
                                row.locatie === "emmen"
                                  ? "border-blue-300 text-blue-700 bg-blue-50"
                                  : "border-amber-300 text-amber-700 bg-amber-50"
                              )}
                            >
                              {row.locatie === "emmen" ? "Emmen" : "Tilburg"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums hidden lg:table-cell">
                            {row.capacity > 0 ? (
                              <span className="text-muted-foreground text-xs">
                                {row.capacity >= 1000
                                  ? `${(row.capacity / 1000).toFixed(0)} m³`
                                  : `${row.capacity} L`}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                            {formatNumber(row.numberOnStock, 0)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground hidden md:table-cell">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn(
                                  "cursor-help border-b border-dotted border-current/30",
                                  row.dailyRate === 0 && "text-muted-foreground/30"
                                )}>
                                  {row.dailyRate > 0 ? formatNumber(row.dailyRate, 2) : "—"}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" align="end" className="text-xs space-y-1 max-w-[220px]">
                                <p className="font-semibold">{row.description}</p>
                                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-muted-foreground">
                                  <span>Totaal afgenomen</span><span className="text-foreground font-medium text-right">{formatNumber(row.totalAfname, 0)}</span>
                                  <span>Meetperiode</span><span className="text-foreground font-medium text-right">{row.spanDays} dgn</span>
                                  <span>Leveringen</span><span className="text-foreground font-medium text-right">{row.deliveryCount}×</span>
                                  {row.lastDelivery && <>
                                    <span>Laatste levering</span>
                                    <span className="text-foreground font-medium text-right">{format(row.lastDelivery, "d MMM yyyy", { locale: nl })}</span>
                                  </>}
                                  {daysSinceLast !== null && <>
                                    <span>Geleden</span>
                                    <span className={cn("font-medium text-right", daysSinceLast > 60 ? "text-orange-500" : "text-foreground")}>
                                      {daysSinceLast} dgn
                                    </span>
                                  </>}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums hidden lg:table-cell">
                            {row.avgInterval !== null ? (
                              <span className="text-muted-foreground text-xs">{row.avgInterval} dgn</span>
                            ) : (
                              <span className="text-muted-foreground/30 text-xs">
                                {row.deliveryCount === 1 ? "1×" : "—"}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className={cn("cursor-help font-bold text-sm", cfg.color)}>
                                  {dekkingLabel(row.difference)}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent side="left" align="end" className="text-xs space-y-1 max-w-[240px]">
                                {row.dailyRate > 0 ? (
                                  <p>
                                    <strong>{formatNumber(row.numberOnStock, 0)}</strong> op voorraad ÷{" "}
                                    <strong>{formatNumber(row.dailyRate, 2)}</strong>/dag ={" "}
                                    <strong>{dekkingLabel(row.difference)}</strong>
                                  </p>
                                ) : (
                                  <p>Geen afname geregistreerd — voorraad onbeperkt</p>
                                )}
                                {orderAdvice !== null && (
                                  <p className={cn(
                                    "mt-1 text-xs",
                                    orderAdvice <= 0 ? "text-red-400 font-semibold" : "text-muted-foreground"
                                  )}>
                                    {orderAdvice <= 0
                                      ? "⚠ Bestel nu (leverancier lead time overschreden)"
                                      : `Bestel binnen ${orderAdvice} dgn (op basis van gem. interval)`}
                                  </p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              {displayRows.length === locationFiltered.length
                ? `${locationFiltered.length} artikelen`
                : `${displayRows.length} van ${locationFiltered.length} artikelen`}
              {locFilter !== "all" && ` · ${locFilter === "emmen" ? "Emmen" : "Tilburg"}`}
              {statusFilter && ` · ${STATUS_CONFIG[statusFilter].label}`}
              {search && ` · "${search}"`}
            </span>
            {lastUpdate && (
              <span className="lg:hidden">
                Bijgewerkt {format(lastUpdate, "d MMM HH:mm", { locale: nl })}
              </span>
            )}
          </div>
        </>
      )}
    </div>
    </TooltipProvider>
  );
}
