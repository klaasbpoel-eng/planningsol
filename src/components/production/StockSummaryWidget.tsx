import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Package, ShieldAlert, AlertTriangle, CheckCircle, TrendingUp, Maximize2, Minimize2, Printer, MapPin, Search } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { getStockStatus, type StockStatus } from "./StockStatusBadge";
import { type StockItem } from "./StockExcelImportDialog";
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

// Fetch all rows from a table with pagination (same pattern as "Productie" in ProductionReports)
async function fetchAllRows(tableName: string): Promise<any[]> {
  const all: any[] = [];
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await (supabase.from(tableName as never) as any)
      .select("*")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error(`[fetchAllRows] Error fetching "${tableName}":`, error);
      throw new Error(`${tableName}: ${error.message}`);
    }
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  console.log(`[fetchAllRows] "${tableName}": ${all.length} rows`);
  return all;
}

export function StockSummaryWidget({ refreshKey, isRefreshing, className, selectedLocation = "all" }: StockSummaryWidgetProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [stockByLocation, setStockByLocation] = useState<Record<string, StockItem[]>>({
    sol_emmen: [],
    sol_tilburg: [],
  });
  const [isLoadingDB, setIsLoadingDB] = useState(true);
  const [dbError, setDbError] = useState<string | null>(null);
  const [locationManagerOpen, setLocationManagerOpen] = useState(false);
  const [fullscreenStatus, setFullscreenStatus] = useState<string | null>(null);
  const [dialogSearch, setDialogSearch] = useState("");
  const [userId, setUserId] = useState<string | undefined>();
  const { isAdmin } = useUserRole(userId);

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    getUser();
  }, []);

  // Fetch live data directly from "Voorraad" and "Afname" tables (capital V/A = ERP tables)
  const fetchStockFromDB = useCallback(async () => {
    setIsLoadingDB(true);
    setDbError(null);
    try {
      // Actual live tables: "Voorraad" and "Afname" (capital letters)
      // Voorraad columns: CD_CONTENT_TYPE, ContentDescription, ContainerTypeDescr, Capacity, Aantal, DS_CENTER_DESCRIPTION
      // Afname columns: ContentDescription, ContainerTypeDescription, Capacity, Aantal, CenterDescription, Datum
      // JOIN key: ContentDescription (product name, present in both tables)
      const [voorraadRows, afnameRows] = await Promise.all([
        fetchAllRows("Voorraad"),
        fetchAllRows("Afname"),
      ]);

      // Aggregate Voorraad by ContentDescription + locatie → sum Aantal
      const voorraadMap = new Map<string, { subCode: string; description: string; locatie: string; aantal: number }>();
      for (const row of voorraadRows) {
        const description: string = row.ContentDescription || row.CD_CONTENT_TYPE || "";
        if (!description) continue;
        const subCode: string = row.CD_CONTENT_TYPE || description;
        const center: string = row.DS_CENTER_DESCRIPTION || "";
        const locatie = center.toLowerCase().includes("emmen") ? "emmen" : "tilburg";
        const key = `${description}__${locatie}`;
        const existing = voorraadMap.get(key);
        if (existing) {
          existing.aantal += Number(row.Aantal) || 0;
        } else {
          voorraadMap.set(key, { subCode, description, locatie, aantal: Number(row.Aantal) || 0 });
        }
      }

      // Aggregate Afname by ContentDescription + locatie → sum Aantal
      const afnameMap = new Map<string, number>();
      for (const row of afnameRows) {
        const description: string = row.ContentDescription || "";
        if (!description) continue;
        const center: string = row.CenterDescription || "";
        const locatie = center.toLowerCase().includes("emmen") ? "emmen" : "tilburg";
        const key = `${description}__${locatie}`;
        afnameMap.set(key, (afnameMap.get(key) || 0) + (Number(row.Aantal) || 0));
      }

      // Build StockItem list per locatie
      const emmenItems: StockItem[] = [];
      const tilburgItems: StockItem[] = [];

      for (const [key, v] of voorraadMap.entries()) {
        const afname = afnameMap.get(key) || 0;
        const dailyAfname = afname > 0 ? afname / 90 : 0;
        const dekking = dailyAfname > 0 ? v.aantal / dailyAfname : v.aantal > 0 ? 999 : 0;

        const item: StockItem = {
          subCode: v.subCode,
          description: v.description,
          numberOnStock: v.aantal,
          numberEmpty: 0,
          averageConsumption: afname,
          difference: dekking,
        };

        if (v.locatie === "emmen") emmenItems.push(item);
        else tilburgItems.push(item);
      }

      setStockByLocation({ sol_emmen: emmenItems, sol_tilburg: tilburgItems });
    } catch (err) {
      console.error("Error fetching stock from DB:", err);
      setDbError(err instanceof Error ? err.message : String(err));
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
      const combined = new Map<string, StockItem>();
      for (const loc of ["sol_emmen", "sol_tilburg"]) {
        for (const item of stockByLocation[loc] || []) {
          if (combined.has(item.subCode)) {
            const existing = combined.get(item.subCode)!;
            const combinedVoorraad = existing.numberOnStock + item.numberOnStock;
            const combinedAfname = existing.averageConsumption + item.averageConsumption;
            const dailyAfname = combinedAfname > 0 ? combinedAfname / 90 : 0;
            const dekking = dailyAfname > 0 ? combinedVoorraad / dailyAfname : combinedVoorraad > 0 ? 999 : 0;
            combined.set(item.subCode, {
              ...existing,
              numberOnStock: combinedVoorraad,
              averageConsumption: combinedAfname,
              difference: dekking,
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
  }, [stockData]);

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
          </span>
        </CardDescription>
      </CardHeader>

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
                <Dialog key={config.status} onOpenChange={() => setDialogSearch("")}>
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
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Zoek op omschrijving of code..."
                        value={dialogSearch}
                        onChange={(e) => setDialogSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {config.items.length > 0 ? (
                      <ScrollArea className={fullscreenStatus === config.status ? "max-h-[60vh]" : "h-[calc(95vh-140px)]"}>
                        <div className="space-y-2">
                          {config.items.filter((item) => {
                            if (!dialogSearch) return true;
                            const q = dialogSearch.toLowerCase();
                            return item.description.toLowerCase().includes(q) || item.subCode.toLowerCase().includes(q);
                          }).sort((a, b) => a.difference - b.difference).map((item) => (
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
                                  <span className="font-semibold w-12 text-right text-green-600 dark:text-green-400">{formatNumber(item.numberOnStock, 0)}</span>
                                </div>
                                <div className="flex items-center justify-end gap-2 text-xs">
                                  <span className="text-muted-foreground">P90 afname:</span>
                                  <span className="font-semibold w-12 text-right">{formatNumber(item.averageConsumption, 0)}</span>
                                </div>
                                <div className={cn(
                                  "flex items-center justify-end gap-2 text-xs font-semibold",
                                  item.difference < 3 ? "text-red-500" : item.difference < 7 ? "text-orange-500" : item.difference <= 30 ? "text-green-500" : "text-cyan-500"
                                )}>
                                  <span>Dekking:</span>
                                  <span className="w-16 text-right">
                                    {item.difference >= 999 ? "∞" : `${formatNumber(item.difference, 1)} dgn`}
                                  </span>
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
        locationLabel={selectedLocation === "sol_tilburg" ? "SOL Tilburg" : selectedLocation === "sol_emmen" ? "SOL Emmen" : "Alle locaties"}
      />
    </div>
    </>
  );
}
