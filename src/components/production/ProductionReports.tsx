import { useState, useEffect, useMemo, lazy, Suspense, useCallback } from "react";

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
import { GlowLineChart } from "@/components/ui/glow-line-chart";
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
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ReportExportButtons } from "./ReportExportButtons";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
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
  const [chartStyle, setChartStyle] = useState<"area" | "glow">("area");

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

     console.log("[ProductionReports] Fetching RPC data for period:", { fromDate, toDate, location });
     
     const locationParam = location === "all" ? null : location;

     // Fetch all data in parallel using RPC calls
     const [
       dailyRes,
       gasTypeRes,
       cylinderEffRes,
       dryIceEffRes,
       prevCylinderEffRes,
       prevDryIceEffRes,
       customerTotalsRes
     ] = await Promise.all([
       // Daily production data for charts
       supabase.rpc("get_daily_production_by_period", {
         p_from_date: fromDate,
         p_to_date: toDate,
         p_location: locationParam
       }),
       // Gas type distribution
       supabase.rpc("get_gas_type_distribution_by_period", {
         p_from_date: fromDate,
         p_to_date: toDate,
         p_location: locationParam
       }),
       // Current period efficiency stats (cylinders)
       supabase.rpc("get_production_efficiency_by_period", {
         p_from_date: fromDate,
         p_to_date: toDate,
         p_location: locationParam
       }),
       // Current period efficiency stats (dry ice)
       supabase.rpc("get_dry_ice_efficiency_by_period", {
         p_from_date: fromDate,
         p_to_date: toDate,
         p_location: locationParam
       }),
       // Previous period efficiency (cylinders)
       supabase.rpc("get_production_efficiency_by_period", {
         p_from_date: prevFromDate,
         p_to_date: prevToDate,
         p_location: locationParam
       }),
       // Previous period efficiency (dry ice)
       supabase.rpc("get_dry_ice_efficiency_by_period", {
         p_from_date: prevFromDate,
         p_to_date: prevToDate,
         p_location: locationParam
       }),
       // Customer totals for ranking
       supabase.rpc("get_customer_totals_by_period", {
         p_from_date: fromDate,
         p_to_date: toDate,
         p_location: locationParam
       })
     ]);

     // Log RPC responses for debugging
     console.log("[ProductionReports] Daily production RPC:", dailyRes.data?.length || 0, "days");
     console.log("[ProductionReports] Gas type distribution RPC:", gasTypeRes.data?.length || 0, "types");
     console.log("[ProductionReports] Cylinder efficiency RPC:", cylinderEffRes.data);
     console.log("[ProductionReports] Dry ice efficiency RPC:", dryIceEffRes.data);
     console.log("[ProductionReports] Customer totals RPC:", customerTotalsRes.data?.length || 0, "customers");

     // Handle errors
     if (dailyRes.error) console.error("[ProductionReports] Daily production RPC error:", dailyRes.error);
     if (gasTypeRes.error) console.error("[ProductionReports] Gas type distribution RPC error:", gasTypeRes.error);
     if (cylinderEffRes.error) console.error("[ProductionReports] Cylinder efficiency RPC error:", cylinderEffRes.error);
     if (dryIceEffRes.error) console.error("[ProductionReports] Dry ice efficiency RPC error:", dryIceEffRes.error);
     if (customerTotalsRes.error) console.error("[ProductionReports] Customer totals RPC error:", customerTotalsRes.error);

     // Set daily production data
     setDailyProduction(dailyRes.data || []);

     // Set gas type distribution
     setGasTypeDistributionData(gasTypeRes.data || []);

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
    return gasTypeDistributionData.map(item => ({
      name: item.gas_type_name,
      value: Number(item.total_cylinders) || 0,
      color: item.gas_type_color
    }));
  }, [gasTypeDistributionData]);

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
                      quantity: o.cylinder_count,
                      status: o.status === "completed" ? "Voltooid" : o.status === "pending" ? "Gepland" : o.status,
                    })),
                    ...dryIceOrders.map(o => ({
                      date: format(new Date(o.scheduled_date), "dd-MM-yyyy"),
                      customer: o.customer_name,
                      type: "Droogijs",
                      quantity: `${Number(o.quantity_kg)} kg`,
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
          value={cylinderStats.total}
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
              value={dryIceStats.total}
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
          value={cylinderStats.completed + dryIceStats.completed}
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
          value={cylinderStats.pending + dryIceStats.pending}
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
                {/* Chart Style Toggle */}
                <ToggleGroup
                  type="single"
                  value={chartStyle}
                  onValueChange={(value) => value && setChartStyle(value as "area" | "glow")}
                  className="bg-muted/50 rounded-md p-1"
                >
                  <ToggleGroupItem value="area" aria-label="Area Chart" className="text-xs px-2 data-[state=on]:bg-background">
                    <AreaChartIcon className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="glow" aria-label="Glow Chart" className="text-xs px-2 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    <Sparkles className="h-3.5 w-3.5" />
                  </ToggleGroupItem>
                </ToggleGroup>

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
                chartStyle === "glow" ? (
                  <GlowLineChart
                    data={ordersPerDay}
                    xAxisKey="displayDate"
                    height={300}
                    series={[
                      ...(productionChartView === "both" || productionChartView === "cylinders"
                        ? [{ dataKey: "cylinders", name: "Cilinders", color: "#f97316", glowColor: "#f97316" }]
                        : []),
                      ...(productionChartView === "both" || productionChartView === "dryIce"
                        ? [{ dataKey: "dryIce", name: "Droogijs (kg)", color: "#06b6d4", glowColor: "#06b6d4" }]
                        : []),
                    ]}
                  />
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <AreaChart data={ordersPerDay}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="displayDate" className="text-xs" />
                      <YAxis className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))'
                        }}
                      />
                      <Legend />
                      {(productionChartView === "both" || productionChartView === "cylinders") && (
                        <Area
                          type="monotone"
                          dataKey="cylinders"
                          name="Cilinders"
                          stackId="1"
                          stroke="#f97316"
                          fill="#f97316"
                          fillOpacity={0.6}
                        />
                      )}
                      {(productionChartView === "both" || productionChartView === "dryIce") && (
                        <Area
                          type="monotone"
                          dataKey="dryIce"
                          name="Droogijs (kg)"
                          stackId="2"
                          stroke="#06b6d4"
                          fill="#06b6d4"
                          fillOpacity={0.6}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                )
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
              <CardHeader>
                <CardTitle className="text-lg">Gastype verdeling</CardTitle>
                <CardDescription>Aantal cilinders per gastype</CardDescription>
              </CardHeader>
              <CardContent>
                {gasTypeDistribution.length > 0 ? (
                  <ResponsiveContainer width="100%" height={Math.max(250, gasTypeDistribution.length * 40)}>
                    <BarChart
                      data={gasTypeDistribution}
                      layout="vertical"
                      margin={{ left: 10, right: 60 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                      <XAxis
                        type="number"
                        className="text-xs"
                        tickFormatter={(value) => formatNumber(value, 0)}
                      />
                      <YAxis
                        dataKey="name"
                        type="category"
                        width={140}
                        className="text-xs"
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))'
                        }}
                        formatter={(value: number) => [formatNumber(value, 0), "Cilinders"]}
                      />
                      <Bar
                        dataKey="value"
                        name="Cilinders"
                        radius={[0, 4, 4, 0]}
                        label={{
                          position: 'right',
                          formatter: (value: number) => formatNumber(value, 0),
                          fontSize: 11,
                          fill: 'hsl(var(--foreground))'
                        }}
                      >
                        {gasTypeDistribution.map((entry, index) => (
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
              <ProductionHeatMap location={location} refreshKey={refreshKey} />
            </Suspense>
            <Suspense fallback={<ChartLoadingFallback />}>
              <CustomerSegmentation location={location} refreshKey={refreshKey} />
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
