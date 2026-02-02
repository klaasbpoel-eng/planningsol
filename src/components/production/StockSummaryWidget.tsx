import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  { subCode: "250049", description: "Lucht Inhalatie (tech) (50L)", averageConsumption: 11, numberOnStock: 3, difference: -8 },
  { subCode: "201112", description: "Zuurstof Medicinaal Gasv. SOL act. geint. 300bar (1L)", averageConsumption: 5, numberOnStock: 1, difference: -4 },
  { subCode: "201107", description: "Zuurstof Medicinaal Gasv. SOL P.I. (1L)", averageConsumption: 5, numberOnStock: 3, difference: -2 },
  { subCode: "205408", description: "Kooldioxide E.P. Alu P.I. (5L)", averageConsumption: 2, numberOnStock: 1, difference: -1 },
  { subCode: "210050", description: "Lucht (10L)", averageConsumption: 2, numberOnStock: 1, difference: -1 },
  { subCode: "250045", description: "Lucht Synth. Medicinaal Gasv. SOL (50L)", averageConsumption: 3, numberOnStock: 2, difference: -1 },
  { subCode: "202507", description: "Distikstofoxide Medicinaal SOL P.I. (2L)", averageConsumption: 2, numberOnStock: 2, difference: 0 },
  { subCode: "205407", description: "Kooldioxide E.P. P.I. (5L)", averageConsumption: 3, numberOnStock: 3, difference: 0 },
  { subCode: "270382", description: "Pakket AliSOL Stikstof (16x50L)", averageConsumption: 1, numberOnStock: 1, difference: 0 },
  { subCode: "270840", description: "Pakket Helium 5.0 (16x50L)", averageConsumption: 1, numberOnStock: 1, difference: 0 },
  { subCode: "250700", description: "Acetyleen (50L)", averageConsumption: 2, numberOnStock: 3, difference: 1 },
  { subCode: "250288", description: "12% O2 in N2 (50L)", averageConsumption: 3, numberOnStock: 5, difference: 2 },
  { subCode: "250370", description: "Argon 5.0 300bar (50L)", averageConsumption: 7, numberOnStock: 10, difference: 3 },
  { subCode: "250383", description: "AliSOL 028 (50L)", averageConsumption: 8, numberOnStock: 13, difference: 5 },
  { subCode: "250350", description: "Argon 5.0 (50L)", averageConsumption: 1, numberOnStock: 17, difference: 16 },
];

interface StatusConfig {
  status: StockStatus;
  count: number;
  label: string;
  fullLabel: string;
  icon: typeof ShieldAlert;
  color: string;
  bgColor: string;
  items: StockItem[];
}

export function StockSummaryWidget({ refreshKey, isRefreshing, className }: StockSummaryWidgetProps) {
  const [stockData, setStockData] = useState<StockItem[]>(mockStockData);

  // Group items by status
  const statusConfigs = useMemo(() => {
    const grouped: Record<StockStatus, StockItem[]> = {
      critical: [],
      low: [],
      ok: [],
      surplus: [],
    };

    stockData.forEach((item) => {
      const status = getStockStatus(item.difference);
      grouped[status].push(item);
    });

    return [
      {
        status: "critical" as StockStatus,
        count: grouped.critical.length,
        label: "Kritiek",
        fullLabel: "Kritieke voorraad",
        icon: ShieldAlert,
        color: "text-red-500",
        bgColor: "bg-red-500/10",
        items: grouped.critical,
      },
      {
        status: "low" as StockStatus,
        count: grouped.low.length,
        label: "Laag",
        fullLabel: "Lage voorraad",
        icon: AlertTriangle,
        color: "text-orange-500",
        bgColor: "bg-orange-500/10",
        items: grouped.low,
      },
      {
        status: "ok" as StockStatus,
        count: grouped.ok.length,
        label: "Goed",
        fullLabel: "Op voorraad",
        icon: CheckCircle,
        color: "text-green-500",
        bgColor: "bg-green-500/10",
        items: grouped.ok,
      },
      {
        status: "surplus" as StockStatus,
        count: grouped.surplus.length,
        label: "Over",
        fullLabel: "Overschot",
        icon: TrendingUp,
        color: "text-cyan-500",
        bgColor: "bg-cyan-500/10",
        items: grouped.surplus,
      },
    ];
  }, [stockData, refreshKey]);

  // Determine overall status for the header
  const overallStatus = statusConfigs.find((s) => s.status === "critical" && s.count > 0)
    ? "critical"
    : statusConfigs.find((s) => s.status === "low" && s.count > 0)
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
          {statusConfigs.map((config) => {
            const Icon = config.icon;
            return (
              <HoverCard key={config.status} openDelay={200} closeDelay={100}>
                <HoverCardTrigger asChild>
                  <div
                    className={cn(
                      "flex flex-col items-center p-1 rounded cursor-pointer transition-all hover:scale-105",
                      config.bgColor
                    )}
                  >
                    <Icon className={cn("h-3 w-3", config.color)} />
                    <span className={cn("text-sm font-bold", config.color)}>{config.count}</span>
                    <span className="text-[9px] text-muted-foreground">{config.label}</span>
                  </div>
                </HoverCardTrigger>
                <HoverCardContent className="w-72 p-0" side="top" align="center">
                  <div className={cn("px-3 py-2 border-b", config.bgColor)}>
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", config.color)} />
                      <span className={cn("font-semibold text-sm", config.color)}>
                        {config.fullLabel}
                      </span>
                      <span className="ml-auto text-xs text-muted-foreground">
                        {config.count} items
                      </span>
                    </div>
                  </div>
                  {config.items.length > 0 ? (
                    <ScrollArea className="max-h-48">
                      <div className="p-2 space-y-1">
                        {config.items.map((item) => (
                          <div
                            key={item.subCode}
                            className="flex items-center justify-between p-2 rounded bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate">
                                {item.description}
                              </div>
                              <div className="text-[10px] text-muted-foreground">
                                Code: {item.subCode}
                              </div>
                            </div>
                            <div className="text-right ml-2 flex-shrink-0">
                              <div className="text-xs font-semibold">
                                {item.numberOnStock} op voorraad
                              </div>
                              <div className={cn(
                                "text-[10px] font-medium",
                                item.difference < 0 ? "text-red-500" : "text-green-500"
                              )}>
                                {item.difference > 0 ? "+" : ""}{item.difference} verschil
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      Geen items in deze categorie
                    </div>
                  )}
                </HoverCardContent>
              </HoverCard>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
