import React from "react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Truck, Heart, Printer, AlertCircle, Clock, MapPin, Euro, MessageSquare } from "lucide-react";
import { CustomerSummary, DayAssignment, Depot, TspGroupResult } from "./types";
import { 
  WEEKDAYS, DAY_FULL, MAX_CYLINDERS_TRUCK, MAX_TOTAL_LOAD, WEEKS,
  ZONE_COLORS, getZone, effectiveDepot, getADRClass, capacityBarColor
} from "./utils";

interface DayViewProps {
  customers: CustomerSummary[];
  dayAssignments: Map<string, DayAssignment>;
  dayCustomers: { assigned: CustomerSummary[]; suggested: CustomerSummary[]; all: CustomerSummary[] };
  selectedDay: 1|2|3|4|5;
  setSelectedDay: (d: 1|2|3|4|5) => void;
  dragKey: string | null;
  setDragKey: (k: string | null) => void;
  dragOver: number | null;
  setDragOver: (k: number | null) => void;
  updateAssignment: (c: CustomerSummary, updates: Partial<DayAssignment>) => void;
  truckGroups: Record<string, Record<Depot, CustomerSummary[]>>;
  tspDayGroups: Map<string, TspGroupResult>;
  adrWarnings: Map<string, { conflict: boolean; oxidizers: string[]; flammables: string[] }>;
  printGroupKey: string | null;
  setPrintGroupKey: (k: string | null) => void;
  kostenPerKm: number;
}

export function DayView({
  customers, dayAssignments, dayCustomers, selectedDay, setSelectedDay,
  dragKey, setDragKey, dragOver, setDragOver, updateAssignment,
  truckGroups, tspDayGroups, adrWarnings, printGroupKey, setPrintGroupKey,
  kostenPerKm
}: DayViewProps) {
  return (
    <div className="space-y-4">
      {/* Dag selector (ook drop-target voor drag & drop) */}
      <div className="flex items-center gap-1 flex-wrap">
        {WEEKDAYS.map(d => (
          <button
            key={d}
            onClick={() => setSelectedDay(d as 1|2|3|4|5)}
            onDragOver={e => { e.preventDefault(); setDragOver(d); }}
            onDragLeave={() => setDragOver(null)}
            onDrop={e => {
              e.preventDefault();
              if (dragKey) {
                const customer = customers.find(c => c.key === dragKey);
                if (customer) updateAssignment(customer, { preferred_day: d as 1|2|3|4|5 });
              }
              setDragKey(null);
              setDragOver(null);
            }}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-semibold border transition-all",
              selectedDay === d
                ? "bg-primary text-primary-foreground border-primary shadow-sm"
                : dragOver === d
                  ? "bg-blue-100 border-blue-400 text-blue-800 scale-105"
                  : "bg-background text-muted-foreground hover:text-foreground hover:bg-muted/60"
            )}
          >
            {DAY_FULL[d]}
          </button>
        ))}
        <span className="ml-2 text-xs text-muted-foreground">
          {dayCustomers.all.length} klanten · {dayCustomers.assigned.length} vast · {dayCustomers.suggested.length} suggestie
        </span>
        {dragKey && (
          <span className="ml-1 text-xs text-blue-600 font-medium animate-pulse">
            Sleep naar een dag om te herplannen
          </span>
        )}
      </div>

      {/* 4 vrachtwagen-kaarten */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {([
          { vt: "truck" as const,   depot: "emmen" as Depot,   label: "Emmen — Vrachtwagen",   color: "border-blue-200 bg-blue-50/30" },
          { vt: "truck" as const,   depot: "tilburg" as Depot, label: "Tilburg — Vrachtwagen", color: "border-amber-200 bg-amber-50/30" },
          { vt: "courier" as const, depot: "emmen" as Depot,   label: "Emmen — Koerier",       color: "border-rose-200 bg-rose-50/30" },
          { vt: "courier" as const, depot: "tilburg" as Depot, label: "Tilburg — Koerier",     color: "border-rose-200 bg-rose-50/30" },
        ]).map(({ vt, depot, label, color }) => {
          const groupKey   = `${depot}-${vt}`;
          const group      = truckGroups[vt][depot];
          const tspGroup   = tspDayGroups.get(groupKey);
          const adrWarn    = adrWarnings.get(groupKey);
          const cylPerWeek = group.reduce((s, c) => s + c.cylinders / WEEKS, 0);
          const capPct     = vt === "truck" ? cylPerWeek / MAX_CYLINDERS_TRUCK : 0;
          const totalLoad  = cylPerWeek * 2;
          const totalPct   = totalLoad / MAX_TOTAL_LOAD;

          const displayGroup = tspGroup
            ? [...tspGroup.ordered.map(p => p.customer), ...tspGroup.withoutGeo]
            : group;
          const orderedKeys = tspGroup?.ordered.map(p => p.customer.key) ?? [];

          return (
            <div key={groupKey} className={cn("rounded-lg border p-4 space-y-3", color)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {vt === "truck"
                    ? <Truck className="h-4 w-4 text-slate-600" />
                    : <Heart className="h-4 w-4 text-rose-500" />}
                  <span className="font-semibold text-sm">{label}</span>
                  {tspGroup && tspGroup.ordered.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">TSP</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{group.length} klanten</span>
                  {group.length > 0 && (
                    <button
                      onClick={() => setPrintGroupKey(printGroupKey === groupKey ? null : groupKey)}
                      className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] transition-colors", printGroupKey === groupKey ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/60")}
                    >
                      <Printer className="h-3 w-3" />
                      Briefing
                    </button>
                  )}
                </div>
              </div>

              {/* Printbriefing */}
              {printGroupKey === groupKey && (
                <div className="rounded border border-border/60 bg-white p-3 text-xs space-y-2 print-briefing print:block! hidden:block">
                  <div className="flex justify-between items-start border-b pb-2">
                    <div>
                      <div className="font-bold text-sm">{label}</div>
                      <div className="text-muted-foreground">{DAY_FULL[selectedDay]} · {format(new Date(), "d MMMM yyyy", { locale: nl })}</div>
                    </div>
                    <button
                      onClick={() => {
                        setPrintGroupKey(null);
                        setTimeout(() => {
                          setPrintGroupKey(groupKey);
                          setTimeout(() => { window.print(); setPrintGroupKey(null); }, 100);
                        }, 50);
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded border text-xs hover:bg-muted/60"
                    >
                      <Printer className="h-3 w-3" /> Afdrukken
                    </button>
                  </div>
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b text-muted-foreground text-left">
                        <th className="py-1 pr-2 w-6">#</th>
                        <th className="py-1 pr-2">Klant</th>
                        <th className="py-1 pr-2 hidden sm:table-cell">Adres</th>
                        <th className="py-1 pr-2 w-16">Venster</th>
                        <th className="py-1 pr-2 w-10">Cil.</th>
                        <th className="py-1">ADR</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayGroup.map((c, i) => {
                        const a = dayAssignments.get(c.key);
                        const tw = a?.time_window_start && a?.time_window_end
                          ? `${a.time_window_start.slice(0,5)}–${a.time_window_end.slice(0,5)}`
                          : "";
                        const adrCls = getADRClass(c.topProducts);
                        return (
                          <tr key={c.key} className="border-b border-border/30">
                            <td className="py-1 pr-2 text-muted-foreground">{i + 1}</td>
                            <td className="py-1 pr-2 font-medium">{c.name}</td>
                            <td className="py-1 pr-2 text-muted-foreground hidden sm:table-cell">{c.city} · {c.zip}</td>
                            <td className="py-1 pr-2">{tw || "—"}</td>
                            <td className="py-1 pr-2 text-right tabular-nums">{Math.round(c.cylinders / WEEKS)}</td>
                            <td className="py-1">
                              {adrCls !== "none" && (
                                <Badge variant="outline" className="text-[9px] px-1">
                                  {adrCls === "oxidizer" ? "Ox." : adrCls === "flammable" ? "Br." : "Inert"}
                                </Badge>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex justify-between pt-1 border-t font-semibold">
                    <span>Totaal: {displayGroup.length} stops · {Math.round(cylPerWeek)} cil.</span>
                    {tspGroup && <span>Route: ~{Math.round(tspGroup.totalKm)} km</span>}
                  </div>
                </div>
              )}

              {/* ADR waarschuwing */}
              {adrWarn?.conflict && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-orange-50 border border-orange-200 text-xs text-orange-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>ADR-conflict:</strong> oxiderende én brandbare gassen op dezelfde wagen — controleer ADR-scheiding
                  </span>
                </div>
              )}

              {/* Capaciteitsconflict */}
              {vt === "truck" && capPct > 1 && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span><strong>Capaciteit overschreden!</strong> {Math.round(cylPerWeek)} cil. op {MAX_CYLINDERS_TRUCK} max — verplaats klanten naar een andere dag.</span>
                </div>
              )}
              {vt === "truck" && capPct > 0.9 && capPct <= 1 && (
                <div className="flex items-start gap-2 p-2 rounded-md bg-amber-50 border border-amber-200 text-xs text-amber-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span><strong>Capaciteit nest bijna vol</strong> ({Math.round(capPct * 100)}%) — overweeg een klant te verzetten naar een andere dag.</span>
                </div>
              )}

              {group.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Geen klanten ingepland</p>
              ) : (
                <div className="space-y-0.5">
                  {displayGroup.map(c => {
                    const isAssigned = dayAssignments.get(c.key)?.preferred_day === selectedDay;
                    const asg = dayAssignments.get(c.key);
                    const isUrgent = asg?.urgent ?? false;
                    const stopNr = orderedKeys.indexOf(c.key);
                    const displayNr = stopNr >= 0 ? stopNr + 1 : null;
                    const tw = asg?.time_window_start && asg?.time_window_end
                      ? `${asg.time_window_start.slice(0,5)}–${asg.time_window_end.slice(0,5)}`
                      : null;
                    const effZone = getZone(c.province, c.city, effectiveDepot(c, dayAssignments), c.zip);

                    return (
                      <div
                        key={c.key}
                        draggable
                        onDragStart={() => setDragKey(c.key)}
                        onDragEnd={() => { setDragKey(null); setDragOver(null); }}
                        style={{ opacity: dragKey === c.key ? 0.4 : 1 }}
                        className={cn(
                          "flex items-center gap-1.5 text-xs py-1 border-b border-border/30 last:border-0 cursor-grab active:cursor-grabbing rounded-sm",
                          isUrgent ? "bg-red-50/70" : ""
                        )}
                      >
                        <span className={cn(
                          "text-[10px] font-bold w-4 shrink-0 text-center",
                          displayNr !== null ? "text-muted-foreground" : "text-muted-foreground/25"
                        )}>
                          {displayNr ?? "—"}
                        </span>

                        {isUrgent && <AlertCircle className="h-3 w-3 text-red-500 shrink-0" />}

                        <div className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0",
                          isAssigned ? "bg-emerald-500" : "bg-gray-300"
                        )} />

                        <div className="flex-1 min-w-0">
                          <span className={cn("font-medium block truncate", isUrgent ? "text-red-700" : "")} title={c.name}>
                            {c.name}
                          </span>
                          {tw && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Clock className="h-2.5 w-2.5" />{tw}
                            </span>
                          )}
                          {asg?.notes && (
                            <span className="text-[10px] text-blue-600/70 flex items-center gap-0.5 truncate">
                              <MessageSquare className="h-2.5 w-2.5 shrink-0" />
                              <span className="truncate">{asg.notes}</span>
                            </span>
                          )}
                        </div>

                        <Badge variant="outline" className={cn("text-[10px] px-1 py-0 h-4 shrink-0", ZONE_COLORS[effZone.short]?.badge ?? "")}>
                          {effZone.short}
                        </Badge>
                        <span className="text-muted-foreground w-14 text-right shrink-0">
                          {formatNumber(c.perWeek, 1)}×/w
                        </span>
                        {isAssigned
                          ? <span className="text-emerald-600 font-semibold w-12 text-right shrink-0">Vast</span>
                          : <span className="text-muted-foreground w-12 text-right shrink-0">Suggestie</span>}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Capaciteit + retour + TSP kosten (alleen vrachtwagen) */}
              {vt === "truck" && (
                <div className="space-y-1.5 pt-1 border-t border-border/40">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Uitlevering (vol)</span>
                    <span className={cn("font-semibold", capPct >= 0.90 ? "text-red-600" : capPct >= 0.70 ? "text-amber-600" : "text-emerald-600")}>
                      {Math.round(cylPerWeek)} / {MAX_CYLINDERS_TRUCK} cil
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", capacityBarColor(capPct))}
                      style={{ width: `${Math.min(capPct * 100, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Retour (lege cil.)</span>
                    <span className="text-slate-500">~{Math.round(cylPerWeek)} cil</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-slate-400 transition-all"
                      style={{ width: `${Math.min(capPct * 100, 100)}%` }} />
                  </div>
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-muted-foreground font-normal">Totale lading</span>
                    <span className={cn(totalPct >= 0.90 ? "text-red-600" : totalPct >= 0.70 ? "text-amber-600" : "text-emerald-700")}>
                      {Math.round(totalLoad)} / {MAX_TOTAL_LOAD} cil-eq.
                    </span>
                  </div>
                  {tspGroup && tspGroup.ordered.length > 0 && (
                    <div className="flex justify-between text-[11px] text-muted-foreground pt-0.5 border-t border-border/30">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" />
                        TSP-route: ~{Math.round(tspGroup.totalKm)} km
                      </span>
                      <span className="font-medium flex items-center gap-0.5">
                        <Euro className="h-2.5 w-2.5" />
                        {Math.round(tspGroup.totalKm * kostenPerKm).toLocaleString("nl-NL")}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
