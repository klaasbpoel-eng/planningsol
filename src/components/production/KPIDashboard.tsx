import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  BarChart3,
  Minus,
  AlertTriangle,
  Cylinder,
  Users,
  ListOrdered,
  MapPin,
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { FadeIn } from "@/components/ui/fade-in";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { analyzeAnomalies } from "@/hooks/useAnomalyDetection";
import { AnomalyAlertBadge, AnomalyAlertsPanel } from "./AnomalyAlertBadge";

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

type DateRange = {
  from: Date;
  to: Date;
};

interface KPIDashboardProps {
  location: ProductionLocation;
  refreshKey?: number;
  dateRange?: DateRange;
  // kept for API compatibility with parent
  hideDigital?: boolean;
  onHideDigitalChange?: (value: boolean) => void;
}

interface ProductieRow {
  id: string;
  Jaar: number;
  Datum: string;
  Locatie: string;
  Product: string;
  Aantal: number;
  Klant: string;
}

interface ProductieStats {
  total_cylinders: number;
  total_records: number;
  emmen_cylinders: number;
  tilburg_cylinders: number;
  unique_customers: number;
  unique_products: number;
}

interface SparklineData {
  week: string;
  value: number;
}

// ─── helpers ────────────────────────────────────────────────────────────────

function mapLocatie(locatie: string): "sol_emmen" | "sol_tilburg" {
  return locatie.toLowerCase().includes("emmen") ? "sol_emmen" : "sol_tilburg";
}

// Convert datum to "YYYY-MM-DD"
// Handles ISO "2020-01-02T00:00:00.000Z", ISO date "2020-01-02", and legacy "DD-MM-YYYY"
function mapDatum(datum: string): string {
  if (!datum) return "";
  if (datum.includes("T")) return datum.substring(0, 10);
  const parts = datum.split("-");
  if (parts.length === 3 && parts[0].length === 4) return datum; // already YYYY-MM-DD
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD-MM-YYYY → YYYY-MM-DD
  return datum;
}

const toLocalDateString = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

function calculateStats(
  rows: ProductieRow[],
  fromDate?: string,
  toDate?: string,
  locationParam?: string | null
): ProductieStats {
  let filtered = rows;

  if (fromDate || toDate) {
    filtered = filtered.filter((row) => {
      const date = mapDatum(row.Datum);
      if (fromDate && date < fromDate) return false;
      if (toDate && date > toDate) return false;
      return true;
    });
  }

  if (locationParam) {
    filtered = filtered.filter((row) => mapLocatie(row.Locatie) === locationParam);
  }

  const emmenRows = filtered.filter((r) => mapLocatie(r.Locatie) === "sol_emmen");
  const tilburgRows = filtered.filter((r) => mapLocatie(r.Locatie) === "sol_tilburg");

  return {
    total_cylinders: filtered.reduce((sum, r) => sum + (r.Aantal || 0), 0),
    total_records: filtered.length,
    emmen_cylinders: emmenRows.reduce((sum, r) => sum + (r.Aantal || 0), 0),
    tilburg_cylinders: tilburgRows.reduce((sum, r) => sum + (r.Aantal || 0), 0),
    unique_customers: new Set(filtered.map((r) => r.Klant).filter(Boolean)).size,
    unique_products: new Set(filtered.map((r) => r.Product).filter(Boolean)).size,
  };
}

function computeWeeklySparkline(
  rows: ProductieRow[],
  endDate: Date,
  locationParam?: string | null
): SparklineData[] {
  return Array.from({ length: 8 }, (_, i) => {
    const daysBack = (7 - i) * 7;
    const weekEnd = new Date(endDate);
    weekEnd.setDate(endDate.getDate() - daysBack);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 6);

    const startStr = toLocalDateString(weekStart);
    const endStr = toLocalDateString(weekEnd);

    let weekRows = rows.filter((r) => {
      const date = mapDatum(r.Datum);
      return date >= startStr && date <= endStr;
    });

    if (locationParam) {
      weekRows = weekRows.filter((r) => mapLocatie(r.Locatie) === locationParam);
    }

    return {
      week: `W${i + 1}`,
      value: weekRows.reduce((sum, r) => sum + (r.Aantal || 0), 0),
    };
  });
}

// ─── component ──────────────────────────────────────────────────────────────

export function KPIDashboard({
  location,
  refreshKey = 0,
  dateRange,
}: KPIDashboardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentStats, setCurrentStats] = useState<ProductieStats | null>(null);
  const [previousStats, setPreviousStats] = useState<ProductieStats | null>(null);
  const [weeklyData, setWeeklyData] = useState<SparklineData[]>([]);
  const [historicalWeeklyData, setHistoricalWeeklyData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();
  const isCustomPeriod = !!dateRange;

  const fetchProductieForYear = useCallback(async (year: number): Promise<ProductieRow[]> => {
    try {
      const PAGE = 1000;
      const allRows: ProductieRow[] = [];
      let from = 0;
      while (true) {
        const { data } = await (supabase.from("Productie" as never) as any)
          .select("id,Jaar,Datum,Locatie,Product,Aantal,Klant")
          .eq("Jaar", year)
          .range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      return allRows;
    } catch {
      return [];
    }
  }, []);

  const fetchKPIData = useCallback(async () => {
    setLoading(true);
    try {
      const locationParam = location === "all" ? null : location;

      if (dateRange) {
        const fromStr = toLocalDateString(dateRange.from);
        const toStr = toLocalDateString(dateRange.to);
        const fromYear = dateRange.from.getFullYear();
        const toYear = dateRange.to.getFullYear();

        // Fetch all years needed for current period
        const yearsNeeded = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i);
        const allCurrentRows = (await Promise.all(yearsNeeded.map(fetchProductieForYear))).flat();

        setCurrentStats(calculateStats(allCurrentRows, fromStr, toStr, locationParam));

        // Previous period (same duration, immediately before)
        const periodDays = Math.ceil(
          (dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24)
        );
        const prevTo = new Date(dateRange.from);
        prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo);
        prevFrom.setDate(prevFrom.getDate() - periodDays);
        const prevFromStr = toLocalDateString(prevFrom);
        const prevToStr = toLocalDateString(prevTo);

        const prevYear = prevFrom.getFullYear();
        const prevRows = prevYear >= fromYear
          ? allCurrentRows
          : await fetchProductieForYear(prevYear);
        setPreviousStats(calculateStats(prevRows, prevFromStr, prevToStr, locationParam));

        const sparklineEnd = new Date(Math.min(dateRange.to.getTime(), Date.now()));
        const sparkline = computeWeeklySparkline(allCurrentRows, sparklineEnd, locationParam);
        setWeeklyData(sparkline);
        setHistoricalWeeklyData(sparkline.slice(0, -1).map((w) => w.value));
      } else {
        // Year mode
        const [currentRows, previousRows] = await Promise.all([
          fetchProductieForYear(currentYear),
          fetchProductieForYear(currentYear - 1),
        ]);

        setCurrentStats(calculateStats(currentRows, undefined, undefined, locationParam));
        setPreviousStats(calculateStats(previousRows, undefined, undefined, locationParam));

        // Combine both years for sparkline (handles year boundary weeks)
        const sparkline = computeWeeklySparkline(
          [...currentRows, ...previousRows],
          new Date(),
          locationParam
        );
        setWeeklyData(sparkline);
        setHistoricalWeeklyData(sparkline.slice(0, -1).map((w) => w.value));
      }
    } catch (error) {
      console.error("[KPIDashboard] Error fetching KPI data:", error);
    } finally {
      setLoading(false);
    }
  }, [location, dateRange, currentYear, fetchProductieForYear]);

  useEffect(() => {
    fetchKPIData();
  }, [fetchKPIData, refreshKey]);

  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const volumeTrend = useMemo(() => {
    if (!currentStats || !previousStats) return 0;
    return calculateTrend(currentStats.total_cylinders, previousStats.total_cylinders);
  }, [currentStats, previousStats]);

  const recordsTrend = useMemo(() => {
    if (!currentStats || !previousStats) return 0;
    return calculateTrend(currentStats.total_records, previousStats.total_records);
  }, [currentStats, previousStats]);

  const avgPerRecord = useMemo(() => {
    if (!currentStats || currentStats.total_records === 0) return 0;
    return Math.round(currentStats.total_cylinders / currentStats.total_records);
  }, [currentStats]);

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-3 w-3" />;
    if (value < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return "text-success";
    if (value < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  const anomalies = useMemo(() => {
    const currentWeekValue =
      weeklyData.length > 0 ? weeklyData[weeklyData.length - 1]?.value || 0 : 0;
    return analyzeAnomalies(
      [{ label: "Cilinders deze week", current: currentWeekValue, historical: historicalWeeklyData }],
      { sensitivityThreshold: 1.8, minDataPoints: 3 }
    );
  }, [weeklyData, historicalWeeklyData]);

  const activeAnomalies = anomalies.filter((a) => a.result.isAnomaly);
  const volumeAnomaly = anomalies.find((a) => a.label === "Cilinders deze week")?.result;

  if (loading) {
    return (
      <Card className="glass-card animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-24 bg-muted/50 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="glass-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                <Activity className="h-5 w-5 text-primary" />
                KPI Dashboard
                <Badge variant="outline" className="ml-2 text-xs">
                  {isCustomPeriod && dateRange
                    ? `${dateRange.from.toLocaleDateString("nl-NL", { day: "numeric", month: "short" })} - ${dateRange.to.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}`
                    : currentYear}
                </Badge>
                {activeAnomalies.length > 0 && (
                  <Badge
                    variant="outline"
                    className="ml-1 gap-1 bg-warning/10 text-warning border-warning/30 text-xs animate-pulse"
                  >
                    <AlertTriangle className="h-3 w-3" />
                    {activeAnomalies.length} {activeAnomalies.length === 1 ? "alert" : "alerts"}
                  </Badge>
                )}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <FadeIn show={true}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Volume */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-orange-500" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {isCustomPeriod ? "Volume periode" : "Volume YTD"}
                      </span>
                    </div>
                    <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor(volumeTrend))}>
                      {getTrendIcon(volumeTrend)}
                      <span>{volumeTrend > 0 ? "+" : ""}{volumeTrend}%</span>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-orange-500">
                    {formatNumber(currentStats?.total_cylinders || 0, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Gevulde cilinders</p>
                </div>

                {/* Records */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">Regels</span>
                    </div>
                    <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor(recordsTrend))}>
                      {getTrendIcon(recordsTrend)}
                      <span>{recordsTrend > 0 ? "+" : ""}{recordsTrend}%</span>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-primary">
                    {formatNumber(currentStats?.total_records || 0, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Productieregels</p>
                </div>

                {/* Klanten */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-green-500" />
                      <span className="text-xs font-medium text-muted-foreground">Klanten</span>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-green-500">
                    {currentStats?.unique_customers || 0}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gem. {avgPerRecord} cil./regel
                  </p>
                </div>

                {/* Weekly Trend Sparkline */}
                <div
                  className={cn(
                    "p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border relative",
                    volumeAnomaly?.isAnomaly
                      ? volumeAnomaly.severity === "high"
                        ? "border-destructive/40 ring-1 ring-destructive/20"
                        : "border-warning/40 ring-1 ring-warning/20"
                      : "border-blue-500/20"
                  )}
                >
                  {volumeAnomaly?.isAnomaly && (
                    <div className="absolute top-2 right-2">
                      <AnomalyAlertBadge anomaly={volumeAnomaly} compact />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="text-xs font-medium text-muted-foreground">
                        Wekelijkse trend
                      </span>
                    </div>
                  </div>
                  <div className="h-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyData}>
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-popover border rounded-lg px-2 py-1 text-xs shadow-md">
                                  <span className="font-medium">
                                    {formatNumber(payload[0].value as number, 0)} cilinders
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Laatste 8 weken</p>
                </div>
              </div>

              {/* Bottom stats row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/10">
                    <MapPin className="h-4 w-4 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {formatNumber(currentStats?.emmen_cylinders || 0, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">SOL Emmen</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <MapPin className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {formatNumber(currentStats?.tilburg_cylinders || 0, 0)}
                    </p>
                    <p className="text-xs text-muted-foreground">SOL Tilburg</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <Cylinder className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{currentStats?.unique_products || 0}</p>
                    <p className="text-xs text-muted-foreground">Unieke producten</p>
                  </div>
                </div>
              </div>

              {/* Anomaly Alerts Panel */}
              {activeAnomalies.length > 0 && (
                <AnomalyAlertsPanel anomalies={anomalies} className="mt-4" />
              )}
            </FadeIn>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
