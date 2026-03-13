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

  // Fetch stock data via Edge Function (bypasses PostgREST schema cache)
  const fetchStockFromDB = useCallback(async () => {
    setIsLoadingDB(true);
    setDbError(null);
    try {
      // Query Voorraad and Afname via supabase client (same project as stock_products)
      const [{ data: voorraadRaw, error: vErr }, { data: afnameRaw, error: aErr }] = await Promise.all([
        supabase.from("Voorraad" as never).select("CD_SUBCODE,DS_SUBCODE,DS_CENTER_DESCRIPTION,Aantal"),
        supabase.from("Afname" as never).select("SubCode,SubCodeDescription,CenterDescription,Aantal"),
      ]);

      if (vErr || aErr) {
        setDbError((vErr ?? aErr)!.message);
        return;
      }

      // Normalize to common shape
      type StockRow = { subcode: string; description: string; center: string; aantal: number };
      type VRow = Record<string, unknown>;
      const voorraadRows: StockRow[] = ((voorraadRaw as VRow[]) ?? []).map((r) => ({
        subcode: String(r["CD_SUBCODE"] ?? ""),
        description: String(r["DS_SUBCODE"] ?? ""),
        center: String(r["DS_CENTER_DESCRIPTION"] ?? ""),
        aantal: Number(r["Aantal"] ?? 0),
      }));
      const afnameRows: StockRow[] = ((afnameRaw as VRow[]) ?? []).map((r) => ({
        subcode: String(r["SubCode"] ?? ""),
        description: String(r["SubCodeDescription"] ?? ""),
        center: String(r["CenterDescription"] ?? ""),
        aantal: Number(r["Aantal"] ?? 0),
      }));

      const normalizeCenter = (center: string): "emmen" | "tilburg" =>
        center?.toLowerCase().includes("emmen") ? "emmen" : "tilburg";

      const stockMap = new Map<string, { description: string; aantal: number }>();
      for (const row of voorraadRows) {
        const key = `${row.subcode}||${normalizeCenter(row.center)}`;
        const ex = stockMap.get(key);
        if (ex) ex.aantal += Number(row.aantal);
        else stockMap.set(key, { description: row.description, aantal: Number(row.aantal) });
      }

      const consumptionMap = new Map<string, { description: string; aantal: number }>();
      for (const row of afnameRows) {
        const key = `${row.subcode}||${normalizeCenter(row.center)}`;
        const ex = consumptionMap.get(key);
        if (ex) ex.aantal += Number(row.aantal);
        else consumptionMap.set(key, { description: row.description, aantal: Number(row.aantal) });
      }

      // Outer join — show all products from either table
      const allKeys = new Set([...stockMap.keys(), ...consumptionMap.keys()]);
      const emmenItems: StockItem[] = [];
      const tilburgItems: StockItem[] = [];
      for (const key of allKeys) {
        const [subcode, center] = key.split("||");
        const stock = stockMap.get(key);
        const consumption = consumptionMap.get(key);
        const numberOnStock = stock?.aantal ?? 0;
        const averageConsumption = consumption?.aantal ?? 0;
        const item: StockItem = {
          subCode: subcode,
          description: stock?.description ?? consumption?.description ?? subcode,
          numberOnStock,
          averageConsumption,
          difference: numberOnStock - averageConsumption,
        };
        if (center === "emmen") emmenItems.push(item);
        else tilburgItems.push(item);
      }

      setStockByLocation({ sol_emmen: emmenItems, sol_tilburg: tilburgItems });

      // Sync unique products into stock_products for Vullocatie Beheer
      // Default filled_in_emmen: true if product exists in Emmen stock, false if only in Tilburg
      const emmenSubCodes = new Set(emmenItems.map((item) => item.subCode));
      const tilburgSubCodes = new Set(tilburgItems.map((item) => item.subCode));
      const uniqueMap = new Map<string, { sub_code: string; description: string; fill_location: string }>();
      for (const item of [...emmenItems, ...tilburgItems]) {
        if (!uniqueMap.has(item.subCode)) {
          const fillLocation = emmenSubCodes.has(item.subCode) ? "emmen"
            : tilburgSubCodes.has(item.subCode) ? "tilburg"
            : "extern";
          uniqueMap.set(item.subCode, {
            sub_code: item.subCode,
            description: item.description,
            fill_location: fillLocation,
          });
        }
      }
      if (uniqueMap.size > 0) {
        // Only insert new products; existing records (with manual overrides) are left untouched
        const subCodes = Array.from(uniqueMap.keys());
        const { data: existing } = await supabase
          .from("stock_products")
          .select("sub_code")
          .in("sub_code", subCodes);
        const existingSet = new Set((existing ?? []).map((r) => r.sub_code));
        const newProducts = Array.from(uniqueMap.values()).filter((p) => !existingSet.has(p.sub_code));
        if (newProducts.length > 0) {
          await supabase.from("stock_products").insert(newProducts);
        }
      }
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
                          }).map((item) => (
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
        locationLabel={selectedLocation === "sol_tilburg" ? "SOL Tilburg" : selectedLocation === "sol_emmen" ? "SOL Emmen" : "Alle locaties"}
      />
    </div>
    </>
  );
}
