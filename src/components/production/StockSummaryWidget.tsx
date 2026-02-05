import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Package, ShieldAlert, AlertTriangle, CheckCircle, TrendingUp, Upload } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { getStockStatus, type StockStatus } from "./StockStatusBadge";
import { StockExcelImportDialog, type StockItem } from "./StockExcelImportDialog";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
// StockItem is imported from StockExcelImportDialog

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
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [userId, setUserId] = useState<string | undefined>();
  const { isAdmin } = useUserRole(userId);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  const handleImported = (data: StockItem[]) => {
    setStockData(data);
  };

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
        <CardDescription className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Package className="h-4 w-4 text-blue-500" />
            Voorraadstatus
          </span>
          {isAdmin && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setImportDialogOpen(true)}
              title="Excel importeren"
            >
              <Upload className="h-3.5 w-3.5" />
            </Button>
          )}
        </CardDescription>
      </CardHeader>

      <StockExcelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImported={handleImported}
      />
      <CardContent>
        <div className={cn("text-2xl font-bold mb-2", overallColor)}>{overallLabel}</div>
        <div className="grid grid-cols-4 gap-1">
          {statusConfigs.map((config) => {
            const Icon = config.icon;
            return (
              <Dialog key={config.status}>
                <DialogTrigger asChild>
                  <div
                    className={cn(
                      "flex flex-col items-center p-1 rounded cursor-pointer transition-all hover:scale-105",
                      config.bgColor
                    )}
                  >
                    <Icon className={cn("h-3 w-3", config.color)} />
                    <span className={cn("text-sm font-bold", config.color)}>{formatNumber(config.count, 0)}</span>
                    <span className="text-[9px] text-muted-foreground">{config.label}</span>
                  </div>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Icon className={cn("h-5 w-5", config.color)} />
                      <span className={config.color}>{config.fullLabel}</span>
                      <span className="ml-auto text-sm font-normal text-muted-foreground">
                        {formatNumber(config.count, 0)} items
                      </span>
                    </DialogTitle>
                  </DialogHeader>
                  {config.items.length > 0 ? (
                    <ScrollArea className="max-h-[60vh]">
                      <div className="space-y-2">
                        {config.items.map((item) => (
                          <div
                            key={item.subCode}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">
                                {item.description}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Code: {item.subCode}
                              </div>
                            </div>
                            <div className="text-right ml-3 flex-shrink-0 space-y-1">
                              <div className="flex items-center justify-end gap-2 text-xs">
                                <span className="text-muted-foreground">Voorraad:</span>
                                <span className="font-semibold w-8 text-right">{formatNumber(item.numberOnStock, 0)}</span>
                              </div>
                              <div className="flex items-center justify-end gap-2 text-xs">
                                <span className="text-muted-foreground">Gem. verbr:</span>
                                <span className="font-semibold w-8 text-right">{formatNumber(item.averageConsumption, 0)}</span>
                              </div>
                              <div className={cn(
                                "flex items-center justify-end gap-2 text-xs font-semibold",
                                item.difference < 0 ? "text-red-500" : item.difference > 0 ? "text-green-500" : "text-muted-foreground"
                              )}>
                                <span>Verschil:</span>
                                <span className="w-8 text-right">{item.difference > 0 ? "+" : ""}{formatNumber(item.difference, 0)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  ) : (
                    <div className="py-8 text-center text-sm text-muted-foreground">
                      Geen items in deze categorie
                    </div>
                  )}
                </DialogContent>
              </Dialog>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
