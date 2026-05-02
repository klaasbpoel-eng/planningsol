import React, { useState, useMemo } from "react";
import * as XLSX from "xlsx";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, ArrowRightLeft, TrendingUp, Package, Truck, Euro, MapPin, TrendingDown, Sparkles, Users, Info, CheckCircle2, Download } from "lucide-react";
import { CustomerSummary, Depot, GeoPoint, DayAssignment, TspGroupResult } from "./types";
import { 
  WEEKDAYS, DAY_FULL, DAY_LABELS, ZONE_COLORS,
  effectiveDepot, effectiveVehicleType, getZone
} from "./utils";
import { toast } from "sonner";

interface StrategyViewProps {
  filtered: CustomerSummary[];
  filteredGeoPoints: GeoPoint[];
  depotSuggestions: Array<{ customer: CustomerSummary; currentKm: number; otherKm: number; otherDepot: Depot; savingKm: number }>;
  geoProgress: { done: number; total: number } | null;
  dayAssignments: Map<string, DayAssignment>;
  tspAllDays: Map<number, Map<string, TspGroupResult>>;
  kostenPerKm: number;
  setKostenPerKm: (k: number) => void;
  onRefresh: () => void;
  setDetailCustomer: (c: CustomerSummary) => void;
}

export function StrategyView({
  filtered, filteredGeoPoints, depotSuggestions, geoProgress, dayAssignments,
  tspAllDays, kostenPerKm, setKostenPerKm, onRefresh, setDetailCustomer
}: StrategyViewProps) {
  
  const [selectedSuggestions, setSelectedSuggestions] = useState<Set<string>>(new Set());
  const [applyingAll, setApplyingAll] = useState(false);
  const [expandedTrends, setExpandedTrends] = useState<Set<string>>(new Set());

  // --- Derived Calculations Local to StrategyView ---

  const frequencyBreakdown = useMemo(() => {
    const res = { dagelijks: 0, wekelijks: 0, tweewekelijks: 0, maandelijks: 0 };
    for (const c of filtered) {
      if      (c.perWeek >= 1.0) res.dagelijks++;
      else if (c.perWeek >= 0.5) res.wekelijks++;
      else if (c.perWeek >= 0.25) res.tweewekelijks++;
      else res.maandelijks++;
    }
    return res;
  }, [filtered]);

  const totalFreq = Object.values(frequencyBreakdown).reduce((s, v) => s + v, 0);

  const zoneEfficiency = useMemo(() => {
    const m = new Map<string, { short: string; full: string; stops: number; cylinders: number }>();
    for (const c of filtered) {
      const z = getZone(c.province, c.city, effectiveDepot(c, dayAssignments) as Depot, c.zip);
      const val = m.get(z.short) ?? { short: z.short, full: z.full, stops: 0, cylinders: 0 };
      val.stops += c.perWeek;
      val.cylinders += c.cylinders / 52;
      m.set(z.short, val);
    }
    return Array.from(m.values())
      .map(v => ({ zone: `${v.short} — ${v.full}`, short: v.short, cylPerStop: v.stops > 0 ? v.cylinders / v.stops : 0, customers: filtered.filter(c => getZone(c.province, c.city, effectiveDepot(c, dayAssignments) as Depot, c.zip).short === v.short).length }))
      .sort((a, b) => b.cylPerStop - a.cylPerStop);
  }, [filtered, dayAssignments]);

  const weekdayBalance = useMemo(() => {
    const balance = {
      emmen:   { cylinders: { 1:0, 2:0, 3:0, 4:0, 5:0 }, customers: { 1:0, 2:0, 3:0, 4:0, 5:0 } },
      tilburg: { cylinders: { 1:0, 2:0, 3:0, 4:0, 5:0 }, customers: { 1:0, 2:0, 3:0, 4:0, 5:0 } },
    } as any;
    for (const c of filtered) {
      const asg = dayAssignments.get(c.key);
      if (asg?.active === false) continue;
      const actDepot = effectiveDepot(c, dayAssignments);
      const prefDay = asg?.preferred_day;
      if (prefDay && [1,2,3,4,5].includes(prefDay)) {
        balance[actDepot].cylinders[prefDay] += c.cylinders / 52;
        balance[actDepot].customers[prefDay]++;
      } else {
        const totalWkCyl = c.cylinders / 52;
        for (const d of WEEKDAYS) {
          const ratio = c.totalDeliveries > 0 ? (c.dowCounts[d] / c.totalDeliveries) : (1 / WEEKDAYS.length);
          balance[actDepot].cylinders[d] += totalWkCyl * ratio;
          balance[actDepot].customers[d] += ratio;
        }
      }
    }
    return balance;
  }, [filtered, dayAssignments]);

  const dagKosten = useMemo(() => {
    if (tspAllDays.size === 0) return null;
    const res: { dag: number; label: string; km: number; kosten: number }[] = [];
    for (const day of WEEKDAYS) {
      const dayMap = tspAllDays.get(day);
      let dayKm = 0;
      if (dayMap) {
        for (const { totalKm } of dayMap.values()) dayKm += totalKm;
      }
      res.push({
        dag: day,
        label: DAY_FULL[day],
        km: dayKm,
        kosten: dayKm * kostenPerKm
      });
    }
    return res;
  }, [tspAllDays, kostenPerKm]);

  // --- Handlers ---

  const applyHerindeling = async (list: typeof depotSuggestions) => {
    if (list.length === 0) return;
    setApplyingAll(true);
    try {
      const upserts = list.map(({ customer, otherDepot }) => {
        const cur = dayAssignments.get(customer.key) || { active: true, preferred_day: null, time_window_start: null, time_window_end: null, urgent: false, notes: null, vehicle_type: null };
        return {
          customer_key: customer.key,
          depot: customer.depot,
          depot_override: otherDepot,
          vehicle_type: cur.vehicle_type,
          preferred_day: cur.preferred_day,
          time_window_start: cur.time_window_start,
          time_window_end: cur.time_window_end,
          urgent: cur.urgent,
          notes: cur.notes,
          active: cur.active,
          updated_at: new Date().toISOString()
        };
      });

      const chunk = 50;
      for (let i = 0; i < upserts.length; i += chunk) {
        const { error } = await (supabase.from("route_day_assignments" as never) as any).upsert(upserts.slice(i, i + chunk), { onConflict: "customer_key" });
        if (error) throw error;
      }
      toast.success(`${list.length} klanten succesvol heringedeeld`);
      setSelectedSuggestions(new Set());
      onRefresh();
    } catch (e: any) {
      toast.error("Fout bij herindelen", { description: e.message });
    } finally {
      setApplyingAll(false);
    }
  };

  const exportHerindeling = () => {
    const rows = depotSuggestions.map(s => ({
      Klant: s.customer.name,
      Stad: s.customer.city,
      Postcode: s.customer.zip,
      Huidig_Depot: s.customer.depot === "emmen" ? "Emmen" : "Tilburg",
      Huidig_Km: Math.round(s.currentKm),
      Ideaal_Depot: s.otherDepot === "emmen" ? "Emmen" : "Tilburg",
      Ideaal_Km: Math.round(s.otherKm),
      Besparing_Km: Math.round(s.savingKm)
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Herindeling");
    XLSX.writeFile(wb, `Depot_Herindeling_${format(new Date(), "yyyy-MM-dd")}.xlsx`);
  };

  // --- Render ---

  const bestZone  = zoneEfficiency[0];
  const peakDay   = WEEKDAYS.reduce((best, d) => {
    const cylE = weekdayBalance.emmen.cylinders[d];
    const cylT = weekdayBalance.tilburg.cylinders[d];
    const bestE = weekdayBalance.emmen.cylinders[best];
    const bestT = weekdayBalance.tilburg.cylinders[best];
    return (cylE + cylT) > (bestE + bestT) ? d : best;
  }, WEEKDAYS[0] as 1|2|3|4|5);
  const peakCyl = Math.round(weekdayBalance.emmen.cylinders[peakDay] + weekdayBalance.tilburg.cylinders[peakDay]);
  const totalSaving = depotSuggestions.reduce((s, x) => s + x.savingKm, 0);

  return (
    <div className="space-y-6">
      {/* Geocoding progress */}
      {geoProgress && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Klantlocaties geocoderen voor depot-analyse: {geoProgress.done} / {geoProgress.total}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Herindel suggesties", value: filteredGeoPoints.length === 0 ? "—" : String(depotSuggestions.length), sub: filteredGeoPoints.length === 0 ? "Geocoding vereist" : "klanten dichter bij ander depot", icon: <ArrowRightLeft className="h-4 w-4 text-violet-500" />, color: "bg-violet-500/10" },
          { label: "Km-besparing (totaal)", value: filteredGeoPoints.length === 0 ? "—" : `~${Math.round(totalSaving)} km`, sub: "enkel, alle suggesties", icon: <TrendingUp className="h-4 w-4 text-emerald-500" />, color: "bg-emerald-500/10" },
          { label: "Meest efficiënte zone", value: bestZone ? `Zone ${bestZone.short}` : "—", sub: bestZone ? `${Math.round(bestZone.cylPerStop)} cil/stop` : "", icon: <Package className="h-4 w-4 text-blue-500" />, color: "bg-blue-500/10" },
          { label: "Drukste dag", value: DAY_FULL[peakDay], sub: `${peakCyl} cil/week gemiddeld`, icon: <Truck className="h-4 w-4 text-amber-500" />, color: "bg-amber-500/10" },
        ].map(({ label, value, sub, icon, color }) => (
          <div key={label} className="rounded-lg border bg-card p-4 flex items-start gap-3">
            <div className={cn("rounded-lg p-1.5 shrink-0 mt-0.5", color)}>{icon}</div>
            <div>
              <div className="text-xl font-bold tabular-nums leading-tight">{value}</div>
              <div className="text-xs text-muted-foreground">{label}</div>
              {sub && <div className="text-[11px] text-muted-foreground/70 mt-0.5">{sub}</div>}
            </div>
          </div>
        ))}
      </div>

      {/* Routekosten per dag */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Euro className="h-4 w-4 text-muted-foreground" />
            Geschatte routekosten per dag (TSP-basis)
          </h3>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-muted-foreground">Tarief:</span>
            <span className="text-muted-foreground">€</span>
            <input
              type="number"
              value={kostenPerKm}
              onChange={e => setKostenPerKm(Number(e.target.value) || 1.85)}
              step="0.05"
              min="0.50"
              max="9.99"
              className="h-7 w-16 rounded border bg-background px-1.5 text-xs font-medium"
            />
            <span className="text-muted-foreground">/km</span>
          </div>
        </div>
        {!dagKosten ? (
          <div className="rounded-lg bg-muted/40 border border-dashed px-4 py-4 text-center text-xs text-muted-foreground">
            <MapPin className="h-5 w-5 mx-auto mb-1 opacity-40" />
            Geocoding vereist voor routekostenberekening — open de <strong>Kaart</strong> tab
          </div>
        ) : (() => {
          const maxKm = Math.max(...dagKosten.map(r => r.km), 1);
          const weekKm = dagKosten.reduce((s, r) => s + r.km, 0);
          const weekKosten = dagKosten.reduce((s, r) => s + r.kosten, 0);
          return (
            <>
              <div className="space-y-2">
                {dagKosten.map(row => (
                  <div key={row.dag} className="flex items-center gap-3 text-xs">
                    <span className="w-20 font-medium shrink-0">{row.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary/60 transition-all" style={{ width: `${(row.km / maxKm) * 100}%` }} />
                    </div>
                    <span className="w-20 tabular-nums text-right shrink-0 text-muted-foreground">~{row.km.toLocaleString("nl-NL")} km</span>
                    <span className="w-16 tabular-nums text-right shrink-0 font-semibold">€ {row.kosten.toLocaleString("nl-NL")}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between text-xs pt-2 border-t border-border/40 font-semibold text-foreground">
                <span>Week totaal (schatting)</span>
                <span>~{weekKm.toLocaleString("nl-NL")} km · € {weekKosten.toLocaleString("nl-NL")}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Op basis van TSP nearest-neighbor algoritme + geocoding via postcode. Hemelsbreed, niet werkelijke rijafstand.
              </p>
            </>
          );
        })()}
      </div>

      {/* Weekdag balans */}
      <div className="rounded-lg border p-4 space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" />
          Weekdag balans — cilinders per dag
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(["emmen", "tilburg"] as Depot[]).map(depot => {
            const data   = weekdayBalance[depot];
            const maxCyl = Math.max(...WEEKDAYS.map(d => data.cylinders[d]), 1);
            const avg    = WEEKDAYS.reduce((s, d) => s + data.cylinders[d], 0) / WEEKDAYS.length;
            const depotColor = depot === "emmen" ? "bg-orange-400" : "bg-blue-400";
            const highColor  = "bg-red-400";

            return (
              <div key={depot}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{depot === "emmen" ? "SOL Emmen" : "SOL Tilburg"}</span>
                  <span className="text-xs text-muted-foreground">avg {Math.round(avg)} cil/dag</span>
                </div>
                <div className="flex items-end gap-2 h-28">
                  <TooltipProvider>
                    {WEEKDAYS.map(d => {
                      const cyl    = data.cylinders[d];
                      const pct    = maxCyl > 0 ? cyl / maxCyl : 0;
                      const isHigh = cyl > avg * 1.30;
                      return (
                        <Tooltip key={d}>
                          <TooltipTrigger asChild>
                            <div className="flex-1 flex flex-col items-center gap-1 cursor-help">
                              <span className="text-[10px] text-muted-foreground tabular-nums">{Math.round(cyl)}</span>
                              <div className="w-full flex items-end" style={{ height: "80px" }}>
                                <div className={cn("w-full rounded-t transition-all", isHigh ? highColor : depotColor)} style={{ height: `${Math.max(pct * 100, 2)}%` }} />
                              </div>
                              <span className="text-[10px] font-medium">{DAY_LABELS[d]}</span>
                            </div>
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">{DAY_FULL[d]}: {Math.round(cyl)} cil/week · {Math.round(data.customers[d])} klanten {isHigh ? " — boven gemiddeld" : ""}</TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </TooltipProvider>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  <span className="inline-block h-1.5 w-4 rounded bg-red-400 mr-1 align-middle" />
                  Rood = &gt;30% boven gemiddelde
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Dalende/Stijgende Klanten */}
      {(() => {
        const declining = filtered.filter(c => c.trend === "declining");
        const rising    = filtered.filter(c => c.trend === "rising");
        const newCust   = filtered.filter(c => c.trend === "new");
        if (declining.length === 0 && rising.length === 0 && newCust.length === 0) return null;
        
        const toggleTrend = (key: string) => {
          setExpandedTrends(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
          });
        };

        return (
          <div className="rounded-lg border p-4 space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              Klanttrends (6-maands venster)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
              {declining.length > 0 && (() => {
                const isExp = expandedTrends.has("declining");
                const list = isExp ? declining : declining.slice(0, 5);
                return (
                  <div className="rounded-lg border border-red-200 bg-red-50/50 p-3">
                    <div className="flex items-center gap-1.5 text-red-700 font-semibold text-sm mb-2"><TrendingDown className="h-3.5 w-3.5" />{declining.length} dalende klanten</div>
                    <div className={cn("space-y-1.5", isExp && "max-h-60 overflow-y-auto pr-2 custom-scrollbar")}>
                      {list.map(c => <button key={c.key} className="text-xs text-red-600 hover:underline block text-left truncate w-full" onClick={() => setDetailCustomer(c)} title={c.name}>{c.name}</button>)}
                    </div>
                    {declining.length > 5 && (
                      <button onClick={() => toggleTrend("declining")} className="text-xs font-semibold text-red-800/60 hover:text-red-800 mt-2 block">
                        {isExp ? "Toon minder" : `+${declining.length - 5} meer...`}
                      </button>
                    )}
                  </div>
                );
              })()}
              
              {rising.length > 0 && (() => {
                const isExp = expandedTrends.has("rising");
                const list = isExp ? rising : rising.slice(0, 5);
                return (
                  <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                    <div className="flex items-center gap-1.5 text-emerald-700 font-semibold text-sm mb-2"><TrendingUp className="h-3.5 w-3.5" />{rising.length} stijgende klanten</div>
                    <div className={cn("space-y-1.5", isExp && "max-h-60 overflow-y-auto pr-2 custom-scrollbar")}>
                      {list.map(c => <button key={c.key} className="text-xs text-emerald-600 hover:underline block text-left truncate w-full" onClick={() => setDetailCustomer(c)} title={c.name}>{c.name}</button>)}
                    </div>
                    {rising.length > 5 && (
                      <button onClick={() => toggleTrend("rising")} className="text-xs font-semibold text-emerald-800/60 hover:text-emerald-800 mt-2 block">
                        {isExp ? "Toon minder" : `+${rising.length - 5} meer...`}
                      </button>
                    )}
                  </div>
                );
              })()}

              {newCust.length > 0 && (() => {
                const isExp = expandedTrends.has("new");
                const list = isExp ? newCust : newCust.slice(0, 5);
                return (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                    <div className="flex items-center gap-1.5 text-blue-700 font-semibold text-sm mb-2"><Sparkles className="h-3.5 w-3.5" />{newCust.length} nieuwe klanten</div>
                    <div className={cn("space-y-1.5", isExp && "max-h-60 overflow-y-auto pr-2 custom-scrollbar")}>
                      {list.map(c => <button key={c.key} className="text-xs text-blue-600 hover:underline block text-left truncate w-full" onClick={() => setDetailCustomer(c)} title={c.name}>{c.name}</button>)}
                    </div>
                    {newCust.length > 5 && (
                      <button onClick={() => toggleTrend("new")} className="text-xs font-semibold text-blue-800/60 hover:text-blue-800 mt-2 block">
                        {isExp ? "Toon minder" : `+${newCust.length - 5} meer...`}
                      </button>
                    )}
                  </div>
                );
              })()}
            </div>
          </div>
        );
      })()}

      {/* Frequentie verdeling + Zone efficiëntie */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            Frequentie verdeling
          </h3>
          {([
            { key: "dagelijks",     label: "Dagelijks",      sub: "≥ 1×/week",    color: "bg-emerald-500" },
            { key: "wekelijks",     label: "Wekelijks",      sub: "½–1×/week",    color: "bg-blue-500" },
            { key: "tweewekelijks", label: "Tweewekelijks",  sub: "¼–½×/week",    color: "bg-amber-500" },
            { key: "maandelijks",   label: "Maandelijks",    sub: "< ¼×/week",    color: "bg-slate-400" },
          ] as { key: keyof typeof frequencyBreakdown; label: string; sub: string; color: string }[]).map(({ key, label, sub, color }) => {
            const count = frequencyBreakdown[key];
            const pct   = totalFreq > 0 ? (count / totalFreq) : 0;
            return (
              <div key={key} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{label}<span className="text-muted-foreground font-normal ml-1">({sub})</span></span>
                  <span className="tabular-nums">{count} · {Math.round(pct * 100)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full", color)} style={{ width: `${pct * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>

        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            Zone efficiëntie — cilinders per stop
          </h3>
          <div className="space-y-2">
            {zoneEfficiency.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Geen data beschikbaar</p>
            ) : (() => {
              const maxCps = zoneEfficiency[0]?.cylPerStop ?? 1;
              return zoneEfficiency.map(z => {
                const zCol = ZONE_COLORS[z.short] ?? ZONE_COLORS.F;
                return (
                  <div key={z.short} className="flex items-center gap-2 text-xs">
                    <Badge variant="outline" className={cn("text-[10px] font-bold px-1.5 shrink-0", zCol.badge)}>{z.short}</Badge>
                    <span className="text-muted-foreground w-28 truncate shrink-0" title={z.zone.split("—")[1]?.trim()}>{z.zone.split("—")[1]?.trim()}</span>
                    <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full" style={{ width: `${(z.cylPerStop / maxCps) * 100}%`, background: zCol.stroke }} />
                    </div>
                    <span className="tabular-nums font-semibold w-12 text-right shrink-0">{Math.round(z.cylPerStop)} c/s</span>
                    <span className="text-muted-foreground w-14 text-right shrink-0">{z.customers} kl.</span>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      </div>

      {/* Depot herindeling */}
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
            Depot herindeling suggesties
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild><Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" /></TooltipTrigger>
                <TooltipContent className="text-xs max-w-[260px]">Klanten waarbij het andere depot ≥10 km dichter bij is (hemelsbreed). Geocoding via postcode is vereist.</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </h3>
          {depotSuggestions.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              {selectedSuggestions.size > 0 && (
                <Button size="sm" onClick={() => applyHerindeling(depotSuggestions.filter(s => selectedSuggestions.has(s.customer.key)))} disabled={applyingAll} className="h-8 gap-1.5">
                  {applyingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Pas selectie toe ({selectedSuggestions.size})
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => applyHerindeling(depotSuggestions)} disabled={applyingAll} className="h-8 gap-1.5">
                {applyingAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />} Alles toepassen
              </Button>
              <Button variant="outline" size="sm" onClick={exportHerindeling} className="h-8 gap-1.5"><Download className="h-3.5 w-3.5" /> Export</Button>
            </div>
          )}
        </div>

        {filteredGeoPoints.length === 0 ? (
          <div className="rounded-lg bg-muted/40 border border-dashed px-4 py-6 text-center text-sm text-muted-foreground">
            <MapPin className="h-6 w-6 mx-auto mb-2 opacity-40" />
            <p>Geocoding vereist — open de <strong>Kaart</strong> tab om klantlocaties te laden.</p>
            <p className="text-xs mt-1">Resultaten worden gecached in je browser voor toekomstig gebruik.</p>
          </div>
        ) : depotSuggestions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Geen herindelingssuggesties — alle klanten worden optimaal bediend vanuit hun huidige depot.</p>
        ) : (
          <>
            <p className="text-xs text-muted-foreground">{depotSuggestions.length} klanten · totale besparing ~{Math.round(totalSaving)} km per levering (enkel)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-2 py-2 w-6"><input type="checkbox" checked={selectedSuggestions.size === depotSuggestions.length && depotSuggestions.length > 0} onChange={e => setSelectedSuggestions(e.target.checked ? new Set(depotSuggestions.map(s => s.customer.key)) : new Set())} className="rounded" /></th>
                    <th className="px-3 py-2 text-left">Klant</th>
                    <th className="px-3 py-2 text-left hidden md:table-cell">Stad</th>
                    <th className="px-3 py-2 text-center">Nu</th>
                    <th className="px-3 py-2 text-right">Nu (km)</th>
                    <th className="px-3 py-2 text-center">Beter</th>
                    <th className="px-3 py-2 text-right">Beter (km)</th>
                    <th className="px-3 py-2 text-right font-bold">Besparing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {depotSuggestions.map(s => (
                    <tr key={s.customer.key} className={cn("hover:bg-muted/20 transition-colors", selectedSuggestions.has(s.customer.key) ? "bg-primary/5" : "")}>
                      <td className="px-2 py-2"><input type="checkbox" checked={selectedSuggestions.has(s.customer.key)} onChange={e => setSelectedSuggestions(prev => { const next = new Set(prev); e.target.checked ? next.add(s.customer.key) : next.delete(s.customer.key); return next; })} className="rounded" /></td>
                      <td className="px-3 py-2 font-medium max-w-[180px]"><span className="line-clamp-1" title={s.customer.name}>{s.customer.name}</span></td>
                      <td className="px-3 py-2 text-muted-foreground hidden md:table-cell whitespace-nowrap">{s.customer.city}</td>
                      <td className="px-3 py-2 text-center"><Badge variant="outline" className={cn("text-[10px] font-semibold", s.customer.depot === "emmen" ? "border-orange-300 text-orange-700 bg-orange-50" : "border-blue-300 text-blue-700 bg-blue-50")}>{s.customer.depot === "emmen" ? "Emmen" : "Tilburg"}</Badge></td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{Math.round(s.currentKm)} km</td>
                      <td className="px-3 py-2 text-center"><Badge variant="outline" className={cn("text-[10px] font-semibold", s.otherDepot === "emmen" ? "border-orange-300 text-orange-700 bg-orange-50" : "border-blue-300 text-blue-700 bg-blue-50")}>{s.otherDepot === "emmen" ? "Emmen" : "Tilburg"}</Badge></td>
                      <td className="px-3 py-2 text-right tabular-nums text-emerald-600">{Math.round(s.otherKm)} km</td>
                      <td className="px-3 py-2 text-right tabular-nums font-bold text-emerald-700">-{Math.round(s.savingKm)} km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
