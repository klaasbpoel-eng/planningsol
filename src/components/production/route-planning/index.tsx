import React, { useState, useEffect, useMemo, useRef, useCallback, startTransition } from "react";
import * as XLSX from "xlsx";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths } from "date-fns";
import { nl } from "date-fns/locale";
import { cn, formatNumber } from "@/lib/utils";
import { toast } from "@/components/ui/sonner";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import {
  Download, RefreshCw, Users, Truck, Map as MapIcon, TrendingUp,
  Sparkles, Loader2, ChevronRight,
  CheckCircle2, CalendarDays,
} from "lucide-react";
import { CustomerDetailSheet, CustomerDetailSheetHandle } from "./CustomerDetailSheet";

import { RouteStatsCards } from "./RouteStatsCards";
import { RouteFilters } from "./RouteFilters";
import { CustomersTable } from "./CustomersTable";
import { RouteMap } from "./RouteMap";
import { DayView } from "./DayView";
import { StrategyView } from "./StrategyView";

import {
  Depot, VehicleType, ViewTab, Trend, CustomerSummary, DayAssignment, GeoPoint, TspGroupResult
} from "./types";

import {
  DATE_FROM, WEEKDAYS, DAY_FULL,
  MAX_CYLINDERS_TRUCK, MAX_TOTAL_LOAD, ZONE_COLORS, DEPOT_COORDS,
  geocacheGet, geocodeZip,
  getZone, effectiveDepot, effectiveVehicleType, heatClass, capacityBarColor,
  parseDatumToDate, fetchAfname, buildSummaries,
  haversineKm, getADRClass, nearestNeighborTSP, twoOptImprove
} from "./utils";

interface RoutePlanningProps {
  selectedLocation?: string;
}

export default function RoutePlanning({ selectedLocation }: RoutePlanningProps) {
  const [customers, setCustomers]           = useState<CustomerSummary[]>([]);
  const [totalRows, setTotalRows]           = useState(0);
  const [loading, setLoading]               = useState(true);
  const [lastUpdate, setLastUpdate]         = useState<Date | null>(null);
  const [viewTab, setViewTab]               = useState<ViewTab>("klanten");
  const [dayAssignments, setDayAssignments] = useState<Map<string, DayAssignment>>(new Map());
  const dayAssignmentsRef = useRef(dayAssignments);
  
  useEffect(() => {
    dayAssignmentsRef.current = dayAssignments;
  }, [dayAssignments]);

  const [savingKey, setSavingKey]           = useState<string | null>(null);
  const [geoPoints, setGeoPoints]           = useState<GeoPoint[]>([]);
  const [geoProgress, setGeoProgress]       = useState<{ done: number; total: number } | null>(null);
  const geoAbortRef = useRef<AbortController | null>(null);

  const [selectedDay, setSelectedDay] = useState<1|2|3|4|5>(() => {
    const d = new Date().getDay();
    return (d >= 1 && d <= 5 ? d : 1) as 1|2|3|4|5;
  });

  const [depotFilter, setDepotFilter]     = useState<"all" | Depot>(() => {
    if (selectedLocation === "sol_emmen")   return "emmen";
    if (selectedLocation === "sol_tilburg") return "tilburg";
    return "all";
  });
  const [vehicleFilter, setVehicleFilter] = useState<"all" | VehicleType>("all");
  const [zoneFilter, setZoneFilter]       = useState("all");
  const [showInactive, setShowInactive]   = useState(false);
  const [search, setSearch]               = useState("");
  const [kostenPerKm, setKostenPerKm]     = useState(1.85);
  
  const [dragKey, setDragKey]             = useState<string | null>(null);
  const [dragOver, setDragOver]           = useState<number | null>(null);
  
  const detailRef = useRef<CustomerDetailSheetHandle>(null);
  const openDetailCustomer = useCallback((c: CustomerSummary) => { detailRef.current?.open(c); }, []);
  const [bulkSelected, setBulkSelected]     = useState<Set<string>>(new Set());
  const [printGroupKey, setPrintGroupKey]   = useState<string | null>(null);
  const [applyingAll, setApplyingAll]       = useState(false);
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());

  // ── Fetch ─────────────────────────────────────────────────────────────────

  const fetchData = async () => {
    setLoading(true);
    try {
      const [rows, assignRows] = await Promise.all([
        fetchAfname(),
        (supabase.from("route_day_assignments" as never) as any)
          .select("customer_key,preferred_day,vehicle_type,depot_override,notes,urgent,time_window_start,time_window_end,active"),
      ]);
      const filteredRows = rows.filter(r => {
        const d = parseDatumToDate(r.Datum);
        return !d || d >= DATE_FROM;
      });
      // Defer heavy CPU work so the loading spinner can render first
      const [summaries, asgMap] = await new Promise<[CustomerSummary[], Map<string, DayAssignment>]>(resolve =>
        setTimeout(() => {
          const s = buildSummaries(filteredRows);
          const m = new Map<string, DayAssignment>();
          for (const r of (assignRows.data ?? [])) {
            m.set(r.customer_key, {
              preferred_day:     r.preferred_day,
              vehicle_type:      r.vehicle_type,
              notes:             r.notes,
              urgent:            r.urgent ?? false,
              time_window_start: r.time_window_start ?? null,
              time_window_end:   r.time_window_end ?? null,
              active:            r.active ?? true,
              depot_override:    r.depot_override ?? null,
            });
          }
          resolve([s, m]);
        }, 0)
      );
      startTransition(() => {
        setCustomers(summaries);
        setTotalRows(filteredRows.length);
        setDayAssignments(asgMap);
        setLastUpdate(new Date());
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const savingKeyRef = useRef(savingKey);
  useEffect(() => {
    savingKeyRef.current = savingKey;
  }, [savingKey]);

  // Realtime multi-user sync
  useEffect(() => {
    const channel = (supabase as any)
      .channel("route_assignments_realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "route_day_assignments" },
        (payload: any) => {
          const row = payload.new ?? payload.old;
          if (!row?.customer_key) return;
          setDayAssignments(prev => {
            if (savingKeyRef.current === row.customer_key) return prev;
            const next = new Map(prev);
            if (payload.eventType === "DELETE") {
              next.delete(row.customer_key);
            } else {
              next.set(row.customer_key, {
                preferred_day:     row.preferred_day ?? null,
                vehicle_type:      row.vehicle_type ?? null,
                depot_override:    row.depot_override ?? null,
                notes:             row.notes ?? null,
                urgent:            row.urgent ?? false,
                time_window_start: row.time_window_start ?? null,
                time_window_end:   row.time_window_end ?? null,
                active:            row.active ?? true,
              });
            }
            return next;
          });
        }
      )
      .subscribe();
    return () => { (supabase as any).removeChannel(channel); };
  }, []);

  // ── Updates ───────────────────────────────────────────────────────────────

  const updateAssignment = useCallback(async (
    c: CustomerSummary,
    updates: Partial<DayAssignment>
  ) => {
    const cur = dayAssignmentsRef.current.get(c.key);
    const merged = {
      customer_key:      c.key,
      depot:             c.depot,
      vehicle_type:      updates.vehicle_type      !== undefined ? updates.vehicle_type      : (cur?.vehicle_type ?? null),
      depot_override:    updates.depot_override    !== undefined ? updates.depot_override    : (cur?.depot_override ?? null),
      preferred_day:     updates.preferred_day     !== undefined ? updates.preferred_day     : (cur?.preferred_day ?? null),
      urgent:            updates.urgent             !== undefined ? updates.urgent             : (cur?.urgent ?? false),
      time_window_start: updates.time_window_start !== undefined ? (updates.time_window_start || null) : (cur?.time_window_start ?? null),
      time_window_end:   updates.time_window_end   !== undefined ? (updates.time_window_end   || null) : (cur?.time_window_end   ?? null),
      active:            updates.active             !== undefined ? updates.active             : (cur?.active ?? true),
      notes:             updates.notes             !== undefined ? updates.notes             : (cur?.notes ?? null),
      updated_at:        new Date().toISOString(),
    };
    
    setDayAssignments(prev => {
      const next = new Map(prev);
      next.set(c.key, {
        preferred_day:     merged.preferred_day,
        vehicle_type:      merged.vehicle_type,
        depot_override:    merged.depot_override,
        notes:             merged.notes,
        urgent:            merged.urgent,
        time_window_start: merged.time_window_start,
        time_window_end:   merged.time_window_end,
        active:            merged.active,
      });
      return next;
    });
    setSavingKey(c.key);
    try {
      const { error } = await (supabase.from("route_day_assignments" as never) as any).upsert(
        merged, { onConflict: "customer_key" }
      );
      if (error) {
        toast.error("Opslaan mislukt", { description: error.message });
        setDayAssignments(prev => {
          const next = new Map(prev);
          if (cur) next.set(c.key, cur); else next.delete(c.key);
          return next;
        });
      }
    } finally {
      setSavingKey(null);
    }
  }, []);

  // ── Geocoding ─────────────────────────────────────────────────────────────

  const runGeocoding = useCallback(async (list: CustomerSummary[]) => {
    geoAbortRef.current?.abort();
    const ctrl = new AbortController();
    geoAbortRef.current = ctrl;

    const zipCity = new Map<string, string>();
    for (const c of list) { if (c.zip && c.city && !zipCity.has(c.zip)) zipCity.set(c.zip, c.city); }

    const uniqueZips = [...new Set(list.map(c => c.zip).filter(Boolean))];
    const newPoints: GeoPoint[] = [];
    setGeoProgress({ done: 0, total: uniqueZips.length });

    const uncached: string[] = [];
    for (const zip of uniqueZips) {
      const cached = geocacheGet(zip);
      if (cached) {
        list.filter(c => c.zip === zip).forEach(c => newPoints.push({ customer: c, ...cached }));
      } else {
        uncached.push(zip);
      }
    }
    setGeoProgress({ done: uniqueZips.length - uncached.length, total: uniqueZips.length });
    setGeoPoints([...newPoints]);

    for (let i = 0; i < uncached.length; i++) {
      if (ctrl.signal.aborted) break;
      const zip = uncached[i];
      const result = await geocodeZip(zip, ctrl.signal, zipCity.get(zip));
      if (result) {
        list.filter(c => c.zip === zip).forEach(c => newPoints.push({ customer: c, ...result }));
        setGeoPoints([...newPoints]);
      }
      setGeoProgress({ done: uniqueZips.length - uncached.length + i + 1, total: uniqueZips.length });
      if (i < uncached.length - 1) await new Promise(r => setTimeout(r, 1000));
    }
    setGeoProgress(null);
  }, []);

  useEffect(() => {
    if ((viewTab === "kaart" || viewTab === "strategie") && customers.length > 0) {
      runGeocoding(filtered);
    }
    return () => {
      if (viewTab !== "kaart" && viewTab !== "strategie") geoAbortRef.current?.abort();
    };
  }, [viewTab]);

  // ── Derived State ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    let list = customers;
    if (!showInactive)            list = list.filter(c => dayAssignments.get(c.key)?.active !== false);
    if (depotFilter !== "all")    list = list.filter(c => effectiveDepot(c, dayAssignments) === depotFilter);
    if (vehicleFilter !== "all")  list = list.filter(c => effectiveVehicleType(c, dayAssignments) === vehicleFilter);
    if (zoneFilter !== "all")     list = list.filter(c => getZone(c.province, c.city, undefined, c.zip).short === zoneFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.city.toLowerCase().includes(q) ||
        c.zip.toLowerCase().includes(q)
      );
    }
    return list;
  }, [customers, depotFilter, vehicleFilter, zoneFilter, search, dayAssignments, showInactive]);

  const stats = useMemo(() => ({
    total:   filtered.length,
    truck:   filtered.filter(c => effectiveVehicleType(c, dayAssignments) === "truck").length,
    courier: filtered.filter(c => effectiveVehicleType(c, dayAssignments) !== "truck").length,
    emmen:   filtered.filter(c => effectiveDepot(c, dayAssignments) === "emmen").length,
    tilburg: filtered.filter(c => effectiveDepot(c, dayAssignments) === "tilburg").length,
    zones:   [...new Set(filtered.map(c => getZone(c.province, c.city, undefined, c.zip).short))].length,
  }), [filtered, dayAssignments]);

  const zonesList = useMemo(() => {
    return [...new Set(filtered.map(c => {
      const z = getZone(c.province, c.city, undefined, c.zip);
      return `${z.short}|${z.full}`;
    }))].sort().map(s => {
      const [short, full] = s.split("|");
      return { short, full };
    });
  }, [filtered]);

  const groupedByZone = useMemo(() => {
    const m = new Map<string, CustomerSummary[]>();
    for (const c of filtered) {
      const zShort = getZone(c.province, c.city, undefined, c.zip).short;
      const arr = m.get(zShort) ?? [];
      arr.push(c);
      m.set(zShort, arr);
    }
    return m;
  }, [filtered]);

  const dayCustomers = useMemo(() => {
    const active = filtered.filter(c => dayAssignments.get(c.key)?.active !== false);
    const assigned  = active.filter(c => dayAssignments.get(c.key)?.preferred_day === selectedDay);
    const suggested = active.filter(c =>
      !dayAssignments.get(c.key)?.preferred_day &&
      c.preferredDays.includes(selectedDay)
    );
    return { assigned, suggested, all: [...assigned, ...suggested] };
  }, [filtered, dayAssignments, selectedDay]);

  const truckGroups = useMemo(() => {
    const groups: Record<string, Record<Depot, CustomerSummary[]>> = {
      truck:   { emmen: [], tilburg: [] },
      courier: { emmen: [], tilburg: [] },
    };
    for (const c of dayCustomers.all) {
      const vt = effectiveVehicleType(c, dayAssignments) === "truck" ? "truck" : "courier";
      groups[vt][c.depot].push(c);
    }
    return groups;
  }, [dayCustomers]);

  const filteredGeoPoints = useMemo(() =>
    geoPoints.filter(p =>
      filtered.some(c => c.key === p.customer.key) &&
      (dayAssignments.get(p.customer.key)?.active !== false)
    ),
    [geoPoints, filtered, dayAssignments]
  );

  const tspAllDays = useMemo(() => {
    const empty = new Map<number, Map<string, TspGroupResult>>();
    if (viewTab !== "dag" && viewTab !== "kaart") return empty;
    if (filteredGeoPoints.length === 0) return empty;

    const geoKeySet = new Set(filteredGeoPoints.map(p => p.customer.key));
    const result = new Map<number, Map<string, TspGroupResult>>();

    for (const day of WEEKDAYS) {
      const active = filtered.filter(c => dayAssignments.get(c.key)?.active !== false);
      const assigned  = active.filter(c => dayAssignments.get(c.key)?.preferred_day === day);
      const suggested = active.filter(c =>
        !dayAssignments.get(c.key)?.preferred_day && c.preferredDays.includes(day)
      );
      const dayAll = [...assigned, ...suggested];

      const groups: Record<string, Record<Depot, CustomerSummary[]>> = {
        truck:   { emmen: [], tilburg: [] },
        courier: { emmen: [], tilburg: [] },
      };
      for (const c of dayAll) {
        const vt = effectiveVehicleType(c, dayAssignments) === "truck" ? "truck" : "courier";
        groups[vt][effectiveDepot(c, dayAssignments)].push(c);
      }

      const dayMap = new Map<string, TspGroupResult>();
      for (const vt of ["truck", "courier"] as const) {
        for (const depot of (["emmen", "tilburg"] as Depot[])) {
          const groupKey  = `${depot}-${vt}`;
          const customersGrp = groups[vt][depot];
          const geoForGroup = filteredGeoPoints.filter(p => customersGrp.some(c => c.key === p.customer.key));
          const withoutGeo  = customersGrp.filter(c => !geoKeySet.has(c.key));
          const dc = DEPOT_COORDS[depot];
          const nn = nearestNeighborTSP(dc.lat, dc.lng, geoForGroup);
          const ordered = twoOptImprove(nn, dc.lat, dc.lng);
          let totalKm = 0;
          if (ordered.length > 0) {
            let prev = { lat: dc.lat, lng: dc.lng };
            for (const p of ordered) {
              totalKm += haversineKm(prev.lat, prev.lng, p.lat, p.lng);
              prev = { lat: p.lat, lng: p.lng };
            }
            totalKm += haversineKm(prev.lat, prev.lng, dc.lat, dc.lng);
          }
          dayMap.set(groupKey, { ordered, totalKm, withoutGeo });
        }
      }
      result.set(day, dayMap);
    }
    return result;
  }, [viewTab, filteredGeoPoints, dayAssignments, filtered]);

  const tspDayGroups = useMemo(
    () => tspAllDays.get(selectedDay) ?? new Map<string, TspGroupResult>(),
    [tspAllDays, selectedDay]
  );
  
  const mapRoutes = useMemo(() => {
    if (viewTab !== "kaart") return [];
    const routes: { color: string; coords: [number, number][] }[] = [];
    for (const [key, { ordered }] of tspDayGroups) {
      if (ordered.length < 2) continue;
      const depot = key.split("-")[0] as Depot;
      const dc = DEPOT_COORDS[depot];
      const color = depot === "emmen" ? "#f97316" : "#3b82f6";
      const coords: [number, number][] = [
        [dc.lat, dc.lng],
        ...ordered.map(p => [p.lat, p.lng] as [number, number]),
        [dc.lat, dc.lng],
      ];
      routes.push({ color, coords });
    }
    return routes;
  }, [tspDayGroups, viewTab]);

  const adrWarnings = useMemo(() => {
    const result = new Map<string, { conflict: boolean; oxidizers: string[]; flammables: string[] }>();
    for (const vt of ["truck", "courier"] as const) {
      for (const depot of (["emmen", "tilburg"] as Depot[])) {
        const key = `${depot}-${vt}`;
        const oxidizers: string[] = [];
        const flammables: string[] = [];
        for (const c of truckGroups[vt][depot]) {
          const cls = getADRClass(c.topProducts);
          if (cls === "oxidizer")  oxidizers.push(c.name);
          if (cls === "flammable") flammables.push(c.name);
        }
        result.set(key, { conflict: oxidizers.length > 0 && flammables.length > 0, oxidizers, flammables });
      }
    }
    return result;
  }, [truckGroups]);

  // Strategy values... (keep minimal for brevity, only needed in StrategyTab)
  const depotSuggestions = useMemo(() => {
    const THRESHOLD_KM = 10;
    return filteredGeoPoints
      .map(({ customer: c, lat, lng }) => {
        const other      = c.depot === "emmen" ? "tilburg" : "emmen";
        const currentKm  = haversineKm(lat, lng, DEPOT_COORDS[c.depot].lat, DEPOT_COORDS[c.depot].lng);
        const otherKm    = haversineKm(lat, lng, DEPOT_COORDS[other].lat, DEPOT_COORDS[other].lng);
        const savingKm   = currentKm - otherKm;
        return { customer: c, currentKm, otherKm, otherDepot: other as Depot, savingKm };
      })
      .filter(s => s.savingKm >= THRESHOLD_KM)
      .sort((a, b) => b.savingKm - a.savingKm);
  }, [filteredGeoPoints]);

  
  // ── Exports ───────────────────────────────────────────────────────────────

  const exportKlanten = () => {
    const rows = filtered.map(c => ({
      Klant:     c.name,
      Stad:      c.city,
      Postcode:  c.zip,
      Depot:     effectiveDepot(c, dayAssignments) === "emmen" ? "Emmen" : "Tilburg",
      Zone:      getZone(c.province, c.city, effectiveDepot(c, dayAssignments), c.zip).full,
      Type:      c.vehicleType === "truck" ? "Vrachtwagen" : "Koerier",
      "/week":   parseFloat(c.perWeek.toFixed(2)),
      Ma:        c.dowCounts[1],
      Di:        c.dowCounts[2],
      Wo:        c.dowCounts[3],
      Do:        c.dowCounts[4],
      Vr:        c.dowCounts[5],
      "Vaste dag": (() => {
        const a = dayAssignments.get(c.key);
        return a?.preferred_day ? DAY_FULL[a.preferred_day] : "";
      })(),
      Producten: c.topProducts.join("; "),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Klanten");
    XLSX.writeFile(wb, `Routeplanning_klanten_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  const hasFilters = depotFilter !== "all" || vehicleFilter !== "all" || zoneFilter !== "all" || !!search;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        
        {/* Smart Suggestions Alert */}
        {depotSuggestions.length > 0 && viewTab === "klanten" && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-violet-50 border border-violet-200 text-sm text-violet-800 animate-in fade-in">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-violet-600" />
              <span>
                <strong>Slimme Suggestie:</strong> {depotSuggestions.length} klanten kunnen efficiënter bediend worden vanuit een ander depot.
              </span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setViewTab("strategie")} className="h-8 border-violet-300 bg-white">
              Bekijk suggesties <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-bold">Routeplanning</h2>
            <p className="text-sm text-muted-foreground">
              Klantfrequenties &amp; zone-indeling op basis van {formatNumber(totalRows, 0)} leveringen
              ({format(DATE_FROM, "MMM yyyy", { locale: nl })} – {format(new Date(), "MMM yyyy", { locale: nl })})
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {lastUpdate && (
              <span className="text-xs text-muted-foreground hidden md:inline">
                {format(lastUpdate, "d MMM HH:mm", { locale: nl })}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={exportKlanten} disabled={loading} className="h-8 gap-1.5">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Export klanten</span>
            </Button>
            <Button variant="outline" size="sm" onClick={fetchData} disabled={loading} className="h-8 gap-1.5">
              <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
              <span className="hidden sm:inline">Verversen</span>
            </Button>
          </div>
        </div>

        {/* ── Sub-view tabs ── */}
        <div className="flex rounded-lg border bg-muted/20 p-1 gap-1 w-fit shadow-sm">
          {([
            { key: "klanten", label: "Klanten",     icon: <Users className="h-4 w-4" /> },
            { key: "dag",     label: "Dagweergave", icon: <Truck className="h-4 w-4" /> },
            { key: "kaart",      label: "Kaart",      icon: <MapIcon    className="h-4 w-4" /> },
            { key: "strategie",  label: "Strategie",  icon: <TrendingUp className="h-4 w-4" /> },
          ] as { key: ViewTab; label: string; icon: React.ReactNode }[]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setViewTab(key)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-semibold transition-all",
                viewTab === key
                  ? "bg-background shadow text-foreground tracking-tight"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {icon}{label}
            </button>
          ))}
        </div>

        {/* ── Stat cards ── */}
        <RouteStatsCards stats={stats} loading={loading} />

        {/* ── Filter bar ── */}
        <RouteFilters
          search={search} setSearch={setSearch}
          depotFilter={depotFilter} setDepotFilter={setDepotFilter}
          vehicleFilter={vehicleFilter} setVehicleFilter={setVehicleFilter}
          zoneFilter={zoneFilter} setZoneFilter={setZoneFilter}
          showInactive={showInactive} setShowInactive={setShowInactive}
          zones={zonesList}
          hasFilters={hasFilters}
          onClear={() => { setDepotFilter("all"); setVehicleFilter("all"); setZoneFilter("all"); setSearch(""); }}
        />

        {/* ── Loading ── */}
        {loading && (
          <div className="rounded-lg border overflow-hidden p-8 flex justify-center items-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-3 font-medium">Data laden...</span>
          </div>
        )}

        {/* ── VIEW: KLANTEN ── */}
        {!loading && filtered.length > 0 && viewTab === "klanten" && (
           <div className="space-y-4 overflow-y-auto pr-2 pb-8 h-full custom-scrollbar">
             {zonesList.map(({ short, full }) => {
                const groupAll = groupedByZone.get(short) ?? [];
                const group = groupAll.filter(c => {
                    if (dayAssignments.get(c.key)?.active === false) return showInactive;
                    return true;
                });
                if (group.length === 0) return null;
                const zoneColor = ZONE_COLORS[short] ?? ZONE_COLORS.Z;
                
                return (
                  <div key={short} className="space-y-0.5 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className={cn("px-4 py-2 rounded-t-lg border border-b-0 flex items-center font-semibold bg-muted/40", zoneColor.badge.replace('bg-','').replace('/5',''))}>
                        <Badge variant="outline" className={cn("text-xs font-bold px-2 mr-3", zoneColor.badge)}>Zone {short}</Badge>
                        {full.split("—")[1]?.trim()}
                        <span className="ml-auto text-xs text-muted-foreground font-normal">{group.length} klanten</span>
                    </div>
                    <CustomersTable
                      customers={group}
                      dayAssignments={dayAssignments}
                      savingKey={savingKey}
                      bulkSelected={bulkSelected}
                      setBulkSelected={setBulkSelected}
                      updateAssignment={updateAssignment}
                      setDetailCustomer={openDetailCustomer}
                      zoneColor={zoneColor}
                    />
                  </div>
                );
             })}
           </div>
        )}

        {/* ── VIEW: DAGWEERGAVE ── */}
        {!loading && viewTab === "dag" && (
          <DayView
            customers={filtered}
            dayAssignments={dayAssignments}
            dayCustomers={dayCustomers}
            selectedDay={selectedDay}
            setSelectedDay={setSelectedDay}
            dragKey={dragKey} setDragKey={setDragKey}
            dragOver={dragOver} setDragOver={setDragOver}
            updateAssignment={updateAssignment}
            truckGroups={truckGroups}
            tspDayGroups={tspDayGroups}
            adrWarnings={adrWarnings}
            printGroupKey={printGroupKey} setPrintGroupKey={setPrintGroupKey}
            kostenPerKm={kostenPerKm}
          />
        )}

        {/* ── VIEW: KAART ── */}
        {!loading && viewTab === "kaart" && (
          <div className="space-y-3">
             <RouteMap points={filteredGeoPoints} dayAssignments={dayAssignments} routes={mapRoutes} />
          </div>
        )}

        {/* ── VIEW: STRATEGIE ── */}
        {!loading && viewTab === "strategie" && (
          <StrategyView
            filtered={filtered}
            filteredGeoPoints={filteredGeoPoints}
            depotSuggestions={depotSuggestions}
            geoProgress={geoProgress}
            dayAssignments={dayAssignments}
            tspAllDays={tspAllDays}
            kostenPerKm={kostenPerKm}
            setKostenPerKm={setKostenPerKm}
            onRefresh={fetchData}
            setDetailCustomer={openDetailCustomer}
          />
        )}

        {/* ── KLANT DETAILS SHEET ── */}
        <CustomerDetailSheet ref={detailRef} dayAssignments={dayAssignments} updateAssignment={updateAssignment} />
      </div>
    </TooltipProvider>
  );
}
