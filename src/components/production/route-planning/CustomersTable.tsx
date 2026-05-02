import React, { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Power, PowerOff, AlertCircle, TrendingDown, Truck, Heart, ChevronDown, ChevronRight, Info, MoreHorizontal } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CustomerSummary, DayAssignment, Depot } from "./types";
import { effectiveVehicleType, ZONE_COLORS, DAY_LABELS, WEEKDAYS, DAY_FULL } from "./utils";
import { CustomerRow } from "./CustomerRow";

interface CustomersTableProps {
  customers: CustomerSummary[];
  dayAssignments: Map<string, DayAssignment>;
  savingKey: string | null;
  bulkSelected: Set<string>;
  setBulkSelected: React.Dispatch<React.SetStateAction<Set<string>>>;
  updateAssignment: (c: CustomerSummary, updates: Partial<DayAssignment>) => Promise<void>;
  setDetailCustomer: (c: CustomerSummary) => void;
  zoneColor: { badge: string; row: string; stroke: string };
}

export function CustomersTable({
  customers,
  dayAssignments,
  savingKey,
  bulkSelected,
  setBulkSelected,
  updateAssignment,
  setDetailCustomer,
  zoneColor,
}: CustomersTableProps) {
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: customers.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 48, // Slightly taller rows for premium feel
    overscan: 10,
  });

  const toggleSelection = React.useCallback((key: string, selected: boolean) => {
    setBulkSelected(prev => {
      const next = new Set(prev);
      selected ? next.add(key) : next.delete(key);
      return next;
    });
  }, [setBulkSelected]);

  if (customers.length === 0) return null;

  return (
    <div className="border bg-white rounded-b-xl shadow-sm border-t-0" ref={parentRef} style={{ maxHeight: '650px', overflowY: 'auto' }}>
      <table className="w-full text-sm" style={{ tableLayout: "fixed" }}>
        <colgroup>
          <col className="w-10" /> {/* Checkbox */}
          <col className="w-auto min-w-[160px]" /> {/* Klant */}
          <col className="w-[100px] hidden md:table-column" /> {/* Stad */}
          <col className="w-[60px] hidden lg:table-column" /> {/* Depot */}
          <col className="w-[50px]" /> {/* Type */}
          <col className="w-[60px]" /> {/* /week */}
          <col className="w-[90px] hidden sm:table-column" /> {/* Vaste dag */}
          {WEEKDAYS.map(d => <col key={d} className="w-[36px] hidden sm:table-column" />)} {/* MA-VR */}
          <col className="w-10" /> {/* Actions */}
        </colgroup>
        <thead className="bg-slate-50/80 backdrop-blur-md border-b text-[11px] font-bold uppercase tracking-wider text-slate-500 sticky top-0 z-10 transition-colors">
          <tr>
            <th className="px-2 py-3 text-center">
              <input
                type="checkbox"
                className="rounded border-slate-300 text-primary focus:ring-primary/20 transition-all cursor-pointer h-3.5 w-3.5"
                checked={customers.length > 0 && customers.every(c => bulkSelected.has(c.key))}
                onChange={e => setBulkSelected(prev => {
                  const next = new Set(prev);
                  customers.forEach(c => e.target.checked ? next.add(c.key) : next.delete(c.key));
                  return next;
                })}
              />
            </th>
            <th className="px-3 py-3 text-left">Klant</th>
            <th className="px-3 py-3 text-left hidden md:table-cell">Stad</th>
            <th className="px-1 py-3 text-center hidden lg:table-cell">Depot</th>
            <th className="px-1 py-3 text-center">Type</th>
            <th className="px-2 py-3 text-right">
              <Tooltip>
                <TooltipTrigger className="cursor-help border-b border-dashed border-slate-400">/week</TooltipTrigger>
                <TooltipContent className="text-xs">Gemiddeld aantal leveringen per week</TooltipContent>
              </Tooltip>
            </th>
            <th className="px-2 py-3 text-center hidden sm:table-cell">Vaste dag</th>
            {WEEKDAYS.map(d => (
              <th key={d} className="px-0 py-3 text-center hidden sm:table-cell">{DAY_LABELS[d]}</th>
            ))}
            <th className="px-2 py-3"></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rowVirtualizer.getVirtualItems().length > 0 && (
            <>
              {rowVirtualizer.getVirtualItems()[0].start > 0 && (
                <tr style={{ height: `${rowVirtualizer.getVirtualItems()[0].start}px` }}>
                  <td colSpan={13} className="p-0 border-0" />
                </tr>
              )}
              {rowVirtualizer.getVirtualItems().map(virtualRow => {
                const c = customers[virtualRow.index];
                const asg = dayAssignments.get(c.key);
                const isSaving = savingKey === c.key;
                
                return (
                  <CustomerRow
                    key={c.key}
                    c={c}
                    assignment={asg}
                    isSaving={isSaving}
                    bulkSelected={bulkSelected.has(c.key)}
                    zoneColor={zoneColor}
                    toggleSelection={toggleSelection}
                    updateAssignment={updateAssignment as any}
                    setDetailCustomer={setDetailCustomer}
                    measureRef={rowVirtualizer.measureElement}
                    dataIndex={virtualRow.index}
                  />
                );
              })}
              {rowVirtualizer.getVirtualItems().length > 0 && 
               rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end > 0 && (
                <tr style={{ height: `${rowVirtualizer.getTotalSize() - rowVirtualizer.getVirtualItems()[rowVirtualizer.getVirtualItems().length - 1].end}px` }}>
                  <td colSpan={13} className="p-0 border-0" />
                </tr>
              )}
            </>
          )}
        </tbody>
      </table>
    </div>
  );
}
