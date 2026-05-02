import React, { memo } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Power, PowerOff, AlertCircle, TrendingDown, Truck, Heart, ChevronDown, MoreHorizontal, Info } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

import { cn } from "@/lib/utils";
import { CustomerSummary, DayAssignment } from "./types";
import { effectiveVehicleType, DAY_LABELS, WEEKDAYS, DAY_FULL } from "./utils";

interface CustomerRowProps {
  c: CustomerSummary;
  assignment: DayAssignment | undefined;
  isSaving: boolean;
  bulkSelected: boolean;
  zoneColor: { badge: string; row: string; stroke: string };
  toggleSelection: (key: string, selected: boolean) => void;
  updateAssignment: (c: CustomerSummary, updates: Partial<DayAssignment>) => void;
  setDetailCustomer: (c: CustomerSummary) => void;
  measureRef: (node: Element | null) => void;
  dataIndex: number;
}

function CustomerRowComponent({
  c,
  assignment,
  isSaving,
  bulkSelected,
  zoneColor,
  toggleSelection,
  updateAssignment,
  setDetailCustomer,
  measureRef,
  dataIndex
}: CustomerRowProps) {
  const assignedDay = assignment?.preferred_day ?? null;
  const matchesPref = assignedDay !== null && c.preferredDays.includes(assignedDay);
  const isUrgent = assignment?.urgent ?? false;
  const isActive = assignment?.active !== false;
  
  // To avoid calculating this via effectiveVehicleType which takes dayAssignments map in the original,
  // we can just pass the specific assignment. 
  // Wait, effectiveVehicleType(c, dayAssignments) -> we can just do:
  const effVt = assignment?.vehicle_type ?? c.vehicleType;
  const dep = assignment?.depot_override ?? c.depot;

  return (
    <tr
      ref={measureRef}
      data-index={dataIndex}
      className={cn(
        "group border-l-4 transition-all hover:bg-slate-50/70 hover:shadow-[inset_0_-1px_0_rgba(0,0,0,0.02)]",
        zoneColor.row,
        bulkSelected ? "bg-primary/5 hover:bg-primary/10" : "bg-white",
        !isActive ? "opacity-50 hover:opacity-80" : isUrgent ? "bg-red-50/30" : effVt !== "truck" ? "bg-rose-50/10" : ""
      )}
      style={{ borderLeftColor: zoneColor.stroke, height: '44px' }}
    >
      <td className="px-2 py-2 text-center align-middle">
        <input
          type="checkbox"
          className="rounded border-slate-300 text-primary focus:ring-primary/20 transition-all cursor-pointer h-3.5 w-3.5"
          checked={bulkSelected}
          onChange={(e) => toggleSelection(c.key, e.target.checked)}
        />
      </td>
      
      <td className="px-3 py-2 font-medium truncate align-middle relative">
        <div className="flex items-center gap-2">
          {isUrgent && <AlertCircle className="h-4 w-4 text-red-500 fill-red-100 shrink-0" />}
          {!isActive && <PowerOff className="h-3.5 w-3.5 text-slate-400 shrink-0" />}
          <button
            className="truncate text-left font-semibold text-slate-800 hover:text-primary transition-colors focus:outline-none"
            title={c.name}
            onClick={() => setDetailCustomer(c)}
          >
            {c.name}
          </button>
          {c.trend === "declining" && (
            <Tooltip>
              <TooltipTrigger asChild>
                <TrendingDown className="h-3.5 w-3.5 text-red-500 shrink-0" />
              </TooltipTrigger>
              <TooltipContent className="text-xs">Daling in afnames (laatste 3mnd)</TooltipContent>
            </Tooltip>
          )}
        </div>
      </td>
      
      <td className="px-3 py-2 text-slate-500 text-[13px] truncate hidden md:table-cell align-middle" title={c.city}>
        {c.city}
      </td>
      
      <td className="px-1 py-2 hidden lg:table-cell align-middle text-center">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                const newDepot = dep === "emmen" ? "tilburg" : "emmen";
                updateAssignment(c, { depot_override: newDepot === c.depot ? null : newDepot });
              }}
              className={cn(
                "text-[9px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full border cursor-pointer transition-all hover:scale-110 active:scale-95",
                assignment?.depot_override ? "ring-1 ring-offset-1" : "",
                dep === "emmen"
                  ? "bg-orange-100/50 text-orange-800 border-orange-200 ring-orange-400"
                  : "bg-blue-100/50 text-blue-800 border-blue-200 ring-blue-400"
              )}
            >
              {dep === "emmen" ? "EMM" : "TIL"}
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            {assignment?.depot_override
              ? `Override: ${dep === "emmen" ? "Emmen" : "Tilburg"} (origineel: ${c.depot === "emmen" ? "Emmen" : "Tilburg"}) — klik om te wisselen`
              : `Depot: ${dep === "emmen" ? "Emmen" : "Tilburg"} — klik om te wisselen naar ${dep === "emmen" ? "Tilburg" : "Emmen"}`
            }
          </TooltipContent>
        </Tooltip>
      </td>
      
      <td className="px-1 py-2 text-center align-middle">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => {
                const newVt = effVt === "truck" ? "courier" : "truck";
                updateAssignment(c, { vehicle_type: newVt === c.vehicleType ? null : newVt });
              }}
              className={cn(
                "w-6 h-6 mx-auto flex items-center justify-center rounded-md transition-all hover:scale-110 active:scale-95",
                assignment?.vehicle_type ? "ring-1 ring-offset-1" : "",
                effVt === "truck" ? "ring-slate-400" : "ring-rose-400"
              )}
            >
              {effVt === "truck"
                ? <Truck className="h-4 w-4 text-slate-400 drop-shadow-sm" />
                : <Heart className="h-4 w-4 text-rose-400 drop-shadow-sm" />}
            </button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">
            {effVt === "truck" ? "Vrachtwagen" : "Koerier (Medisch)"} — klik om te wisselen
            {assignment?.vehicle_type && <span className="block opacity-60">Override actief (orig: {c.vehicleType})</span>}
          </TooltipContent>
        </Tooltip>
      </td>
      
      <td className="px-2 py-2 text-right font-medium text-[13px] text-slate-700 align-middle">
        {c.perWeek >= 1 ? c.perWeek.toFixed(1) : <span className="opacity-60 text-xs">~1x p/m</span>}
      </td>
      
      <td className="px-2 py-2 text-center hidden sm:table-cell align-middle">
        {isSaving ? (
          <div className="h-4 w-4 rounded-full border-2 border-primary border-r-transparent animate-spin mx-auto" />
        ) : (
          <div className="relative mx-auto w-fit transition-opacity opacity-70 hover:opacity-100 focus-within:opacity-100">
            <select
              className={cn(
                "h-7 w-20 text-[11px] font-medium rounded-md border appearance-none px-2 focus:outline-none focus:ring-1 focus:ring-primary/50 transition-all cursor-pointer",
                assignedDay ? "bg-white border-slate-300 text-slate-800 shadow-sm" : "bg-transparent border-transparent text-slate-400 hover:bg-slate-50",
                assignedDay && !matchesPref ? "border-amber-300 text-amber-700 bg-amber-50" : ""
              )}
              value={assignedDay?.toString() ?? ""}
              onChange={e => updateAssignment(c, { preferred_day: e.target.value ? Number(e.target.value) : null })}
            >
              <option value="">(geen)</option>
              {WEEKDAYS.map(d => (
                <option key={d} value={d}>{DAY_LABELS[d]}</option>
              ))}
            </select>
            <ChevronDown className="h-3 w-3 text-slate-400 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        )}
      </td>
      
      {/* Shortened rendering of the Day bubbles to reduce visual noise */}
      {WEEKDAYS.map(d => {
        const share = c.totalDeliveries > 0 ? c.dowCounts[d] / c.totalDeliveries : 0;
        const count = c.dowCounts[d];
        const isPref = c.preferredDays.includes(d);
        const isAssigned = assignedDay === d;
        
        let visualStyle = "bg-transparent text-transparent hover:bg-slate-100/50 hover:text-slate-400";
        if (count > 0) {
            visualStyle = share > 0.5 ? "bg-primary/20 text-primary font-medium" : "bg-primary/5 text-primary/60";
        }

        if (isAssigned) {
          visualStyle = "bg-primary text-white shadow-sm font-bold scale-110";
        } else if (isPref && count > 0) {
          visualStyle += " border-b-2 border-primary/40"; // subtle preference underline instead of dashed border
        }

        return (
          <td key={d} className="px-0 py-2 text-center hidden sm:table-cell align-middle">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => updateAssignment(c, { preferred_day: isAssigned ? null : d })}
                  className={cn(
                    "w-6 h-6 mx-auto flex items-center justify-center text-[10px] rounded-md transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                    visualStyle,
                    count === 0 && !isAssigned && "opacity-20 group-hover:opacity-60 hover:bg-slate-100"
                  )}
                >
                  {isAssigned ? "✓" : count > 0 ? count : "+"}
                </button>
              </TooltipTrigger>
              <TooltipContent className="text-xs bg-slate-800 text-white border-none shadow-xl" sideOffset={4}>
                <span className="font-bold text-white">{DAY_FULL[d]}</span>: {count} leveringen in verleden
                {isPref && <span className="block text-amber-300 mt-0.5">⭐ Sterke historische voorkeur</span>}
                <div className="mt-1 pt-1 border-t border-white/20 text-[10px] text-slate-300">Klik om {isAssigned ? 'vrij te maken' : 'in te plannen'}</div>
              </TooltipContent>
            </Tooltip>
          </td>
        );
      })}

      <td className="px-2 py-2 text-center align-middle">
          <DropdownMenu>
            <DropdownMenuTrigger className="h-7 w-7 rounded-md mx-auto flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-800 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-primary z-10 relative">
              <MoreHorizontal className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 shadow-lg border-slate-200 rounded-xl">
              <DropdownMenuItem onClick={() => updateAssignment(c, { active: !isActive })} className="cursor-pointer">
                {isActive ? <PowerOff className="mr-2 h-4 w-4 text-slate-400" /> : <Power className="mr-2 h-4 w-4 text-emerald-500" />}
                <span className={isActive ? "" : "font-medium text-emerald-700"}>{isActive ? "Markeer inactief" : "Markeer actief"}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => updateAssignment(c, { urgent: !isUrgent })} className="cursor-pointer">
                <AlertCircle className={cn("mr-2 h-4 w-4", isUrgent ? "text-slate-400" : "text-red-500")} />
                <span className={isUrgent ? "" : "font-medium text-red-700"}>{isUrgent ? "Verwijder urgentie" : "Markeer als urgent"}</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-100" />
              <DropdownMenuItem onClick={() => setDetailCustomer(c)} className="cursor-pointer">
                <Info className="mr-2 h-4 w-4 text-blue-500" /> <span className="font-medium">Klant details...</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
      </td>
    </tr>
  );
}

export const CustomerRow = memo(CustomerRowComponent, (prev, next) => {
  return (
    prev.c.key === next.c.key &&
    prev.assignment?.preferred_day === next.assignment?.preferred_day &&
    prev.assignment?.active === next.assignment?.active &&
    prev.assignment?.urgent === next.assignment?.urgent &&
    prev.assignment?.vehicle_type === next.assignment?.vehicle_type &&
    prev.assignment?.depot_override === next.assignment?.depot_override &&
    prev.isSaving === next.isSaving &&
    prev.bulkSelected === next.bulkSelected &&
    prev.zoneColor.row === next.zoneColor.row
    // updateAssignment, setDetailCustomer, toggleSelection should be stable referentially
  );
});
