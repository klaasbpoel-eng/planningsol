import { Users, MapPin, Truck, Heart, Package } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { Depot, VehicleType } from "./types";

interface RouteStatsCardsProps {
  stats: {
    total: number;
    truck: number;
    courier: number;
    emmen: number;
    tilburg: number;
    zones: number;
  };
  loading: boolean;
}

export function RouteStatsCards({ stats, loading }: RouteStatsCardsProps) {
  const cards = [
    { label: "Klanten",       value: stats.total,   icon: <Users  className="h-4 w-4 text-primary" />,        color: "bg-primary/10" },
    { label: "Emmen",         value: stats.emmen,   icon: <MapPin className="h-4 w-4 text-blue-500" />,       color: "bg-blue-500/10" },
    { label: "Tilburg",       value: stats.tilburg, icon: <MapPin className="h-4 w-4 text-amber-500" />,      color: "bg-amber-500/10" },
    { label: "Vrachtwagen",   value: stats.truck,   icon: <Truck  className="h-4 w-4 text-slate-600" />,      color: "bg-slate-500/10" },
    { label: "Koerier (med.)",value: stats.courier, icon: <Heart  className="h-4 w-4 text-rose-500" />,       color: "bg-rose-500/10" },
    { label: "Zones",         value: stats.zones,   icon: <Package className="h-4 w-4 text-emerald-500" />,   color: "bg-emerald-500/10" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map(({ label, value, icon, color }) => (
        <div key={label} className="rounded-lg border bg-card p-3 flex items-center gap-3">
          <div className={cn("rounded-lg p-1.5", color)}>{icon}</div>
          <div>
            <div className="text-xl font-bold tabular-nums">
              {loading ? "—" : formatNumber(value, 0)}
            </div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
