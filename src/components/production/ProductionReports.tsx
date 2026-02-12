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
  XCircle,
  GitCompare,
  Sparkles,
  AreaChartIcon,
  Map as MapIcon
} from "lucide-react";
// import { GlowLineChart } from "@/components/ui/glow-line-chart";
// import { RoundedBarChart } from "@/components/ui/rounded-bar-chart";
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
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, differenceInDays, subDays, startOfYear, endOfYear, subYears } from "date-fns";
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
  Cell,
  Legend
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

import { GAS_COLOR_MAPPING, getGasColor } from "@/constants/gasColors";

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

      // Log responses for debugging
      console.log("[ProductionReports] Daily production:", dailyRes.data?.length || 0, "days");
      console.log("[ProductionReports] Gas type distribution:", gasTypeRes.data?.length || 0, "types");
      console.log("[ProductionReports] Cylinder efficiency:", cylinderEffRes.data);
      console.log("[ProductionReports] Dry ice efficiency:", dryIceEffRes.data);
      console.log("[ProductionReports] Customer totals:", customerTotalsRes.data?.length || 0, "customers");

      // Handle errors
      if (dailyRes.error) console.error("[ProductionReports] Daily production error:", dailyRes.error);
      if (gasTypeRes.error) console.error("[ProductionReports] Gas type distribution error:", gasTypeRes.error);
      if (cylinderEffRes.error) console.error("[ProductionReports] Cylinder efficiency error:", cylinderEffRes.error);
      if (dryIceEffRes.error) console.error("[ProductionReports] Dry ice efficiency error:", dryIceEffRes.error);
      if (customerTotalsRes.error) console.error("[ProductionReports] Customer totals error:", customerTotalsRes.error);
      if (gasCategoryRes.error) console.error("[ProductionReports] Gas category distribution error:", gasCategoryRes.error);

      // Set daily production data
      setDailyProduction(dailyRes.data || []);

      // Set gas type distribution
      setGasTypeDistributionData(gasTypeRes.data || []);

      // Set gas category distribution
      setGasCategoryDistributionData((gasCategoryRes.data as any) || []);

      // Set customer totals
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

  // Customer ranking from RPC data
  const cylinderCustomerRanking = useMemo(() => {
    return customerTotals
      .filter(c => c.total_cylinders > 0)
      .sort((a, b) => Number(b.total_cylinders) - Number(a.total_cylinders))
      .slice(0, 5)
      .map(c => ({
        name: c.customer_name,
        value: Number(c.total_cylinders)
      }));
  }, [customerTotals]);

  const dryIceCustomerRanking = useMemo(() => {
    return customerTotals
      .filter(c => c.total_dry_ice_kg > 0)
      .sort((a, b) => Number(b.total_dry_ice_kg) - Number(a.total_dry_ice_kg))
      .slice(0, 5)
      .map(c => ({
        name: c.customer_name,
        value: Number(c.total_dry_ice_kg)
      }));
  }, [customerTotals]);

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Gepland" },
      in_progress: { variant: "default", label: "Bezig" },
      completed: { variant: "outline", label: "Voltooid" },
      cancelled: { variant: "destructive", label: "Geannuleerd" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <ChartSkeleton height={80} showLegend={false} />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton count={4} />
        </div>
        <ChartSkeleton height={350} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Range Selector */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Rapportageperiode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPresetRange("week")}>
                  Deze week
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPresetRange("month")}>
                  Deze maand
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPresetRange("last-month")}>
                  Vorige maand
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPresetRange("quarter")}>
                  Laatste 3 maanden
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPresetRange("this-year")}>
                  Dit jaar
                </Button>
                <Button variant="outline" size="sm" onClick={() => setPresetRange("last-year")}>
                  Vorig jaar
                </Button>
              </div>

              {/* Export Button */}
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
                  rows: [
                    ...cylinderOrders.map(o => ({
                      date: format(new Date(o.scheduled_date), "dd-MM-yyyy"),
                      customer: o.customer_name,
                      type: "Cilinders",
                      quantity: formatNumber(o.cylinder_count, 0),
                      status: o.status === "completed" ? "Voltooid" : o.status === "pending" ? "Gepland" : o.status,
                    })),
                    ...dryIceOrders.map(o => ({
                      date: format(new Date(o.scheduled_date), "dd-MM-yyyy"),
                      customer: o.customer_name,
                      type: "Droogijs",
                      quantity: `${formatNumber(o.quantity_kg, 0)} kg`,
                      status: o.status === "completed" ? "Voltooid" : o.status === "pending" ? "Gepland" : o.status,
                    })),
                  ].sort((a, b) => a.date.localeCompare(b.date)),
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
              <div className="flex items-center gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {format(dateRange.from, "d MMM", { locale: nl })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => date && setDateRange({ ...dateRange, from: date })}
                      locale={nl}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <span className="text-muted-foreground">t/m</span>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm">
                      <CalendarIcon className="h-4 w-4 mr-2" />
                      {format(dateRange.to, "d MMM", { locale: nl })}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => date && setDateRange({ ...dateRange, to: date })}
                      locale={nl}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        <StatCard
          value={formatNumber(cylinderStats.total, 0)}
          label="Cilinder orders"
          icon={<Cylinder className="h-5 w-5 text-orange-500" />}
          iconBgColor="bg-orange-500/10"
          trend={{
            value: calculateTrend(cylinderStats.total, previousPeriodStats.cylinderOrders),
            label: "vs. vorige periode"
          }}
          className="glass-card border-orange-500/20"
        />

        <StatCard
          value={formatNumber(cylinderStats.totalCylinders, 0)}
          label="Totaal cilinders"
          icon={<Package className="h-5 w-5 text-orange-500" />}
          iconBgColor="bg-orange-500/10"
          trend={{
            value: calculateTrend(cylinderStats.totalCylinders, previousPeriodStats.totalCylinders),
            label: "vs. vorige periode"
          }}
          className="glass-card border-orange-500/20"
        />

        {showDryIce && (
          <>
            <StatCard
              value={formatNumber(dryIceStats.total, 0)}
              label="Droogijs orders"
              icon={<Snowflake className="h-5 w-5 text-cyan-500" />}
              iconBgColor="bg-cyan-500/10"
              trend={{
                value: calculateTrend(dryIceStats.total, previousPeriodStats.dryIceOrders),
                label: "vs. vorige periode"
              }}
              className="glass-card border-cyan-500/20"
            />

            <StatCard
              value={`${formatNumber(dryIceStats.totalKg, 0)} kg`}
              label="Totaal droogijs"
              icon={<TrendingUp className="h-5 w-5 text-cyan-500" />}
              iconBgColor="bg-cyan-500/10"
              trend={{
                value: calculateTrend(dryIceStats.totalKg, previousPeriodStats.totalDryIce),
                label: "vs. vorige periode"
              }}
              className="glass-card border-cyan-500/20"
            />
          </>
        )}

        <StatCard
          value={formatNumber(cylinderStats.completed + dryIceStats.completed, 0)}
          label="Voltooid"
          icon={<CheckCircle2 className="h-5 w-5 text-green-500" />}
          iconBgColor="bg-green-500/10"
          trend={{
            value: calculateTrend(cylinderStats.completed + dryIceStats.completed, previousPeriodStats.completed),
            label: "vs. vorige periode"
          }}
          className="glass-card border-green-500/20"
        />

        <StatCard
          value={formatNumber(cylinderStats.pending + dryIceStats.pending, 0)}
          label="Gepland"
          icon={<Clock className="h-5 w-5 text-yellow-500" />}
          iconBgColor="bg-yellow-500/10"
          trend={{
            value: calculateTrend(cylinderStats.pending + dryIceStats.pending, previousPeriodStats.pending),
            label: "vs. vorige periode"
          }}
          className="glass-card border-yellow-500/20"
        />
      </div>

      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-4xl grid-cols-6 bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Overzicht</span>
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            <span className="hidden sm:inline">Insights</span>
          </TabsTrigger>
          <TabsTrigger value="cylinders" className="flex items-center gap-2">
            <Cylinder className="h-4 w-4" />
            <span className="hidden sm:inline">Cilinders</span>
          </TabsTrigger>
          {showDryIce && (
            <TabsTrigger value="dryice" className="flex items-center gap-2">
              <Snowflake className="h-4 w-4" />
              <span className="hidden sm:inline">Droogijs</span>
            </TabsTrigger>
          )}
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            <span className="hidden sm:inline">Jaarvergelijking</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Production Chart */}
          <Card className="glass-card" id="production-chart">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg">Productie per dag</CardTitle>
                <CardDescription>
                  {productionChartView === "both" && "Overzicht van cilinders en droogijs orders"}
                  {productionChartView === "cylinders" && "Overzicht van cilinder orders"}
                  {productionChartView === "dryIce" && "Overzicht van droogijs orders"}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">


                {/* Data View Toggle */}
                <ToggleGroup
                  type="single"
                  value={productionChartView}
                  onValueChange={(value) => value && setProductionChartView(value as "both" | "cylinders" | "dryIce")}
                  className="bg-muted/50 rounded-md p-1"
                >
                  {showDryIce && (
                    <ToggleGroupItem value="both" aria-label="Beide" className="text-xs px-3 data-[state=on]:bg-background">
                      Beide
                    </ToggleGroupItem>
                  )}
                  <ToggleGroupItem value="cylinders" aria-label="Cilinders" className="text-xs px-3 data-[state=on]:bg-orange-500 data-[state=on]:text-white">
                    <Cylinder className="h-3 w-3 mr-1" />
                    Cilinders
                  </ToggleGroupItem>
                  {showDryIce && (
                    <ToggleGroupItem value="dryIce" aria-label="Droogijs" className="text-xs px-3 data-[state=on]:bg-cyan-500 data-[state=on]:text-white">
                      <Snowflake className="h-3 w-3 mr-1" />
                      Droogijs
                    </ToggleGroupItem>
                  )}
                </ToggleGroup>
              </div>
            </CardHeader>
            <CardContent>
              {ordersPerDay.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={ordersPerDay}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted/40" />
                    <XAxis dataKey="displayDate" className="text-xs" tickLine={false} axisLine={false} />
                    <YAxis className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255, 255, 255, 0.8)',
                        borderRadius: '12px',
                        border: '1px solid rgba(200, 200, 200, 0.3)',
                        boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                        backdropFilter: 'blur(10px)'
                      }}
                      itemStyle={{ color: '#333' }}
                      labelStyle={{ fontWeight: 'bold', color: '#666', marginBottom: '0.5rem' }}
                    />
                    <Legend />
                    {(productionChartView === "both" || productionChartView === "cylinders") && (
                      <Line
                        type="monotone"
                        dataKey="cylinders"
                        name="Cilinders"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#f97316" }}
                        activeDot={{ r: 6 }}
                      />
                    )}
                    {(productionChartView === "both" || productionChartView === "dryIce") && (
                      <Line
                        type="monotone"
                        dataKey="dryIce"
                        name="Droogijs (kg)"
                        stroke="#06b6d4"
                        strokeWidth={2}
                        dot={{ r: 4, fill: "#06b6d4" }}
                        activeDot={{ r: 6 }}
                      />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  Geen data voor deze periode
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gas Type Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="glass-card">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div>
                  <CardTitle className="text-lg">
                    {distributionView === "type" ? "Gastype verdeling" : "Categorie verdeling"}
                  </CardTitle>
                  <CardDescription>Aantal cilinders per {distributionView === "type" ? "gastype" : "categorie"}</CardDescription>
                </div>
                <ToggleGroup
                  type="single"
                  value={distributionView}
                  onValueChange={(val) => val && setDistributionView(val as "type" | "category")}
                  className="bg-muted/50 rounded-md p-1"
                >
                  <ToggleGroupItem value="type" className="text-xs px-2 h-7" aria-label="Gastype">Type</ToggleGroupItem>
                  <ToggleGroupItem value="category" className="text-xs px-2 h-7" aria-label="Categorie">Cat</ToggleGroupItem>
                </ToggleGroup>
              </CardHeader>
              <CardContent>
                {currentDistributionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(300, currentDistributionData.length * 40)}>
                    <BarChart data={currentDistributionData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-muted/40" />
                      <XAxis type="number" className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" width={100} className="text-xs font-medium" tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{
                          backgroundColor: 'rgba(255, 255, 255, 0.9)',
                          borderRadius: '8px',
                          border: 'none',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value: number) => [formatNumber(value, 0), "Cilinders"]}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={24}>
                        {currentDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Geen data voor deze periode
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Top 5 klanten - Cilinders</CardTitle>
                <CardDescription>Klanten met de meeste cilinder orders</CardDescription>
              </CardHeader>
              <CardContent>
                {cylinderCustomerRanking.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={cylinderCustomerRanking} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} />
                      <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))'
                        }}
                        formatter={(value: number) => [formatNumber(value, 0), "Cilinders"]}
                      />
                      <Bar dataKey="value" name="Cilinders" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Geen data voor deze periode
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cylinders" className="mt-6 space-y-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Cylinder className="h-5 w-5 text-orange-500" />
                Cilinder vulorders
              </CardTitle>
              <CardDescription>
                {cylinderStats.total} orders | {cylinderStats.totalCylinders} cilinders totaal
              </CardDescription>
            </CardHeader>
            <CardContent>
              {/* Summary statistics - individual orders replaced by server-side aggregation */}
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-foreground">{formatNumber(cylinderStats.total, 0)}</div>
                    <div className="text-sm text-muted-foreground">Totaal orders</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-2xl font-bold text-foreground">{formatNumber(cylinderStats.totalCylinders, 0)}</div>
                    <div className="text-sm text-muted-foreground">Totaal cilinders</div>
                  </div>
                  <div className="p-4 rounded-lg bg-green-500/10">
                    <div className="text-2xl font-bold text-green-600">{formatNumber(cylinderStats.completed, 0)}</div>
                    <div className="text-sm text-muted-foreground">Voltooid</div>
                  </div>
                  <div className="p-4 rounded-lg bg-yellow-500/10">
                    <div className="text-2xl font-bold text-yellow-600">{formatNumber(cylinderStats.pending, 0)}</div>
                    <div className="text-sm text-muted-foreground">Gepland</div>
                  </div>
                </div>

                {/* Gas type breakdown from RPC */}
                <div className="pt-4">
                  <h4 className="text-sm font-medium mb-3">Verdeling per gastype</h4>
                  {gasTypeDistribution.length > 0 ? (
                    <div className="space-y-2">
                      {gasTypeDistribution.map((item, index) => (
                        <div key={index} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: item.color }}
                            />
                            <span className="text-sm">{item.name}</span>
                          </div>
                          <span className="font-medium">{formatNumber(item.value, 0)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      Geen data beschikbaar
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {showDryIce && (
          <TabsContent value="dryice" className="mt-6 space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Snowflake className="h-5 w-5 text-cyan-500" />
                  Droogijs orders
                </CardTitle>
                <CardDescription>
                  {dryIceStats.total} orders | {formatNumber(dryIceStats.totalKg, 0)} kg totaal
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Summary statistics - individual orders replaced by server-side aggregation */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold text-foreground">{formatNumber(dryIceStats.total, 0)}</div>
                      <div className="text-sm text-muted-foreground">Totaal orders</div>
                    </div>
                    <div className="p-4 rounded-lg bg-muted/50">
                      <div className="text-2xl font-bold text-foreground">{formatNumber(dryIceStats.totalKg, 0)} kg</div>
                      <div className="text-sm text-muted-foreground">Totaal droogijs</div>
                    </div>
                    <div className="p-4 rounded-lg bg-green-500/10">
                      <div className="text-2xl font-bold text-green-600">{formatNumber(dryIceStats.completed, 0)}</div>
                      <div className="text-sm text-muted-foreground">Voltooid</div>
                    </div>
                    <div className="p-4 rounded-lg bg-yellow-500/10">
                      <div className="text-2xl font-bold text-yellow-600">{formatNumber(dryIceStats.pending, 0)}</div>
                      <div className="text-sm text-muted-foreground">Gepland</div>
                    </div>
                  </div>

                  {dryIceEfficiency && (
                    <div className="pt-4">
                      <div className="flex items-center justify-between py-3 px-4 rounded-lg bg-cyan-500/10">
                        <span className="text-sm text-muted-foreground">Efficiency rate</span>
                        <span className="text-lg font-bold text-cyan-600">{dryIceEfficiency.efficiency_rate}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Top customers for dry ice */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Top 5 klanten - Droogijs</CardTitle>
                <CardDescription>Klanten met de meeste droogijs orders (kg)</CardDescription>
              </CardHeader>
              <CardContent>
                {dryIceCustomerRanking.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dryIceCustomerRanking} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} />
                      <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))'
                        }}
                        formatter={(value: number) => [formatNumber(value, 0), "Droogijs (kg)"]}
                      />
                      <Bar dataKey="value" name="Droogijs (kg)" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-12 text-muted-foreground">
                    Geen data voor deze periode
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}

        <TabsContent value="insights" className="mt-6 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Suspense fallback={<ChartLoadingFallback />}>
              <ProductionHeatMap location={location} refreshKey={refreshKey} dateRange={dateRange} />
            </Suspense>
            <Suspense fallback={<ChartLoadingFallback />}>
              <CustomerSegmentation location={location} refreshKey={refreshKey} year={dateRange.from.getFullYear()} />
            </Suspense>
          </div>
        </TabsContent>

        <TabsContent value="comparison" className="mt-6 space-y-6">
          <Suspense fallback={<ChartLoadingFallback />}>
            <YearComparisonReport location={location} />
          </Suspense>
          <Suspense fallback={<ChartLoadingFallback />}>
            <CumulativeGasTypeChart location={location} />
          </Suspense>
          <Suspense fallback={<ChartLoadingFallback />}>
            <CumulativeCylinderSizeChart location={location} />
          </Suspense>
          <Suspense fallback={<ChartLoadingFallback />}>
            <CumulativeCylinderSizeChart location={location} />
          </Suspense>
        </TabsContent>



      </Tabs>
    </div>
  );
}
