import { useState, useEffect, useMemo, lazy, Suspense, useCallback } from "react";
import { api } from "@/lib/api";

// Type definitions for RPC responses
interface DailyProductionData {
  production_date: string;
  cylinder_count: number;
  dry_ice_kg: number;
}

interface GasTypeDistributionData {
  gas_type_id: string | null;
  gas_type_name: string;
  gas_type_color: string;
  total_cylinders: number;
}

interface GasCategoryDistributionData {
  category_id: string | null;
  category_name: string;
  total_cylinders: number;
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

interface DryIceEfficiencyData {
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  efficiency_rate: number;
  total_kg: number;
  completed_kg: number;
}

interface CustomerTotalsData {
  customer_id: string | null;
  customer_name: string;
  total_cylinders: number;
  total_dry_ice_kg: number;
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart3,
  Cylinder,
  Snowflake,
  CalendarIcon,
  TrendingUp,
  Package,
  CheckCircle2,
  Clock,
  GitCompare,
  Sparkles,
} from "lucide-react";
import { ChartSkeleton, StatCardSkeleton } from "@/components/ui/skeletons";
import { StatCard } from "@/components/ui/stat-card";

// Lazy load heavy chart components
const YearComparisonReport = lazy(() => import("./YearComparisonReport").then(m => ({ default: m.YearComparisonReport })));
const CumulativeGasTypeChart = lazy(() => import("./CumulativeGasTypeChart").then(m => ({ default: m.CumulativeGasTypeChart })));
const CumulativeCylinderSizeChart = lazy(() => import("./CumulativeCylinderSizeChart").then(m => ({ default: m.CumulativeCylinderSizeChart })));
const ProductionHeatMap = lazy(() => import("./ProductionHeatMap").then(m => ({ default: m.ProductionHeatMap })));
const CustomerSegmentation = lazy(() => import("./CustomerSegmentation").then(m => ({ default: m.CustomerSegmentation })));



// Loading fallback component with skeleton
const ChartLoadingFallback = () => (
  <ChartSkeleton height={300} showLegend={false} />
);
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, differenceInDays, subDays, startOfYear, endOfYear, subYears, isSameDay, isSameMonth, isSameYear } from "date-fns";
import { nl } from "date-fns/locale";
import { cn, formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ReportExportButtons } from "./ReportExportButtons";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  Legend,
  Cell
} from "recharts";

type DateRange = {
  from: Date;
  to: Date;
};

interface GasCylinderOrder {
  id: string;
  order_number: string;
  customer_name: string;
  gas_type: string;
  gas_type_id: string | null;
  gas_grade: "medical" | "technical";
  cylinder_count: number;
  scheduled_date: string;
  status: string;
  pressure: number;
  notes: string | null;
}

interface DryIceOrder {
  id: string;
  order_number: string;
  customer_name: string;
  product_type: string;
  quantity_kg: number;
  scheduled_date: string;
  status: string;
}

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface ProductionReportsProps {
  refreshKey?: number;
  onDataChanged?: () => void;
  location?: ProductionLocation;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
}

import { getGasColor } from "@/constants/gasColors";

export function ProductionReports({
  refreshKey = 0,
  onDataChanged,
  location = "all",
  dateRange: externalDateRange,
  onDateRangeChange
}: ProductionReportsProps) {
  const [loading, setLoading] = useState(true);

  // Server-side aggregated data
  const [dailyProduction, setDailyProduction] = useState<DailyProductionData[]>([]);
  const [gasTypeDistributionData, setGasTypeDistributionData] = useState<GasTypeDistributionData[]>([]);
  const [gasCategoryDistributionData, setGasCategoryDistributionData] = useState<GasCategoryDistributionData[]>([]);
  const [cylinderEfficiency, setCylinderEfficiency] = useState<EfficiencyData | null>(null);
  const [dryIceEfficiency, setDryIceEfficiency] = useState<DryIceEfficiencyData | null>(null);
  const [prevCylinderEfficiency, setPrevCylinderEfficiency] = useState<EfficiencyData | null>(null);
  const [prevDryIceEfficiency, setPrevDryIceEfficiency] = useState<DryIceEfficiencyData | null>(null);
  const [customerTotals, setCustomerTotals] = useState<CustomerTotalsData[]>([]);

  const [internalDateRange, setInternalDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  // Use external dateRange if provided, otherwise use internal state
  const dateRange = externalDateRange || internalDateRange;
  const setDateRange = (range: DateRange) => {
    if (onDateRangeChange) {
      onDateRangeChange(range);
    } else {
      setInternalDateRange(range);
    }
  };

  const [cylinderOrders, setCylinderOrders] = useState<GasCylinderOrder[]>([]);
  const [dryIceOrders, setDryIceOrders] = useState<DryIceOrder[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [productionChartView, setProductionChartView] = useState<"both" | "cylinders" | "dryIce">("both");
  const [distributionView, setDistributionView] = useState<"type" | "category">("type");


  // Previous period stats for trend calculations
  const [previousPeriodStats, setPreviousPeriodStats] = useState({
    cylinderOrders: 0,
    totalCylinders: 0,
    dryIceOrders: 0,
    totalDryIce: 0,
    completed: 0,
    pending: 0
  });

  // Determine if dry ice should be shown (only for Emmen or All)
  const showDryIce = location !== "sol_tilburg";

  useEffect(() => {
    fetchReportData();
  }, [dateRange, refreshKey, location]);

  const fetchReportData = async () => {
    setLoading(true);

    try {
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      // Calculate previous period (same length, immediately before)
      const periodLength = differenceInDays(dateRange.to, dateRange.from);
      const prevTo = subDays(dateRange.from, 1);
      const prevFrom = subDays(prevTo, periodLength);
      const prevFromDate = format(prevFrom, "yyyy-MM-dd");
      const prevToDate = format(prevTo, "yyyy-MM-dd");

      console.log("[ProductionReports] Fetching data for period:", { fromDate, toDate, location });

      const locationParam = location === "all" ? null : location;

      // Helper to match Supabase RPC response structure { data, error }
      const fetchSafely = async (fn: () => Promise<any>) => {
        try {
          const data = await fn();
          return { data, error: null };
        } catch (error) {
          return { data: null, error };
        }
      };

      // Fetch all data in parallel using api.reports
      const [
        dailyRes,
        gasTypeRes,
        cylinderEffRes,
        dryIceEffRes,
        prevCylinderEffRes,
        prevDryIceEffRes,
        customerTotalsRes,
        gasCategoryRes
      ] = await Promise.all([
        // Daily production data for charts
        fetchSafely(() => api.reports.getDailyProductionByPeriod(fromDate, toDate, locationParam)),
        // Gas type distribution
        fetchSafely(() => api.reports.getGasTypeDistribution(fromDate, toDate, locationParam)),
        // Current period efficiency stats (cylinders)
        fetchSafely(() => api.reports.getProductionEfficiency(fromDate, toDate, locationParam)),
        // Current period efficiency stats (dry ice)
        fetchSafely(() => api.reports.getDryIceEfficiency(fromDate, toDate, locationParam)),
        // Previous period efficiency (cylinders)
        fetchSafely(() => api.reports.getProductionEfficiency(prevFromDate, prevToDate, locationParam)),
        // Previous period efficiency (dry ice)
        fetchSafely(() => api.reports.getDryIceEfficiency(prevFromDate, prevToDate, locationParam)),
        // Customer totals for ranking
        fetchSafely(() => api.reports.getCustomerTotals(fromDate, toDate, locationParam)),
        // Gas category distribution
        fetchSafely(() => api.reports.getGasCategoryDistribution(fromDate, toDate, locationParam))
      ]);

      // Set data
      setDailyProduction(dailyRes.data || []);
      setGasTypeDistributionData(gasTypeRes.data || []);
      setGasCategoryDistributionData((gasCategoryRes.data as any) || []);
      setCustomerTotals(customerTotalsRes.data || []);

      // Set current period efficiency data
      const cylEff = cylinderEffRes.data?.[0] || null;
      const dryIceEff = dryIceEffRes.data?.[0] || null;
      setCylinderEfficiency(cylEff);
      setDryIceEfficiency(dryIceEff);

      // Set previous period efficiency data
      const prevCylEff = prevCylinderEffRes.data?.[0] || null;
      const prevDryIceEff = prevDryIceEffRes.data?.[0] || null;
      setPrevCylinderEfficiency(prevCylEff);
      setPrevDryIceEfficiency(prevDryIceEff);

      // Calculate previous period stats for trend calculations
      setPreviousPeriodStats({
        cylinderOrders: prevCylEff?.total_orders || 0,
        totalCylinders: prevCylEff?.total_cylinders || 0,
        dryIceOrders: prevDryIceEff?.total_orders || 0,
        totalDryIce: prevDryIceEff?.total_kg || 0,
        completed: (prevCylEff?.completed_orders || 0) + (prevDryIceEff?.completed_orders || 0),
        pending: (prevCylEff?.pending_orders || 0) + (prevDryIceEff?.pending_orders || 0)
      });

      // Clear individual orders (no longer needed for overview statistics)
      setCylinderOrders([]);
      setDryIceOrders([]);
    } catch (error) {
      console.error("[ProductionReports] Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to calculate trend percentage
  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const setPresetRange = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case "week":
        setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) });
        break;
      case "month":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case "last-month":
        const lastMonth = subMonths(now, 1);
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        break;
      case "quarter":
        setDateRange({ from: subMonths(startOfMonth(now), 2), to: endOfMonth(now) });
        break;
      case "last-year":
        const lastYear = subYears(now, 1);
        setDateRange({ from: startOfYear(lastYear), to: endOfYear(lastYear) });
        break;
      case "this-year":
        setDateRange({ from: startOfYear(now), to: endOfYear(now) });
        break;
    }
  };

  const getActivePreset = (): string => {
    const now = new Date();
    const { from, to } = dateRange;

    if (isSameDay(from, startOfWeek(now, { weekStartsOn: 1 })) && isSameDay(to, endOfWeek(now, { weekStartsOn: 1 }))) return "week";
    if (isSameDay(from, startOfMonth(now)) && isSameDay(to, endOfMonth(now))) return "month";
    const lastMonth = subMonths(now, 1);
    if (isSameDay(from, startOfMonth(lastMonth)) && isSameDay(to, endOfMonth(lastMonth))) return "last-month";
    if (isSameDay(from, subMonths(startOfMonth(now), 2)) && isSameDay(to, endOfMonth(now))) return "quarter";

    // Last year
    const lastYear = subYears(now, 1);
    if (isSameDay(from, startOfYear(lastYear)) && isSameDay(to, endOfYear(lastYear))) return "last-year";

    // This year
    if (isSameDay(from, startOfYear(now)) && isSameDay(to, endOfYear(now))) return "this-year";

    return "";
  };

  // Calculate statistics from RPC data
  const cylinderStats = useMemo(() => ({
    total: cylinderEfficiency?.total_orders || 0,
    completed: cylinderEfficiency?.completed_orders || 0,
    pending: cylinderEfficiency?.pending_orders || 0,
    inProgress: 0,
    cancelled: cylinderEfficiency?.cancelled_orders || 0,
    totalCylinders: cylinderEfficiency?.total_cylinders || 0
  }), [cylinderEfficiency]);

  const dryIceStats = useMemo(() => ({
    total: dryIceEfficiency?.total_orders || 0,
    completed: dryIceEfficiency?.completed_orders || 0,
    pending: dryIceEfficiency?.pending_orders || 0,
    inProgress: 0,
    cancelled: dryIceEfficiency?.cancelled_orders || 0,
    totalKg: dryIceEfficiency?.total_kg || 0
  }), [dryIceEfficiency]);

  // Prepare chart data from RPC response
  const ordersPerDay = useMemo(() => {
    return dailyProduction.map(item => ({
      date: item.production_date,
      cylinders: Number(item.cylinder_count) || 0,
      dryIce: Number(item.dry_ice_kg) || 0,
      displayDate: format(new Date(item.production_date), "d MMM", { locale: nl })
    }));
  }, [dailyProduction]);

  // Gas type distribution from RPC (already aggregated)
  const gasTypeDistribution = useMemo(() => {
    return gasTypeDistributionData.map(item => {
      // Robust lookup: fast exact match, then case-insensitive
      const name = item.gas_type_name || "";
      const color = getGasColor(name, item.gas_type_color || "#8b5cf6");

      return {
        name: item.gas_type_name,
        value: Number(item.total_cylinders) || 0,
        color
      };
    });
  }, [gasTypeDistributionData]);

  // Gas category distribution from RPC (already aggregated)
  const gasCategoryDistribution = useMemo(() => {
    return gasCategoryDistributionData.map(item => ({
      name: item.category_name,
      value: Number(item.total_cylinders) || 0,
      color: "#8b5cf6" // Default color for categories (purple)
    }));
  }, [gasCategoryDistributionData]);

  // Determine which distribution data to show
  const currentDistributionData = distributionView === "type" ? gasTypeDistribution : gasCategoryDistribution;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-14 w-full bg-muted/20 animate-pulse rounded-lg" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton count={4} />
        </div>
        <ChartSkeleton height={350} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compact Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card/60 backdrop-blur-md border rounded-lg p-2 shadow-sm sticky top-0 z-10">
        <div className="flex flex-wrap items-center gap-2">
          <ToggleGroup type="single" variant="outline" size="sm" value={getActivePreset()} onValueChange={(val) => val && setPresetRange(val)} className="hidden lg:flex">
            <ToggleGroupItem value="week">Deze week</ToggleGroupItem>
            <ToggleGroupItem value="month">Deze maand</ToggleGroupItem>
            <ToggleGroupItem value="last-month">Vorige maand</ToggleGroupItem>
            <ToggleGroupItem value="quarter">Kwartaal</ToggleGroupItem>
            <ToggleGroupItem value="last-year">Vorig jaar</ToggleGroupItem>
            <ToggleGroupItem value="this-year">Jaar</ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-2 bg-background border rounded-md px-2 py-1 h-9">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-transparent">
                  <span className="text-sm font-medium">{format(dateRange.from, "d MMM", { locale: nl })}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateRange.from} onSelect={(d) => d && setDateRange({ ...dateRange, from: d })} locale={nl} />
              </PopoverContent>
            </Popover>
            <span className="text-muted-foreground">-</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 px-2 hover:bg-transparent">
                  <span className="text-sm font-medium">{format(dateRange.to, "d MMM", { locale: nl })}</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={dateRange.to} onSelect={(d) => d && setDateRange({ ...dateRange, to: d })} locale={nl} />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ReportExportButtons
            tableData={{
              title: "Productie Rapport",
              subtitle: `Cilinders en Droogijs overzicht`,
              columns: [
                { header: "Datum", key: "date", width: 12 },
                { header: "Klant", key: "customer", width: 25 },
                { header: "Type", key: "type", width: 12 },
                { header: "Aantal/Kg", key: "quantity", width: 10 },
                { header: "Status", key: "status", width: 12 },
              ],
              rows: [], // Export functionality might need update if row data is needed, currently simplified
              dateRange: { from: dateRange.from, to: dateRange.to },
              location: location === "all" ? "Alle locaties" : location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg",
            }}
            chartElementId="production-chart"
            chartTitle="Productie Grafiek"
            chartOptions={{
              dateRange: { from: dateRange.from, to: dateRange.to },
              location: location === "all" ? "Alle locaties" : location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg",
            }}
          />
        </div>
      </div>

      {/* Primary KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <StatCard
          value={formatNumber(cylinderStats.total, 0)}
          label="Cilinder orders"
          icon={<Cylinder className="h-4 w-4 text-orange-500" />}
          iconBgColor="bg-orange-500/10"
          trend={{
            value: calculateTrend(cylinderStats.total, previousPeriodStats.cylinderOrders),
            label: "vs. periode"
          }}
          className="border-orange-500/20 shadow-sm"
        />

        <StatCard
          value={formatNumber(cylinderStats.totalCylinders, 0)}
          label="Totaal cilinders"
          icon={<Package className="h-4 w-4 text-orange-500" />}
          iconBgColor="bg-orange-500/10"
          trend={{
            value: calculateTrend(cylinderStats.totalCylinders, previousPeriodStats.totalCylinders),
            label: "vs. periode"
          }}
          className="border-orange-500/20 shadow-sm"
        />

        {showDryIce && (
          <>
            <StatCard
              value={formatNumber(dryIceStats.total, 0)}
              label="Droogijs orders"
              icon={<Snowflake className="h-4 w-4 text-cyan-500" />}
              iconBgColor="bg-cyan-500/10"
              trend={{
                value: calculateTrend(dryIceStats.total, previousPeriodStats.dryIceOrders),
                label: "vs. periode"
              }}
              className="border-cyan-500/20 shadow-sm"
            />

            <StatCard
              value={`${formatNumber(dryIceStats.totalKg, 0)} kg`}
              label="Totaal droogijs"
              icon={<TrendingUp className="h-4 w-4 text-cyan-500" />}
              iconBgColor="bg-cyan-500/10"
              trend={{
                value: calculateTrend(dryIceStats.totalKg, previousPeriodStats.totalDryIce),
                label: "vs. periode"
              }}
              className="border-cyan-500/20 shadow-sm"
            />
          </>
        )}

        <StatCard
          value={formatNumber(cylinderStats.completed + dryIceStats.completed, 0)}
          label="Voltooid"
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          iconBgColor="bg-green-500/10"
          trend={{
            value: calculateTrend(cylinderStats.completed + dryIceStats.completed, previousPeriodStats.completed),
            label: "vs. periode"
          }}
          className="border-green-500/20 shadow-sm"
        />

        <StatCard
          value={formatNumber(cylinderStats.pending + dryIceStats.pending, 0)}
          label="Gepland"
          icon={<Clock className="h-4 w-4 text-yellow-500" />}
          iconBgColor="bg-yellow-500/10"
          trend={{
            value: calculateTrend(cylinderStats.pending + dryIceStats.pending, previousPeriodStats.pending),
            label: "vs. periode"
          }}
          className="border-yellow-500/20 shadow-sm"
        />
      </div>

      {/* Detailed Tabs & Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-4xl grid-cols-6 bg-muted/50 backdrop-blur-sm h-9">
          <TabsTrigger value="overview" className="text-xs">
            <BarChart3 className="h-3 w-3 mr-2" />
            <span className="hidden sm:inline">Dashboard</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="text-xs">
            <Sparkles className="h-3 w-3 mr-2" />
            <span className="hidden sm:inline">Insights</span>
          </TabsTrigger>
          <TabsTrigger value="cylinders" className="text-xs">
            <Cylinder className="h-3 w-3 mr-2" />
            <span className="hidden sm:inline">Cilinders</span>
          </TabsTrigger>
          {showDryIce && (
            <TabsTrigger value="dryice" className="text-xs">
              <Snowflake className="h-3 w-3 mr-2" />
              <span className="hidden sm:inline">Droogijs</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="comparison" className="text-xs">
            <GitCompare className="h-3 w-3 mr-2" />
            <span className="hidden sm:inline">Vergelijking</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Chart - Spans 2 cols */}
            <Card className="lg:col-span-2 shadow-sm" id="production-chart">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Productie per dag</CardTitle>
                <ToggleGroup type="single" value={productionChartView} onValueChange={(v) => v && setProductionChartView(v as any)} size="sm">
                  <ToggleGroupItem value="both" size="sm" className="h-7 text-xs">Beide</ToggleGroupItem>
                  <ToggleGroupItem value="cylinders" size="sm" className="h-7 text-xs">Cilinders</ToggleGroupItem>
                  {showDryIce && <ToggleGroupItem value="dryIce" size="sm" className="h-7 text-xs">Droogijs</ToggleGroupItem>}
                </ToggleGroup>
              </CardHeader>
              <CardContent>
                {ordersPerDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={ordersPerDay}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="displayDate" className="text-xs" tickLine={false} axisLine={false} />
                      <YAxis className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} tickLine={false} axisLine={false} />
                      <Tooltip />
                      <Legend />
                      {(productionChartView === "both" || productionChartView === "cylinders") && (
                        <Line type="monotone" dataKey="cylinders" name="Cilinders" stroke="#f97316" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      )}
                      {(productionChartView === "both" || productionChartView === "dryIce") && (
                        <Line type="monotone" dataKey="dryIce" name="Droogijs" stroke="#06b6d4" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">Geen data</div>
                )}
              </CardContent>
            </Card>

            {/* Distribution Chart - Spans 1 col */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Verdeling</CardTitle>
                <ToggleGroup type="single" value={distributionView} onValueChange={(v) => v && setDistributionView(v as any)} size="sm">
                  <ToggleGroupItem value="type" size="sm" className="h-7 text-xs">Type</ToggleGroupItem>
                  <ToggleGroupItem value="category" size="sm" className="h-7 text-xs">Cat</ToggleGroupItem>
                </ToggleGroup>
              </CardHeader>
              <CardContent>
                {currentDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={currentDistributionData} layout="vertical" margin={{ left: 10, right: 10 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={100} className="text-[10px]" tickLine={false} axisLine={false} interval={0} />
                      <Tooltip cursor={{ fill: 'transparent' }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {currentDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground">Geen data</div>
                )}
              </CardContent>
            </Card>

            {/* Additional Widgets Row could go here */}
          </div>
        </TabsContent>

        {/* Other tabs content placeholders (using existing components) */}
        <TabsContent value="insights" className="mt-4">
          <Suspense fallback={<ChartLoadingFallback />}>
            <CustomerSegmentation
              location={location}
              refreshKey={refreshKey}
              dateRange={dateRange}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="cylinders" className="mt-4 space-y-4">
          <Suspense fallback={<ChartLoadingFallback />}>
            <CumulativeGasTypeChart
              location={location === "all" ? undefined : location}
            />
            <CumulativeCylinderSizeChart
              location={location === "all" ? undefined : location}
            />
            <ProductionHeatMap
              location={location}
              refreshKey={refreshKey}
              dateRange={dateRange}
            />
          </Suspense>
        </TabsContent>

        {showDryIce && (
          <TabsContent value="dryice" className="mt-4">
            <div className="text-center py-8 text-muted-foreground">Gedetailleerde droogijs rapportage volgt.</div>
          </TabsContent>
        )}

        <TabsContent value="comparison" className="mt-4">
          <Suspense fallback={<ChartLoadingFallback />}>
            <YearComparisonReport location={location === "all" ? null : location} />
          </Suspense>
        </TabsContent>

      </Tabs>
    </div>
  );
}
