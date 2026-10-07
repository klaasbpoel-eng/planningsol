import { Search, X, Truck, Heart, PowerOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Depot, VehicleType } from "./types";

interface RouteFiltersProps {
  search: string;
  setSearch: (v: string) => void;
  depotFilter: "all" | Depot;
  setDepotFilter: (v: "all" | Depot) => void;
  vehicleFilter: "all" | VehicleType;
  setVehicleFilter: (v: "all" | VehicleType) => void;
  zoneFilter: string;
  setZoneFilter: (v: string) => void;
  showInactive: boolean;
  setShowInactive: (v: boolean | ((prev: boolean) => boolean)) => void;
  zones: { short: string; full: string }[];
  hasFilters: boolean;
  onClear: () => void;
}

export function RouteFilters({
  search, setSearch,
  depotFilter, setDepotFilter,
  vehicleFilter, setVehicleFilter,
  zoneFilter, setZoneFilter,
  showInactive, setShowInactive,
  zones, hasFilters, onClear
}: RouteFiltersProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Zoek klant, stad of postcode..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-9 pr-8 h-10 text-sm"
        />
        {search && (
          <Button variant="ghost" size="icon" aria-label="Wis zoekterm" onClick={() => setSearch("")} className="absolute right-0 top-1/2 -translate-y-1/2 h-9 w-9 text-muted-foreground">
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex rounded-lg border bg-muted/40 p-0.5 gap-0.5">
        {(["all", "emmen", "tilburg"] as const).map(d => (
          <Button key={d} variant="ghost" onClick={() => setDepotFilter(d)}
            className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all h-9",
              depotFilter === d ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {d === "all" ? "Beide" : d === "emmen" ? "Emmen" : "Tilburg"}
          </Button>
        ))}
      </div>

      <div className="flex rounded-lg border bg-muted/40 p-0.5 gap-0.5">
        {(["all", "truck", "courier"] as const).map(v => (
          <Button key={v} variant="ghost" onClick={() => setVehicleFilter(v)}
            className={cn("px-3 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 h-9",
              vehicleFilter === v ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {v === "truck" ? <Truck className="h-3.5 w-3.5" /> : v === "courier" ? <Heart className="h-3.5 w-3.5" /> : null}
            {v === "all" ? "Alle types" : v === "truck" ? "Vrachtwagen" : "Koerier"}
          </Button>
        ))}
      </div>

      <Select value={zoneFilter} onValueChange={setZoneFilter}>
        <SelectTrigger className="h-10 w-full sm:w-[180px] font-medium" aria-label="Filter op zone">
          <SelectValue placeholder="Alle zones" />
        </SelectTrigger>
        <SelectContent>
        <SelectItem value="all">Alle zones</SelectItem>
        {zones.map(z => (
          <SelectItem key={z.short} value={z.short}>{z.full}</SelectItem>
        ))}
        </SelectContent>
      </Select>

      {/* Inactief toggle */}
      <Button
        variant="outline"
        onClick={() => setShowInactive(v => !v)}
        className={cn("h-10 gap-2", showInactive && "bg-primary/5 border-primary/30 text-primary")}
        title={showInactive ? "Inactieve klanten worden getoond" : "Inactieve klanten verborgen"}
      >
        <PowerOff className={cn("h-4 w-4", showInactive ? "text-primary" : "text-muted-foreground")} />
        {showInactive ? "Inactief zichtbaar" : "Inactief verborgen"}
      </Button>

      {hasFilters && (
        <Button variant="ghost" onClick={onClear} className="h-10 px-3 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted">
          <X className="h-4 w-4 mr-1.5" /> Wis
        </Button>
      )}
    </div>
  );
}
