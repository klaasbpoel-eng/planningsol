import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarIcon, Filter, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type RequestStatus = Database["public"]["Enums"]["request_status"];

export interface FilterState {
  employeeId: string | null;
  status: RequestStatus | "all";
  startDate: Date | undefined;
  endDate: Date | undefined;
}

interface AdminFiltersProps {
  employees: Profile[];
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
}

export function AdminFilters({ employees, filters, onFiltersChange }: AdminFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      employeeId: null,
      status: "all",
      startDate: undefined,
      endDate: undefined,
    });
  };

  const hasActiveFilters = 
    filters.employeeId !== null || 
    filters.status !== "all" || 
    filters.startDate !== undefined || 
    filters.endDate !== undefined;

  const activeFilterCount = [
    filters.employeeId !== null,
    filters.status !== "all",
    filters.startDate !== undefined || filters.endDate !== undefined,
  ].filter(Boolean).length;

  return (
    <Card className="shadow-md border-0 mb-6">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col gap-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filters</span>
              {activeFilterCount > 0 && (
                <span className="bg-accent text-accent-foreground text-xs px-2 py-0.5 rounded-full font-medium">
                  {activeFilterCount} actief
                </span>
              )}
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="h-8 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4 mr-1" />
                Alles wissen
              </Button>
            )}
          </div>

          {/* Filters Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Employee Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Medewerker</label>
              <Select
                value={filters.employeeId || "all"}
                onValueChange={(value) => updateFilter("employeeId", value === "all" ? null : value)}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Alle medewerkers" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Alle medewerkers</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.user_id} value={emp.user_id}>
                      {emp.full_name || emp.email || "Onbekend"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Status</label>
              <Select
                value={filters.status}
                onValueChange={(value) => updateFilter("status", value as RequestStatus | "all")}
              >
                <SelectTrigger className="h-10 bg-background">
                  <SelectValue placeholder="Alle statussen" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  <SelectItem value="all">Alle statussen</SelectItem>
                  <SelectItem value="pending">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-warning" />
                      In behandeling
                    </div>
                  </SelectItem>
                  <SelectItem value="approved">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-success" />
                      Goedgekeurd
                    </div>
                  </SelectItem>
                  <SelectItem value="rejected">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-destructive" />
                      Afgewezen
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Start Date Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Van datum</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-10 justify-start text-left font-normal bg-background",
                      !filters.startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.startDate ? format(filters.startDate, "d MMM yyyy") : "Elke startdatum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.startDate}
                    onSelect={(date) => updateFilter("startDate", date)}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* End Date Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Tot datum</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full h-10 justify-start text-left font-normal bg-background",
                      !filters.endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {filters.endDate ? format(filters.endDate, "d MMM yyyy") : "Elke einddatum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={filters.endDate}
                    onSelect={(date) => updateFilter("endDate", date)}
                    disabled={(date) => filters.startDate ? date < filters.startDate : false}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
