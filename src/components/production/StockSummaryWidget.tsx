import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ShieldAlert, AlertTriangle, CheckCircle, TrendingUp, Upload, Maximize2, Minimize2, Printer, MapPin, FileSpreadsheet } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { getStockStatus, type StockStatus } from "./StockStatusBadge";
import { StockExcelImportDialog, type StockItem } from "./StockExcelImportDialog";
import { SOLInventoryImportDialog } from "./SOLInventoryImportDialog";
import { supabase } from "@/integrations/supabase/client";
import { useUserRole } from "@/hooks/useUserRole";
import { StockPrintView } from "./StockPrintView";
import { StockFillingLocationManager } from "./StockFillingLocationManager";
import { useRef, useCallback } from "react";

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface StockSummaryWidgetProps {
  refreshKey?: number;
  isRefreshing?: boolean;
  className?: string;
  selectedLocation?: ProductionLocation;
}


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

export function StockSummaryWidget({ refreshKey, isRefreshing, className, selectedLocation = "all" }: StockSummaryWidgetProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [stockByLocation, setStockByLocation] = useState<Record<string, StockItem[]>>({
    sol_emmen: [],
    sol_tilburg: [],
  });
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [solImportDialogOpen, setSolImportDialogOpen] = useState(false);
  const [locationManagerOpen, setLocationManagerOpen] = useState(false);
  const [fullscreenStatus, setFullscreenStatus] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | undefined>();
  const { isAdmin } = useUserRole(userId);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  // Fetch stock data from voorraad + afname tables
  const fetchStockFromDB = useCallback(async () => {
    setIsLoadingDB(true);
    setDbError(null);
    try {
      // Use RPC functions (server-side GROUP BY, no pagination needed)
      const [{ data: voorraadRows, error: vErr }, { data: afnameRows, error: afErr }] = await Promise.all([
        (supabase as any).rpc("get_voorraad_summary"),
        (supabase as any).rpc("get_afname_summary"),
      ]);
      if (vErr) setDbError(`voorraad: ${vErr.message || vErr.code}`);
      if (afErr) setDbError((prev) => prev ? `${prev} | afname: ${afErr.message || afErr.code}` : `afname: ${afErr.message || afErr.code}`);

      // Normalize center name to "emmen" or "tilburg" for robust matching
      const normalizeCenter = (center: string): "emmen" | "tilburg" =>
        center?.toLowerCase().includes("emmen") ? "emmen" : "tilburg";

      // Build stockCount map from voorraad summary (already aggregated by DB)
      const stockCount = new Map<string, number>();
      for (const row of (voorraadRows || [])) {
        const key = `${row.subcode}||${normalizeCenter(row.center)}`;
        stockCount.set(key, Number(row.count));
      }

      // Build StockItems from afname summary
      const emmenItems: StockItem[] = [];
      const tilburgItems: StockItem[] = [];
      for (const row of (afnameRows || [])) {
        const centerNorm = normalizeCenter(row.center);
        const key = `${row.subcode}||${centerNorm}`;
        const numberOnStock = stockCount.get(key) || 0;
        const averageConsumption = Number(row.total_aantal) || 0;
        const item: StockItem = {
          subCode: row.subcode,
          description: row.description,
          numberOnStock,
          averageConsumption,
          difference: numberOnStock - averageConsumption,
        };
        if (centerNorm === "emmen") {
          emmenItems.push(item);
        } else {
          tilburgItems.push(item);
        }
      }

      console.log(`Stock loaded: ${emmenItems.length} Emmen, ${tilburgItems.length} Tilburg items`);
      setStockByLocation({ sol_emmen: emmenItems, sol_tilburg: tilburgItems });
    } catch (err) {
      console.error("Error fetching stock from DB:", err);
    } finally {
      setIsLoadingDB(false);
    }
  }, []);

  useEffect(() => {
    fetchStockFromDB();
  }, [fetchStockFromDB, refreshKey]);

  // Determine which stock data to display based on selected location
  const stockData = useMemo(() => {
    if (selectedLocation === "all") {
      // Combine both locations, avoiding duplicates by subCode
      const combined = new Map<string, StockItem>();
      for (const loc of ["sol_emmen", "sol_tilburg"]) {
        for (const item of stockByLocation[loc] || []) {
          if (combined.has(item.subCode)) {
            const existing = combined.get(item.subCode)!;
            combined.set(item.subCode, {
              ...existing,
              averageConsumption: existing.averageConsumption + item.averageConsumption,
              numberOnStock: existing.numberOnStock + item.numberOnStock,
              difference: (existing.numberOnStock + item.numberOnStock) - (existing.averageConsumption + item.averageConsumption),
            });
          } else {
            combined.set(item.subCode, { ...item });
          }
        }
      }
      return Array.from(combined.values());
    }
    return stockByLocation[selectedLocation] || [];
  }, [stockByLocation, selectedLocation]);

  const handleImported = async (data: StockItem[]) => {
    const targetLocation = selectedLocation === "all" ? "sol_emmen" : selectedLocation;

    // Sync with stock_products table: look up filled_in_emmen and upsert new products
    try {
      const subCodes = data.map((d) => d.subCode);
      const { data: existing } = await supabase
        .from("stock_products")
        .select("sub_code, filled_in_emmen")
        .in("sub_code", subCodes);

      const existingMap = new Map<string, boolean>(
        (existing || []).map((e) => [e.sub_code, e.filled_in_emmen])
      );

      // Find new products to insert
      const newProducts = data
        .filter((d) => !existingMap.has(d.subCode))
        .map((d) => ({
          sub_code: d.subCode,
          description: d.description,
          filled_in_emmen: d.filledInEmmen ?? true,
        }));

      if (newProducts.length > 0) {
        await supabase.from("stock_products").upsert(newProducts, { onConflict: "sub_code" });
      }

      // Override filledInEmmen from database for known products
      const enrichedData = data.map((d) => ({
        ...d,
        filledInEmmen: existingMap.has(d.subCode) ? existingMap.get(d.subCode)! : (d.filledInEmmen ?? true),
      }));

      setStockByLocation((prev) => ({
        ...prev,
        [targetLocation]: enrichedData,
      }));
    } catch (err) {
      console.error("Error syncing stock_products:", err);
      // Fallback: use data as-is
      setStockByLocation((prev) => ({
        ...prev,
        [targetLocation]: data,
      }));
    }
  };

  const importLocationLabel = selectedLocation === "sol_tilburg" ? "SOL Tilburg" 
    : selectedLocation === "sol_emmen" ? "SOL Emmen" 
    : "SOL Emmen";

  const handlePrint = useCallback(() => {
    window.print();
  }, []);

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
      : stockData.length === 0
        ? "empty"
        : "ok";

  const overallColor =
    overallStatus === "critical"
      ? "text-red-500"
      : overallStatus === "low"
        ? "text-orange-500"
        : overallStatus === "empty"
          ? "text-muted-foreground"
          : "text-green-500";

  const overallLabel =
    overallStatus === "critical"
      ? "Actie vereist"
      : overallStatus === "low"
        ? "Aandacht"
        : overallStatus === "empty"
          ? "Geen data"
          : "Op voorraad";

  return (
    <>
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
            {selectedLocation !== "all" && (
              <Badge variant="outline" className="text-[10px] py-0 px-1">
                {selectedLocation === "sol_emmen" ? "Emmen" : "Tilburg"}
              </Badge>
            )}
          </span>
          <span className="flex items-center gap-0.5">
            {stockData.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handlePrint}
                title="Voorraadoverzicht printen"
              >
                <Printer className="h-3.5 w-3.5" />
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setLocationManagerOpen(true)}
                title="Vullocaties beheren"
              >
                <MapPin className="h-3.5 w-3.5" />
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setImportDialogOpen(true)}
                title={`Excel importeren voor ${importLocationLabel}`}
              >
                <Upload className="h-3.5 w-3.5" />
              </Button>
            )}
            {isAdmin && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={() => setSolImportDialogOpen(true)}
                title={`SOL inventaris importeren voor ${importLocationLabel}`}
              >
                <FileSpreadsheet className="h-3.5 w-3.5" />
              </Button>
            )}
          </span>
        </CardDescription>
      </CardHeader>

      <StockExcelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImported={handleImported}
        locationLabel={importLocationLabel}
      />
      <SOLInventoryImportDialog
        open={solImportDialogOpen}
        onOpenChange={setSolImportDialogOpen}
        onImported={handleImported}
        locationLabel={importLocationLabel}
        targetLocation={selectedLocation === "all" ? "sol_emmen" : selectedLocation}
      />
      <StockFillingLocationManager
        open={locationManagerOpen}
        onOpenChange={setLocationManagerOpen}
      />
      <CardContent>
        <div className={cn("text-2xl font-bold mb-2", overallColor)}>{overallLabel}</div>
        {stockData.length === 0 ? (
          <div className="text-xs text-muted-foreground text-center py-2">
            {isLoadingDB ? "Voorraaddata laden..." : dbError ? (
              <span className="text-red-500 break-all">{dbError}</span>
            ) : "Geen voorraaddata beschikbaar"}
          </div>
        ) : (
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
                  <DialogContent className={cn(
                    "transition-all duration-200",
                    fullscreenStatus === config.status
                      ? "max-w-lg"
                      : "max-w-[95vw] w-[95vw] max-h-[95vh] h-[95vh]"
                  )}>
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <Icon className={cn("h-5 w-5", config.color)} />
                        <span className={config.color}>{config.fullLabel}</span>
                        {selectedLocation !== "all" && (
                          <Badge variant="outline" className="text-xs">
                            {selectedLocation === "sol_emmen" ? "Emmen" : "Tilburg"}
                          </Badge>
                        )}
                        <span className="ml-auto flex items-center gap-1 text-sm font-normal text-muted-foreground">
                          {formatNumber(config.count, 0)} items
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 mr-6"
                            onClick={() => setFullscreenStatus(
                              fullscreenStatus === config.status ? null : config.status
                            )}
                            title={fullscreenStatus === config.status ? "Volledig scherm" : "Compact weergave"}
                          >
                            {fullscreenStatus === config.status
                              ? <Maximize2 className="h-4 w-4" />
                              : <Minimize2 className="h-4 w-4" />
                            }
                          </Button>
                        </span>
                      </DialogTitle>
                    </DialogHeader>
                    {config.items.length > 0 ? (
                      <ScrollArea className={fullscreenStatus === config.status ? "max-h-[60vh]" : "h-[calc(95vh-80px)]"}>
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
        )}
      </CardContent>
    </Card>

    {/* Hidden print view - visible only when printing */}
    <div className="stock-print-container">
      <StockPrintView
        ref={printRef}
        stockData={stockData}
        locationLabel={importLocationLabel}
      />
    </div>
    </>
  );
}
