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
  CalendarClock,
  Gauge,
  MapPin,
  Target,
} from "lucide-react";
import { cn, formatNumber, normalizeDatum } from "@/lib/utils";
import { FadeIn } from "@/components/ui/fade-in";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { analyzeAnomalies } from "@/hooks/useAnomalyDetection";
import { AnomalyAlertBadge, AnomalyAlertsPanel } from "./AnomalyAlertBadge";
import { buildDigitalProductNames } from "@/lib/gasTypeUtils";

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
  hideExternal?: boolean;
  onHideExternalChange?: (value: boolean) => void;
  onNavigateToReports?: () => void;
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

// (Removed mapDatum in favor of normalizeDatum from utils)
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
      const date = normalizeDatum(row.Datum);
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
      const date = normalizeDatum(r.Datum);
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
  hideDigital = false,
  onNavigateToReports,
}: KPIDashboardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentStats, setCurrentStats] = useState<ProductieStats | null>(null);
  const [previousStats, setPreviousStats] = useState<ProductieStats | null>(null);
  const [weeklyData, setWeeklyData] = useState<SparklineData[]>([]);
  const [historicalWeeklyData, setHistoricalWeeklyData] = useState<number[]>([]);
  const [newCustomersYtd, setNewCustomersYtd] = useState(0);
  const [pacePrevAtSameDay, setPacePrevAtSameDay] = useState<number>(0);
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
          .order("id")
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

      setNewCustomersYtd(0);

      const digitalNames = hideDigital ? await buildDigitalProductNames() : new Set<string>();
      const filterDigital = (rows: ProductieRow[]) =>
        hideDigital ? rows.filter(r => !digitalNames.has(r.Product)) : rows;

      if (dateRange) {
        const fromStr = toLocalDateString(dateRange.from);
        const toStr = toLocalDateString(dateRange.to);
        const fromYear = dateRange.from.getFullYear();
        const toYear = dateRange.to.getFullYear();

        // Fetch all years needed for current period
        const yearsNeeded = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i);
        const allCurrentRows = filterDigital(
          (await Promise.all(yearsNeeded.map(fetchProductieForYear))).flat()
        );

        setCurrentStats(calculateStats(allCurrentRows, fromStr, toStr, locationParam));

        // Previous period = same calendar window one year earlier (e.g. YTD 2026 vs YTD 2025
        // same dates). This gives like-for-like seasonal comparison.
        const prevFrom = new Date(dateRange.from);
        prevFrom.setFullYear(prevFrom.getFullYear() - 1);
        const prevTo = new Date(dateRange.to);
        prevTo.setFullYear(prevTo.getFullYear() - 1);
        const prevFromStr = toLocalDateString(prevFrom);
        const prevToStr = toLocalDateString(prevTo);

        const prevYears = Array.from(
          { length: prevTo.getFullYear() - prevFrom.getFullYear() + 1 },
          (_, i) => prevFrom.getFullYear() + i,
        );
        const rawPrevRows = (
          await Promise.all(prevYears.map(fetchProductieForYear))
        ).flat();
        const prevRows = filterDigital(rawPrevRows);
        setPreviousStats(calculateStats(prevRows, prevFromStr, prevToStr, locationParam));

        // Pace: where did we stand on this same day last year (start-of-year through same calendar day)?
        // Only meaningful when the current period starts on Jan 1.
        const isYtdLike = dateRange.from.getMonth() === 0 && dateRange.from.getDate() === 1;
        if (isYtdLike) {
          const paceStart = new Date(prevFrom.getFullYear(), 0, 1);
          const paceStartStr = toLocalDateString(paceStart);
          const pace = calculateStats(prevRows, paceStartStr, prevToStr, locationParam);
          setPacePrevAtSameDay(pace.total_cylinders);
        } else {
          setPacePrevAtSameDay(0);
        }

        // New customers in current period that did not appear in same period last year
        const currKlanten = new Set<string>();
        for (const r of allCurrentRows) {
          const d = normalizeDatum(r.Datum);
          if (d >= fromStr && d <= toStr && r.Klant) currKlanten.add(r.Klant);
        }
        const prevKlanten = new Set<string>();
        for (const r of prevRows) {
          const d = normalizeDatum(r.Datum);
          if (d >= prevFromStr && d <= prevToStr && r.Klant) prevKlanten.add(r.Klant);
        }
        setNewCustomersYtd([...currKlanten].filter((c) => !prevKlanten.has(c)).length);

        const sparklineEnd = new Date(Math.min(dateRange.to.getTime(), Date.now()));
        const sparkline = computeWeeklySparkline(allCurrentRows, sparklineEnd, locationParam);
        setWeeklyData(sparkline);
        setHistoricalWeeklyData(sparkline.slice(0, -1).map((w) => w.value));
      } else {
        // Year mode
        const [rawCurrentRows, rawPreviousRows] = await Promise.all([
          fetchProductieForYear(currentYear),
          fetchProductieForYear(currentYear - 1),
        ]);
        const currentRows = filterDigital(rawCurrentRows);
        const previousRows = filterDigital(rawPreviousRows);

        setCurrentStats(calculateStats(currentRows, undefined, undefined, locationParam));
        setPreviousStats(calculateStats(previousRows, undefined, undefined, locationParam));
        setPacePrevAtSameDay(0);

        // New customers YTD: in current year but not in previous year
        const currentCustomerSet = new Set(currentRows.map(r => r.Klant).filter(Boolean));
        const prevCustomerSet = new Set(previousRows.map(r => r.Klant).filter(Boolean));
        const newCount = [...currentCustomerSet].filter(c => !prevCustomerSet.has(c)).length;
        setNewCustomersYtd(newCount);

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
  }, [location, dateRange, currentYear, fetchProductieForYear, hideDigital]);

  useEffect(() => {
    fetchKPIData();
  }, [fetchKPIData, refreshKey]);

  // Returns null when there is no comparable baseline (previous = 0).
  // This avoids meaningless "+999%" / "-999%" displays.
  const calculateTrend = (current: number, previous: number): number | null => {
    if (previous === 0) return null;
    const pct = Math.round(((current - previous) / previous) * 100);
    return Math.max(-500, Math.min(500, pct));
  };

  const formatTrend = (value: number | null): string => {
    if (value === null) return "—";
    if (value >= 500) return "+500%+";
    if (value <= -500) return "−500%+";
    return `${value > 0 ? "+" : ""}${value}%`;
  };

  // Only color trends red/green when the change is meaningful (> 5% delta).
  // Tiny fluctuations stay neutral to reduce visual noise.
  const isMeaningful = (value: number | null) =>
    value !== null && Math.abs(value) >= 5;

  const volumeTrend = useMemo<number | null>(() => {
    if (!currentStats || !previousStats) return null;
    return calculateTrend(currentStats.total_cylinders, previousStats.total_cylinders);
  }, [currentStats, previousStats]);

  const recordsTrend = useMemo<number | null>(() => {
    if (!currentStats || !previousStats) return null;
    return calculateTrend(currentStats.total_records, previousStats.total_records);
  }, [currentStats, previousStats]);

  const avgPerRecord = useMemo(() => {
    if (!currentStats || currentStats.total_records === 0) return 0;
    return Math.round(currentStats.total_cylinders / currentStats.total_records);
  }, [currentStats]);

  // Count working days (Mon-Fri) between two dates inclusive.
  const workdaysBetween = (start: Date, end: Date): number => {
    let count = 0;
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (d.getTime() <= last.getTime()) {
      const day = d.getDay();
      if (day !== 0 && day !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  };

  const avgPerWorkday = useMemo(() => {
    if (!currentStats || !dateRange) return { current: 0, previous: 0 };
    const today = new Date();
    const effectiveTo = dateRange.to.getTime() > today.getTime() ? today : dateRange.to;
    const wd = Math.max(1, workdaysBetween(dateRange.from, effectiveTo));
    const prevFrom = new Date(dateRange.from); prevFrom.setFullYear(prevFrom.getFullYear() - 1);
    const prevTo = new Date(effectiveTo); prevTo.setFullYear(prevTo.getFullYear() - 1);
    const wdPrev = Math.max(1, workdaysBetween(prevFrom, prevTo));
    return {
      current: Math.round((currentStats.total_cylinders || 0) / wd),
      previous: Math.round((previousStats?.total_cylinders || 0) / wdPrev),
    };
  }, [currentStats, previousStats, dateRange]);

  const workdayTrend = useMemo<number | null>(() => {
    if (!avgPerWorkday.previous) return null;
    return calculateTrend(avgPerWorkday.current, avgPerWorkday.previous);
  }, [avgPerWorkday]);

  const paceProgress = useMemo(() => {
    // Pace = where prior year stood on the same calendar day.
    if (!pacePrevAtSameDay || !currentStats) return null;
    const pct = Math.round((currentStats.total_cylinders / pacePrevAtSameDay) * 100);
    return { pct: Math.max(0, Math.min(200, pct)), pacePrev: pacePrevAtSameDay };
  }, [pacePrevAtSameDay, currentStats]);

  const getTrendIcon = (value: number | null) => {
    if (value === null || !isMeaningful(value)) return <Minus className="h-3 w-3" />;
    if (value > 0) return <TrendingUp className="h-3 w-3" />;
    return <TrendingDown className="h-3 w-3" />;
  };

  const getTrendColor = (value: number | null) => {
    if (value === null || !isMeaningful(value)) return "text-muted-foreground";
    if (value > 0) return "text-success";
    return "text-destructive";
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
                <div
                  className={cn("p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20", onNavigateToReports && "cursor-pointer hover:ring-1 hover:ring-orange-500/40 transition-all")}
                  onClick={onNavigateToReports}
                  title={onNavigateToReports ? "Bekijk rapportage" : undefined}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-orange-500" />
                      <span className="text-xs font-medium text-muted-foreground">
                        {isCustomPeriod ? "Volume periode" : "Volume YTD"}
                      </span>
                    </div>
                    <div
                      className="flex flex-col items-end gap-0"
                      title={volumeTrend === null ? "Geen vergelijkbare basis in vorige periode" : undefined}
                    >
                      <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor(volumeTrend))}>
                        {getTrendIcon(volumeTrend)}
                        <span>{formatTrend(volumeTrend)}</span>
                      </div>
                      {!isCustomPeriod && (
                        <span className="text-[10px] text-muted-foreground">vs. {currentYear - 1}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-orange-500">
                    {formatNumber(currentStats?.total_cylinders || 0, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">Gevulde cilinders</p>
                </div>

                {/* Records */}
                <div
                  className={cn("p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-purple-500/5 border border-purple-500/20", onNavigateToReports && "cursor-pointer hover:ring-1 hover:ring-purple-500/40 transition-all")}
                  onClick={onNavigateToReports}
                  title={onNavigateToReports ? "Bekijk rapportage" : undefined}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <ListOrdered className="h-4 w-4 text-purple-500" />
                      <span className="text-xs font-medium text-muted-foreground">Regels</span>
                    </div>
                    <div
                      className="flex flex-col items-end gap-0"
                      title={recordsTrend === null ? "Geen vergelijkbare basis in vorige periode" : undefined}
                    >
                      <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor(recordsTrend))}>
                        {getTrendIcon(recordsTrend)}
                        <span>{formatTrend(recordsTrend)}</span>
                      </div>
                      {!isCustomPeriod && (
                        <span className="text-[10px] text-muted-foreground">vs. {currentYear - 1}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-purple-500">
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
                  {!isCustomPeriod && newCustomersYtd > 0 && (
                    <p className="text-xs text-success mt-0.5 font-medium">
                      +{newCustomersYtd} nieuw dit jaar
                    </p>
                  )}
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

              {/* Jaardoelstelling voortgang */}
              {!isCustomPeriod && (() => {
                try {
                  const stored = localStorage.getItem(`yearly-targets-${currentYear}`);
                  const t = stored ? JSON.parse(stored) : null;
                  if (!t || (t.emmen === 0 && t.tilburg === 0)) return null;
                  const totalTarget = (t.emmen || 0) + (t.tilburg || 0);
                  const rows = [
                    { label: "SOL Emmen", color: "bg-orange-500", colorText: "text-orange-500", current: currentStats?.emmen_cylinders || 0, target: t.emmen || 0 },
                    { label: "SOL Tilburg", color: "bg-blue-500", colorText: "text-blue-500", current: currentStats?.tilburg_cylinders || 0, target: t.tilburg || 0 },
                    { label: "Totaal", color: "bg-primary", colorText: "text-primary", current: currentStats?.total_cylinders || 0, target: totalTarget },
                  ].filter(r => r.target > 0);
                  return (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                        <Target className="h-3 w-3" />
                        Jaardoelstelling {currentYear} — YTD voortgang
                      </div>
                      <div className="space-y-2.5">
                        {rows.map(({ label, color, colorText, current, target }) => {
                          const pct = Math.min(100, Math.round((current / target) * 100));
                          return (
                            <div key={label}>
                              <div className="flex justify-between text-xs mb-1">
                                <span className={`font-medium ${colorText}`}>{label}</span>
                                <span className="text-muted-foreground font-mono">
                                  {formatNumber(current, 0)} / {formatNumber(target, 0)}
                                  <span className="ml-2 font-semibold text-foreground">{pct}%</span>
                                </span>
                              </div>
                              <div className="w-full bg-muted/50 rounded-full h-1.5">
                                <div className={`h-1.5 rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                } catch { return null; }
              })()}

              {/* Anomaly Alerts Panel — actiegericht via knop naar Rapportage */}
              {activeAnomalies.length > 0 && (
                <AnomalyAlertsPanel
                  anomalies={anomalies}
                  className="mt-4"
                  onInvestigate={onNavigateToReports}
                />
              )}
            </FadeIn>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
