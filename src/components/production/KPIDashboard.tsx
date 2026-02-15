import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  Target,
  ChevronDown,
  ChevronUp,
  Zap,
  BarChart3,
  Minus,
  AlertTriangle,
  Sparkles,
  Cylinder
} from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";
import { FadeIn } from "@/components/ui/fade-in";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip
} from "recharts";
import { analyzeAnomalies, type AnomalyResult } from "@/hooks/useAnomalyDetection";
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
  hideDigital?: boolean;
  onHideDigitalChange?: (value: boolean) => void;
}

interface EfficiencyData {
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  efficiency_rate: number;
  total_cylinders: number;
  completed_cylinders: number;
}

interface SparklineData {
  week: string;
  value: number;
}

export function KPIDashboard({ location, refreshKey = 0, dateRange, hideDigital: externalHideDigital, onHideDigitalChange }: KPIDashboardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentYearData, setCurrentYearData] = useState<EfficiencyData | null>(null);
  const [previousYearData, setPreviousYearData] = useState<EfficiencyData | null>(null);
  const [periodData, setPeriodData] = useState<{ current: EfficiencyData | null; previous: EfficiencyData | null }>({ current: null, previous: null });
  const [weeklyData, setWeeklyData] = useState<SparklineData[]>([]);
  const [historicalWeeklyData, setHistoricalWeeklyData] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const hideDigital = externalHideDigital ?? false;
  const setHideDigital = (val: boolean) => onHideDigitalChange?.(val);
  const [digitalCylinders, setDigitalCylinders] = useState(0);
  const [physicalCylinders, setPhysicalCylinders] = useState(0);
  const [hasDigitalTypes, setHasDigitalTypes] = useState(false);

  const currentYear = new Date().getFullYear();

  // Check if using custom date range
  const isCustomPeriod = !!dateRange;

  useEffect(() => {
    fetchKPIData();
  }, [location, refreshKey, dateRange]);

  const fetchKPIData = useCallback(async () => {
    console.log("[KPIDashboard] Fetching KPI data...", { location, dateRange });
    setLoading(true);

    try {
      const locationParam = location === "all" ? null : location;

      // Helper to format date as local YYYY-MM-DD (avoids UTC timezone shift)
      const toLocalDateString = (date: Date) => {
        const y = date.getFullYear();
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const d = String(date.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      };

      if (dateRange) {
        // Calculate period-based data
        const fromDate = toLocalDateString(dateRange.from);
        const toDate = toLocalDateString(dateRange.to);

        console.log("[KPIDashboard] Calling RPC with date range:", { fromDate, toDate, locationParam });

        // Calculate previous period (same length, immediately before)
        const periodLength = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
        const prevTo = new Date(dateRange.from);
        prevTo.setDate(prevTo.getDate() - 1);
        const prevFrom = new Date(prevTo);
        prevFrom.setDate(prevFrom.getDate() - periodLength);
        const prevFromDate = toLocalDateString(prevFrom);
        const prevToDate = toLocalDateString(prevTo);

        // Fetch current period data
        // Use RPC function for server-side aggregation (avoids 1000 row limit)
        const [currentRes, prevRes] = await Promise.all([
          api.reports.getProductionEfficiency(fromDate, toDate, locationParam).then(data => ({ data, error: null })).catch(error => ({ data: null, error })),
          api.reports.getProductionEfficiency(prevFromDate, prevToDate, locationParam).then(data => ({ data, error: null })).catch(error => ({ data: null, error }))
        ]);

        // Log errors if any
        if (currentRes.error) {
          console.error("[KPIDashboard] Error fetching current period data:", currentRes.error);
        }
        if (prevRes.error) {
          console.error("[KPIDashboard] Error fetching previous period data:", prevRes.error);
        }

        console.log("[KPIDashboard] RPC Response - current:", currentRes.data, "previous:", prevRes.data);

        const currentData = currentRes.data && currentRes.data.length > 0
          ? currentRes.data[0]
          : {
            total_orders: 0,
            completed_orders: 0,
            pending_orders: 0,
            cancelled_orders: 0,
            efficiency_rate: 0,
            total_cylinders: 0,
            completed_cylinders: 0
          };

        const previousData = prevRes.data && prevRes.data.length > 0
          ? prevRes.data[0]
          : {
            total_orders: 0,
            completed_orders: 0,
            pending_orders: 0,
            cancelled_orders: 0,
            efficiency_rate: 0,
            total_cylinders: 0,
            completed_cylinders: 0
          };

        console.log("[KPIDashboard] Setting data - completed_orders:", currentData.completed_orders, "total_cylinders:", currentData.total_cylinders);

        setPeriodData({ current: currentData, previous: previousData });
        setCurrentYearData(currentData);
        setPreviousYearData(previousData);
      } else {
        // Fetch current year and previous year efficiency
        console.log("[KPIDashboard] Calling year-based RPC:", { currentYear, locationParam });

        const [currentResult, previousResult] = await Promise.all([
          api.reports.getProductionEfficiencyYearly(currentYear, locationParam).then(data => ({ data, error: null })).catch(error => ({ data: null, error })),
          api.reports.getProductionEfficiencyYearly(currentYear - 1, locationParam).then(data => ({ data, error: null })).catch(error => ({ data: null, error }))
        ]);

        // Log errors if any
        if (currentResult.error) {
          console.error("[KPIDashboard] Error fetching current year data:", currentResult.error);
        }
        if (previousResult.error) {
          console.error("[KPIDashboard] Error fetching previous year data:", previousResult.error);
        }

        console.log("[KPIDashboard] Year RPC Response - current:", currentResult.data, "previous:", previousResult.data);

        if (currentResult.data && currentResult.data.length > 0) {
          setCurrentYearData(currentResult.data[0]);
        }

        if (previousResult.data && previousResult.data.length > 0) {
          setPreviousYearData(previousResult.data[0]);
        }

        setPeriodData({ current: null, previous: null });
      }

      // Fetch weekly sparkline data (last 8 weeks or within date range)
      const weeklySparkline = await fetchWeeklySparkline(locationParam, dateRange);
      setWeeklyData(weeklySparkline);

      // Store historical values for anomaly detection (exclude current week)
      const historicalValues = weeklySparkline.slice(0, -1).map(w => w.value);
      setHistoricalWeeklyData(historicalValues);

      // Fetch gas type distribution for digital/physical split
      try {
        const toLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const fromStr = dateRange ? toLocal(dateRange.from) : `${currentYear}-01-01`;
        const toStr = dateRange ? toLocal(dateRange.to) : `${currentYear}-12-31`;

        const [gasTypeDistRes, gasTypesRes] = await Promise.all([
          api.reports.getGasTypeDistribution(fromStr, toStr, locationParam).catch(() => ({ data: [] })),
          api.gasTypes.getAll().catch(() => ({ data: [] })),
        ]);

        const gasTypesData = (gasTypesRes?.data || []) as any[];
        const digitalIds = new Set(gasTypesData.filter((gt: any) => gt.is_digital).map((gt: any) => gt.id));
        setHasDigitalTypes(digitalIds.size > 0);

        const distData = (gasTypeDistRes?.data || []) as any[];
        let digTotal = 0;
        let physTotal = 0;
        distData.forEach((item: any) => {
          const count = Number(item.total_cylinders) || 0;
          if (item.gas_type_id && digitalIds.has(item.gas_type_id)) {
            digTotal += count;
          } else {
            physTotal += count;
          }
        });
        setDigitalCylinders(digTotal);
        setPhysicalCylinders(physTotal);
      } catch (e) {
        console.error("[KPIDashboard] Error fetching digital split:", e);
      }
    } catch (error) {
      console.error("[KPIDashboard] Error fetching KPI data:", error);
    } finally {
      setLoading(false);
    }
  }, [location, dateRange, currentYear]);

  const fetchWeeklySparkline = async (locationParam: string | null, dateRange?: DateRange): Promise<SparklineData[]> => {
    const weeks: SparklineData[] = [];
    const today = dateRange?.to || new Date();

    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7) - today.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);

      const toLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const startStr = toLocal(weekStart);
      const endStr = toLocal(weekEnd);

      let query = api.reports.getCylinderTotal(startStr, endStr, locationParam);

      const total = await query;

      weeks.push({
        week: `W${8 - i}`,
        value: total
      });
    }

    return weeks;
  };

  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const efficiencyTrend = useMemo(() => {
    if (!currentYearData || !previousYearData) return 0;
    return calculateTrend(currentYearData.efficiency_rate, previousYearData.efficiency_rate);
  }, [currentYearData, previousYearData]);

  const volumeTrend = useMemo(() => {
    if (!currentYearData || !previousYearData) return 0;
    return calculateTrend(currentYearData.total_cylinders, previousYearData.total_cylinders);
  }, [currentYearData, previousYearData]);

  const completionRate = useMemo(() => {
    if (!currentYearData) return 0;
    const nonCancelled = currentYearData.total_orders - currentYearData.cancelled_orders;
    if (nonCancelled === 0) return 0;
    return Math.round((currentYearData.completed_orders / nonCancelled) * 100);
  }, [currentYearData]);

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

  const getEfficiencyColor = (rate: number) => {
    if (rate >= 80) return "text-success";
    if (rate >= 60) return "text-warning";
    return "text-destructive";
  };

  // Anomaly detection for current week volume
  const anomalies = useMemo(() => {
    const currentWeekValue = weeklyData.length > 0 ? weeklyData[weeklyData.length - 1]?.value || 0 : 0;

    return analyzeAnomalies([
      {
        label: "Cilinders deze week",
        current: currentWeekValue,
        historical: historicalWeeklyData,
      },
      {
        label: "Efficiëntie",
        current: currentYearData?.efficiency_rate || 0,
        historical: previousYearData ? [previousYearData.efficiency_rate] : [],
      },
    ], { sensitivityThreshold: 1.8, minDataPoints: 3 });
  }, [weeklyData, historicalWeeklyData, currentYearData, previousYearData]);

  const activeAnomalies = anomalies.filter(a => a.result.isAnomaly);
  const volumeAnomaly = anomalies.find(a => a.label === "Cilinders deze week")?.result;

  if (loading) {
    return (
      <Card className="glass-card animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
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
                    ? `${dateRange.from.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })} - ${dateRange.to.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' })}`
                    : currentYear
                  }
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
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0">
            <FadeIn show={true}>
              {/* Digital filter */}
              {hasDigitalTypes && (
                <div className="flex items-center gap-2 mb-4">
                  <Button
                    variant={hideDigital ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => setHideDigital(!hideDigital)}
                  >
                    ⓓ {hideDigital ? "Toon digitaal" : "Verberg digitaal"}
                  </Button>
                  {(digitalCylinders > 0 || physicalCylinders > 0) && (
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Cylinder className="h-3 w-3 text-orange-500" />
                        {formatNumber(physicalCylinders, 0)} fysiek
                      </span>
                      <span className="flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-sky-500" />
                        {formatNumber(digitalCylinders, 0)} digitaal
                      </span>
                    </div>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Efficiency Rate */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">Efficiëntie</span>
                    </div>
                    <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor(efficiencyTrend))}>
                      {getTrendIcon(efficiencyTrend)}
                      <span>{efficiencyTrend > 0 ? "+" : ""}{efficiencyTrend}%</span>
                    </div>
                  </div>
                  <div className={cn("text-3xl font-bold", getEfficiencyColor(currentYearData?.efficiency_rate || 0))}>
                    {currentYearData?.efficiency_rate || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Voltooiingspercentage orders
                  </p>
                </div>

                {/* Total Cylinders */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-orange-500" />
                      <span className="text-xs font-medium text-muted-foreground">Volume YTD</span>
                      {isCustomPeriod && (
                        <Badge variant="outline" className="text-[10px] py-0 h-4">Periode</Badge>
                      )}
                    </div>
                    <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor(volumeTrend))}>
                      {getTrendIcon(volumeTrend)}
                      <span>{volumeTrend > 0 ? "+" : ""}{volumeTrend}%</span>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-orange-500">
                    {formatNumber(hideDigital
                      ? (currentYearData?.total_cylinders || 0) - digitalCylinders
                      : (currentYearData?.total_cylinders || 0), 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hideDigital ? "Fysieke cilinders" : (isCustomPeriod ? "Cilinders in periode" : "Cilinders dit jaar")}
                  </p>
                </div>

                {/* Completion Rate */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-xs font-medium text-muted-foreground">Voltooid</span>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-green-500">
                    {formatNumber(currentYearData?.completed_orders || 0, 0)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{completionRate}%</span>
                  </div>
                </div>

                {/* Weekly Trend Sparkline */}
                <div className={cn(
                  "p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border relative",
                  volumeAnomaly?.isAnomaly
                    ? volumeAnomaly.severity === "high"
                      ? "border-destructive/40 ring-1 ring-destructive/20"
                      : "border-warning/40 ring-1 ring-warning/20"
                    : "border-blue-500/20"
                )}>
                  {volumeAnomaly?.isAnomaly && (
                    <div className="absolute top-2 right-2">
                      <AnomalyAlertBadge anomaly={volumeAnomaly} compact />
                    </div>
                  )}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="text-xs font-medium text-muted-foreground">Wekelijkse trend</span>
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
                                  <span className="font-medium">{formatNumber(payload[0].value as number, 0)} cilinders</span>
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
                  <p className="text-xs text-muted-foreground mt-1">
                    Laatste 8 weken
                  </p>
                </div>
              </div>

              {/* Additional Stats Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{formatNumber(currentYearData?.pending_orders || 0, 0)}</p>
                    <p className="text-xs text-muted-foreground">Openstaand</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{formatNumber(currentYearData?.total_orders || 0, 0)}</p>
                    <p className="text-xs text-muted-foreground">Totaal orders</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{formatNumber(currentYearData?.completed_cylinders || 0, 0)}</p>
                    <p className="text-xs text-muted-foreground">Cilinders voltooid</p>
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
