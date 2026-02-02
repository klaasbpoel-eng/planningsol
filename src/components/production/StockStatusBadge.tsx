import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, ShieldAlert, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

export type StockStatus = "critical" | "low" | "ok" | "surplus";

interface StockStatusBadgeProps {
  difference: number;
  showLabel?: boolean;
  compact?: boolean;
  className?: string;
}

export function getStockStatus(difference: number): StockStatus {
  if (difference <= -3) return "critical";
  if (difference <= 0) return "low";
  if (difference <= 5) return "ok";
  return "surplus";
}

export function getStockStatusConfig(status: StockStatus) {
  const configs = {
    critical: {
      label: "Kritiek",
      variant: "destructive" as const,
      icon: ShieldAlert,
      color: "text-red-500",
    },
    low: {
      label: "Lage voorraad",
      variant: "warning" as const,
      icon: AlertTriangle,
      color: "text-orange-500",
    },
    ok: {
      label: "Op voorraad",
      variant: "success" as const,
      icon: CheckCircle,
      color: "text-green-500",
    },
    surplus: {
      label: "Overschot",
      variant: "info" as const,
      icon: TrendingUp,
      color: "text-cyan-500",
    },
  };
  return configs[status];
}

export function StockStatusBadge({
  difference,
  showLabel = true,
  compact = false,
  className,
}: StockStatusBadgeProps) {
  const status = getStockStatus(difference);
  const config = getStockStatusConfig(status);
  const Icon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        compact && "px-1.5 py-0 text-[10px]",
        className
      )}
    >
      <Icon className={cn("mr-1", compact ? "h-3 w-3" : "h-3.5 w-3.5")} />
      {showLabel && config.label}
    </Badge>
  );
}
