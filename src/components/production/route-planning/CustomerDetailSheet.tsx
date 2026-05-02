import React, { forwardRef, useImperativeHandle, useState, useRef, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import {
  MapPin, Heart, Power, PowerOff, AlertCircle, Truck,
  TrendingUp, TrendingDown, Sparkles, ArrowRightLeft,
  Package, MessageSquare, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CustomerSummary, DayAssignment } from "./types";
import {
  PERIOD_MONTHS, WEEKDAYS, DAY_LABELS,
  effectiveVehicleType, effectiveDepot,
} from "./utils";

export interface CustomerDetailSheetHandle {
  open: (c: CustomerSummary) => void;
}

interface Props {
  dayAssignments: Map<string, DayAssignment>;
  updateAssignment: (c: CustomerSummary, updates: Partial<DayAssignment>) => void;
}

export const CustomerDetailSheet = forwardRef<CustomerDetailSheetHandle, Props>(
  function CustomerDetailSheet({ dayAssignments, updateAssignment }, ref) {
    const [customer, setCustomer] = useState<CustomerSummary | null>(null);
    const [noteValue, setNoteValue] = useState("");
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useImperativeHandle(ref, () => ({
      open: (c: CustomerSummary) => {
        setCustomer(c);
        setNoteValue(dayAssignments.get(c.key)?.notes ?? "");
      },
    }));

    // Flush debounced note on unmount
    useEffect(() => () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    }, []);

    const handleNoteChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setNoteValue(val);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (customer) {
        debounceRef.current = setTimeout(() => {
          updateAssignment(customer, { notes: val });
        }, 600);
      }
    };

    const asg = customer ? dayAssignments.get(customer.key) : undefined;
    const isActive = asg?.active !== false;
    const isUrgent = asg?.urgent ?? false;
    const vt = customer ? effectiveVehicleType(customer, dayAssignments) : "truck";
    const dep = customer ? effectiveDepot(customer, dayAssignments) : "emmen";

    return (
      <Sheet open={!!customer} onOpenChange={(o) => { if (!o) setCustomer(null); }} modal={false}>
        <SheetContent
          className="w-full sm:max-w-md overflow-y-auto"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <SheetHeader className="mb-6">
            <SheetTitle className="text-xl font-bold flex items-center gap-2">
              {customer?.name}
              {customer?.isMedical && <Heart className="h-4 w-4 text-rose-500 fill-rose-100" />}
            </SheetTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {customer?.street && <span>{customer.street}, </span>}{customer?.zip} {customer?.city}, {customer?.zone}
            </div>
          </SheetHeader>

          <div className="sr-only" aria-describedby="dialog-desc">
            <span id="dialog-desc">Klant specificaties en details</span>
          </div>

          {customer && (
            <div className="space-y-6">
              {/* Status Banner */}
              <div className="grid grid-cols-2 gap-3">
                <div className={cn(
                  "rounded-lg border p-3 flex flex-col gap-1",
                  isActive ? "bg-emerald-50 border-emerald-200" : "bg-slate-100 border-slate-300"
                )}>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</span>
                  <div className="flex items-center gap-2 font-bold">
                    {isActive
                      ? <Power className="h-4 w-4 text-emerald-600" />
                      : <PowerOff className="h-4 w-4 text-slate-400" />}
                    <span className={isActive ? "text-emerald-700" : "text-slate-600"}>
                      {isActive ? "Actief" : "Inactief"}
                    </span>
                  </div>
                </div>
                {isUrgent && (
                  <div className="rounded-lg border p-3 flex flex-col gap-1 bg-red-50 border-red-200">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Let op</span>
                    <div className="flex items-center gap-2 font-bold text-red-700">
                      <AlertCircle className="h-4 w-4" />
                      Markering: Urgent
                    </div>
                  </div>
                )}
              </div>

              {/* Tijdvenster */}
              {(asg?.time_window_start || asg?.time_window_end) && (
                <div className="rounded-lg border p-3 bg-sky-50 border-sky-200">
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tijdvenster</span>
                  <div className="flex items-center gap-2 mt-1 font-medium text-sky-700">
                    <Clock className="h-4 w-4" />
                    {asg?.time_window_start?.slice(0, 5)} – {asg?.time_window_end?.slice(0, 5)}
                  </div>
                </div>
              )}

              {/* Operationeel */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-400 flex items-center gap-2">
                  <Truck className="h-4 w-4" /> Operationeel
                </h3>
                <div className="grid grid-cols-2 gap-y-4 gap-x-2 text-sm">
                  <div>
                    <div className="text-muted-foreground mb-1">Leverpunt Depot</div>
                    <button
                      onClick={() => {
                        const newDep = dep === "emmen" ? "tilburg" : "emmen";
                        updateAssignment(customer, { depot_override: newDep === customer.depot ? null : newDep });
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded-full border text-xs font-semibold transition-all hover:scale-105 active:scale-95",
                        asg?.depot_override ? "ring-1 ring-offset-1" : "",
                        dep === "emmen"
                          ? "bg-orange-50 border-orange-200 text-orange-800 ring-orange-400"
                          : "bg-blue-50 border-blue-200 text-blue-800 ring-blue-400"
                      )}
                      title={asg?.depot_override ? `Override actief (origineel: ${customer.depot === "emmen" ? "Emmen" : "Tilburg"})` : "Klik om depot te wisselen"}
                    >
                      {dep === "emmen" ? "S.O.L. Emmen" : "S.O.L. Tilburg"}
                    </button>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Voertuig type</div>
                    <button
                      onClick={() => {
                        const newVt = vt === "truck" ? "courier" : "truck";
                        updateAssignment(customer, { vehicle_type: newVt === customer.vehicleType ? null : newVt });
                      }}
                      className={cn(
                        "px-2 py-0.5 rounded-full border text-xs font-semibold flex items-center gap-1 transition-all hover:scale-105 active:scale-95",
                        asg?.vehicle_type ? "ring-1 ring-offset-1" : "",
                        vt === "truck"
                          ? "bg-slate-50 border-slate-200 text-slate-700 ring-slate-400"
                          : "bg-rose-50 border-rose-200 text-rose-700 ring-rose-400"
                      )}
                      title={asg?.vehicle_type ? `Override actief (origineel: ${customer.vehicleType})` : "Klik om voertuigtype te wisselen"}
                    >
                      {vt === "truck"
                        ? <><Truck className="h-3.5 w-3.5" /> Vrachtwagen</>
                        : <><Heart className="h-3.5 w-3.5" /> Koerier (med.)</>}
                    </button>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Frequentie (hist.)</div>
                    <div className="font-medium">{customer.perWeek.toFixed(1)}x per week</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Totaal leveringen</div>
                    <div className="font-medium">{customer.totalDeliveries} ({PERIOD_MONTHS} mnd)</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground mb-1">Cilinders (equiv.)</div>
                    <div className="font-medium">{customer.cylinders.toLocaleString("nl-NL")} st</div>
                  </div>
                </div>
              </div>

              {/* Historie & Trend */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-400 flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" /> Historie & Trend
                </h3>
                <div className="rounded-lg border p-4 bg-slate-50/50 space-y-3">
                  <div>
                    <div className="text-muted-foreground text-xs mb-2">Trend (laatste 3 mnd)</div>
                    {customer.trend === "rising" ? (
                      <div className="flex items-center gap-2 text-emerald-600 font-medium">
                        <TrendingUp className="h-4 w-4" /> Licht stijgend in afnames
                      </div>
                    ) : customer.trend === "declining" ? (
                      <div className="flex items-center gap-2 text-red-500 font-medium">
                        <TrendingDown className="h-4 w-4" /> Daling in afnames
                      </div>
                    ) : customer.trend === "new" ? (
                      <div className="flex items-center gap-2 text-blue-500 font-medium">
                        <Sparkles className="h-4 w-4" /> Nieuwe actieve klant
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-slate-600">
                        <ArrowRightLeft className="h-4 w-4" /> Stabiel patroon
                      </div>
                    )}
                  </div>
                  <div className="pt-2 border-t border-slate-200">
                    <div className="text-muted-foreground text-xs mb-2">Populairste Dagen</div>
                    <div className="flex gap-2 flex-wrap">
                      {WEEKDAYS.map(d => {
                        const count = customer.dowCounts[d];
                        if (count === 0) return null;
                        return (
                          <Badge key={d} variant="secondary" className="gap-1 bg-slate-100">
                            {DAY_LABELS[d]} <span className="opacity-50">({count}x)</span>
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Hoofdproducten */}
              {customer.topProductDetails.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-400 flex items-center gap-2">
                    <Package className="h-4 w-4" /> Hoofdproducten
                  </h3>
                  <div className="space-y-1.5">
                    {customer.topProductDetails.map((p, idx) => (
                      <div key={idx} className="rounded-md border bg-slate-50 px-3 py-2 text-sm">
                        <div className="font-medium text-slate-800 truncate" title={p.name}>{p.name}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 flex gap-2">
                          {p.container && <span>{p.container}</span>}
                          {p.capacity > 0 && <span className="text-slate-400">·</span>}
                          {p.capacity > 0 && <span>{p.capacity} L</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Plan Notities */}
              <div className="space-y-3">
                <h3 className="font-semibold text-sm uppercase tracking-wide text-slate-400 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" /> Plan Notities
                </h3>
                <textarea
                  className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  rows={3}
                  placeholder="Voeg een notitie toe voor deze route..."
                  value={noteValue}
                  onChange={handleNoteChange}
                />
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    );
  }
);

CustomerDetailSheet.displayName = "CustomerDetailSheet";
