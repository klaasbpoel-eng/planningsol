import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { CalendarIcon, Filter, X, ChevronDown, User, Clock, CheckCircle, XCircle, CalendarDays } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
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

interface FilterChip {
  key: string;
  label: string;
  color?: string;
  onRemove: () => void;
}

const statusConfig = {
  pending: { label: "In behandeling", color: "bg-warning", icon: Clock },
  approved: { label: "Goedgekeurd", color: "bg-success", icon: CheckCircle },
  rejected: { label: "Afgewezen", color: "bg-destructive", icon: XCircle },
};

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function AdminFilters({ employees, filters, onFiltersChange }: AdminFiltersProps) {
  const [isOpen, setIsOpen] = useState(true);

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

  const setDatePreset = (preset: "today" | "week" | "month") => {
    const today = new Date();
    let start: Date;
    let end: Date;

    switch (preset) {
      case "today":
        start = startOfDay(today);
        end = endOfDay(today);
        break;
      case "week":
        start = startOfWeek(today, { weekStartsOn: 1 });
        end = endOfWeek(today, { weekStartsOn: 1 });
        break;
      case "month":
        start = startOfMonth(today);
        end = endOfMonth(today);
        break;
    }

    onFiltersChange({ ...filters, startDate: start, endDate: end });
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

  // Build filter chips
  const filterChips: FilterChip[] = [];

  if (filters.employeeId) {
    const employee = employees.find((e) => e.id === filters.employeeId);
    filterChips.push({
      key: "employee",
      label: employee?.full_name || employee?.email || "Medewerker",
      onRemove: () => updateFilter("employeeId", null),
    });
  }

  if (filters.status !== "all") {
    const config = statusConfig[filters.status];
    filterChips.push({
      key: "status",
      label: config.label,
      color: config.color,
      onRemove: () => updateFilter("status", "all"),
    });
  }

  if (filters.startDate || filters.endDate) {
    let dateLabel = "";
    if (filters.startDate && filters.endDate) {
      dateLabel = `${format(filters.startDate, "d MMM", { locale: nl })} - ${format(filters.endDate, "d MMM", { locale: nl })}`;
    } else if (filters.startDate) {
      dateLabel = `Vanaf ${format(filters.startDate, "d MMM", { locale: nl })}`;
    } else if (filters.endDate) {
      dateLabel = `Tot ${format(filters.endDate, "d MMM", { locale: nl })}`;
    }
    filterChips.push({
      key: "date",
      label: dateLabel,
      onRemove: () => {
        onFiltersChange({ ...filters, startDate: undefined, endDate: undefined });
      },
    });
  }

  const selectedEmployee = employees.find((e) => e.id === filters.employeeId);

  return (
    <div className="glass-card rounded-2xl overflow-hidden mb-6">
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-primary via-primary/60 to-accent/40" />

      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        {/* Header - Always visible */}
        <div className="px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 hover-lift px-2"
                >
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <Filter className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium">Filters</span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  </motion.div>
                </Button>
              </CollapsibleTrigger>

              {activeFilterCount > 0 && (
                <motion.span
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="inline-flex items-center justify-center h-6 min-w-6 px-2 rounded-full bg-primary text-primary-foreground text-xs font-semibold"
                >
                  {activeFilterCount}
                </motion.span>
              )}

              {/* Show filter chips in header when collapsed */}
              <AnimatePresence>
                {!isOpen && filterChips.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="flex flex-wrap gap-2"
                  >
                    {filterChips.map((chip) => (
                      <motion.span
                        key={chip.key}
                        layout
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium"
                      >
                        {chip.color && (
                          <span className={cn("w-2 h-2 rounded-full", chip.color)} />
                        )}
                        {chip.label}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            chip.onRemove();
                          }}
                          className="hover:bg-muted rounded-full p-0.5 transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </motion.span>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground gap-1.5"
              >
                <X className="h-4 w-4" />
                <span className="hidden sm:inline">Alles wissen</span>
              </Button>
            )}
          </div>
        </div>

        {/* Collapsible content */}
        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="px-4 pb-4 sm:px-6 sm:pb-6 space-y-4"
          >
            {/* Date Presets */}
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5 mr-2">
                <CalendarDays className="h-3.5 w-3.5" />
                Snel kiezen:
              </span>
              {[
                { key: "today" as const, label: "Vandaag" },
                { key: "week" as const, label: "Deze week" },
                { key: "month" as const, label: "Deze maand" },
              ].map((preset) => (
                <Button
                  key={preset.key}
                  variant="outline"
                  size="sm"
                  onClick={() => setDatePreset(preset.key)}
                  className="h-7 text-xs hover-lift"
                >
                  {preset.label}
                </Button>
              ))}
            </div>

            {/* Filters Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Employee Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  Medewerker
                </label>
                <Select
                  value={filters.employeeId || "all"}
                  onValueChange={(value) => updateFilter("employeeId", value === "all" ? null : value)}
                >
                  <SelectTrigger className="h-10 bg-background/50 hover:bg-background transition-colors">
                    <SelectValue>
                      {selectedEmployee ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getInitials(selectedEmployee.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="truncate">{selectedEmployee.full_name || selectedEmployee.email}</span>
                        </div>
                      ) : (
                        "Alle medewerkers"
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all">Alle medewerkers</SelectItem>
                    {employees.map((emp) => (
                      <SelectItem key={emp.id} value={emp.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                              {getInitials(emp.full_name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{emp.full_name || emp.email || "Onbekend"}</span>
                          {!emp.user_id && (
                            <span className="text-xs text-muted-foreground">(geen account)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CheckCircle className="h-3.5 w-3.5" />
                  Status
                </label>
                <Select
                  value={filters.status}
                  onValueChange={(value) => updateFilter("status", value as RequestStatus | "all")}
                >
                  <SelectTrigger className="h-10 bg-background/50 hover:bg-background transition-colors">
                    <SelectValue placeholder="Alle statussen" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all">Alle statussen</SelectItem>
                    {(Object.keys(statusConfig) as RequestStatus[]).map((status) => {
                      const config = statusConfig[status];
                      const Icon = config.icon;
                      return (
                        <SelectItem key={status} value={status}>
                          <div className="flex items-center gap-2">
                            <span className={cn("w-2 h-2 rounded-full", config.color)} />
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            {config.label}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* Start Date Filter */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Van datum
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-10 justify-start text-left font-normal bg-background/50 hover:bg-background transition-colors",
                        !filters.startDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.startDate ? format(filters.startDate, "d MMM yyyy", { locale: nl }) : "Elke startdatum"}
                      {filters.startDate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateFilter("startDate", undefined);
                          }}
                          className="ml-auto hover:bg-muted rounded-full p-0.5"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
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
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                  <CalendarIcon className="h-3.5 w-3.5" />
                  Tot datum
                </label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full h-10 justify-start text-left font-normal bg-background/50 hover:bg-background transition-colors",
                        !filters.endDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.endDate ? format(filters.endDate, "d MMM yyyy", { locale: nl }) : "Elke einddatum"}
                      {filters.endDate && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            updateFilter("endDate", undefined);
                          }}
                          className="ml-auto hover:bg-muted rounded-full p-0.5"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.endDate}
                      onSelect={(date) => updateFilter("endDate", date)}
                      disabled={(date) => (filters.startDate ? date < filters.startDate : false)}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Active Filters Bar */}
            <AnimatePresence>
              {filterChips.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/50"
                >
                  <span className="text-xs text-muted-foreground">Actieve filters:</span>
                  {filterChips.map((chip) => (
                    <motion.span
                      key={chip.key}
                      layout
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.8 }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover-lift"
                    >
                      {chip.color && (
                        <span className={cn("w-2 h-2 rounded-full", chip.color)} />
                      )}
                      {chip.label}
                      <button
                        onClick={chip.onRemove}
                        className="hover:bg-primary/20 rounded-full p-0.5 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </motion.span>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
