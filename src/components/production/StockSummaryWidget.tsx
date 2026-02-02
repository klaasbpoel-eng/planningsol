import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Package, ShieldAlert, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { getStockStatus, type StockStatus } from "./StockStatusBadge";

interface StockItem {
  subCode: string;
  description: string;
  averageConsumption: number;
  numberOnStock: number;
  difference: number;
}

interface StockSummaryWidgetProps {
  refreshKey?: number;
  isRefreshing?: boolean;
  className?: string;
}

// Mock data based on Excel structure - can be replaced with database fetch
const mockStockData: StockItem[] = [
  { subCode: "250049", description: "Lucht Inhalatie (tech) (50L)", averageConsumption: 8, numberOnStock: 4, difference: -4 },
  { subCode: "201112", description: "CO2 4.5 (50L)", averageConsumption: 12, numberOnStock: 10, difference: -2 },
  { subCode: "201234", description: "Argon 5.0 (50L)", averageConsumption: 5, numberOnStock: 8, difference: 3 },
  { subCode: "201345", description: "Stikstof 5.0 (50L)", averageConsumption: 3, numberOnStock: 15, difference: 12 },
  { subCode: "201456", description: "Zuurstof Medicinaal (50L)", averageConsumption: 6, numberOnStock: 4, difference: -2 },
  { subCode: "201567", description: "Helium 5.0 (50L)", averageConsumption: 2, numberOnStock: 5, difference: 3 },
  { subCode: "201678", description: "Acetyleen (50L)", averageConsumption: 4, numberOnStock: 2, difference: -2 },
  { subCode: "201789", description: "Waterstof 5.0 (50L)", averageConsumption: 1, numberOnStock: 8, difference: 7 },
];

interface StatusCount {
  status: StockStatus;
  count: number;
  label: string;
  icon: typeof ShieldAlert;
  color: string;
  bgColor: string;
}

export function StockSummaryWidget({ refreshKey, isRefreshing, className }: StockSummaryWidgetProps) {
  const [stockData, setStockData] = useState<StockItem[]>(mockStockData);
  const [statusCounts, setStatusCounts] = useState<StatusCount[]>([]);

  useEffect(() => {
    // Calculate status counts from stock data
    const counts: Record<StockStatus, number> = {
      critical: 0,
      low: 0,
      ok: 0,
      surplus: 0,
    };

    stockData.forEach((item) => {
      const status = getStockStatus(item.difference);
      counts[status]++;
    });

    setStatusCounts([
      {
        status: "critical",
        count: counts.critical,
        label: "Kritiek",
        icon: ShieldAlert,
        color: "text-red-500",
        bgColor: "bg-red-500/10",
      },
      {
        status: "low",
        count: counts.low,
        label: "Laag",
        icon: AlertTriangle,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
      },
      {
        status: "ok",
        count: counts.ok,
        label: "Goed",
        icon: CheckCircle,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
      },
      {
        status: "surplus",
        count: counts.surplus,
        label: "Over",
        icon: TrendingUp,
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
      },
    ]);
  }, [stockData, refreshKey]);

  // Determine overall status for the header
  const overallStatus = statusCounts.find((s) => s.status === "critical" && s.count > 0)
    ? "critical"
    : statusCounts.find((s) => s.status === "low" && s.count > 0)
    ? "low"
    : "ok";

  const overallColor =
    overallStatus === "critical"
      ? "text-red-500"
      : overallStatus === "low"
      ? "text-orange-500"
      : "text-green-500";

  const overallLabel =
    overallStatus === "critical"
      ? "Actie vereist"
      : overallStatus === "low"
      ? "Aandacht"
      : "Op voorraad";

  return (
    <Card
      className={cn(
        "glass-card transition-all duration-300",
        isRefreshing && "animate-pulse ring-2 ring-primary/30",
        className
      )}
    >
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Package className="h-4 w-4 text-blue-500" />
          Voorraadstatus
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className={cn("text-2xl font-bold mb-2", overallColor)}>{overallLabel}</div>
        <div className="grid grid-cols-4 gap-1">
          {statusCounts.map((status) => {
            const Icon = status.icon;
            return (
              <div
                key={status.status}
                className={cn(
                  "flex flex-col items-center p-1 rounded",
                  status.bgColor
                )}
              >
                <Icon className={cn("h-3 w-3", status.color)} />
                <span className={cn("text-sm font-bold", status.color)}>{status.count}</span>
                <span className="text-[9px] text-muted-foreground">{status.label}</span>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
