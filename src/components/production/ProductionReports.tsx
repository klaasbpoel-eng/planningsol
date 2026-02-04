import { useState, useEffect, useMemo, lazy, Suspense, useCallback } from "react";
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
  AreaChartIcon
} from "lucide-react";
import { GlowLineChart } from "@/components/ui/glow-line-chart";
import { FadeIn } from "@/components/ui/fade-in";
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
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, differenceInDays, subDays } from "date-fns";
import { nl } from "date-fns/locale";
import { cn, formatNumber } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { VirtualizedTable } from "@/components/ui/virtualized-table";
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
  PieChart,
  Pie,
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
  gas_type_ref?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface GasType {
  id: string;
  name: string;
  color: string;
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

const COLORS = ['#06b6d4', '#f97316', '#22c55e', '#ef4444', '#8b5cf6', '#eab308'];

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface ProductionReportsProps {
  refreshKey?: number;
  onDataChanged?: () => void;
  location?: ProductionLocation;
}

export function ProductionReports({ refreshKey = 0, onDataChanged, location = "all" }: ProductionReportsProps) {
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });
  const [cylinderOrders, setCylinderOrders] = useState<GasCylinderOrder[]>([]);
  const [dryIceOrders, setDryIceOrders] = useState<DryIceOrder[]>([]);
  const [gasTypes, setGasTypes] = useState<GasType[]>([]);
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
    fetchGasTypes();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [dateRange, refreshKey, location]);

  const fetchGasTypes = async () => {
    const { data } = await supabase
      .from("gas_types")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name");

    if (data) {
      setGasTypes(data);
    }
  };

  // Helper function to get all months in a date range
  const getMonthsInRange = (from: Date, to: Date) => {
    const months: { year: number; month: number }[] = [];
    const current = new Date(from.getFullYear(), from.getMonth(), 1);
    const end = new Date(to.getFullYear(), to.getMonth(), 1);

    while (current <= end) {
      months.push({ year: current.getFullYear(), month: current.getMonth() + 1 });
      current.setMonth(current.getMonth() + 1);
    }
    return months;
  };

  // Helper function to get weeks in a month for chunking
  const getWeeksInMonth = (year: number, month: number) => {
    const weeks: { startDate: string; endDate: string }[] = [];
    const monthStr = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    let currentDay = 1;

    while (currentDay <= lastDay) {
      const endDay = Math.min(currentDay + 6, lastDay);
      weeks.push({
        startDate: `${year}-${monthStr}-${String(currentDay).padStart(2, '0')}`,
        endDate: `${year}-${monthStr}-${String(endDay).padStart(2, '0')}`
      });
      currentDay = endDay + 1;
    }
    return weeks;
  };

  // Fetch cylinder orders for a single week
  const fetchCylinderWeekData = async (startDate: string, endDate: string) => {
    let query = supabase
      .from("gas_cylinder_orders")
      .select(`
        *,
        gas_type_ref:gas_types(id, name, color)
      `)
      .gte("scheduled_date", startDate)
      .lte("scheduled_date", endDate)
      .order("scheduled_date", { ascending: true });

    if (location !== "all") {
      query = query.eq("location", location);
    }

    return query;
  };

  // Fetch cylinder orders for a single month using weekly chunking to bypass 1000-row limit
  const fetchCylinderMonthData = async (year: number, month: number, fromDate: string, toDate: string) => {
    const weeks = getWeeksInMonth(year, month);

    // Clamp weeks to actual date range
    const relevantWeeks = weeks.filter(week =>
      week.endDate >= fromDate && week.startDate <= toDate
    ).map(week => ({
      startDate: week.startDate < fromDate ? fromDate : week.startDate,
      endDate: week.endDate > toDate ? toDate : week.endDate
    }));

    const weekPromises = relevantWeeks.map(week =>
      fetchCylinderWeekData(week.startDate, week.endDate)
    );

    const results = await Promise.all(weekPromises);
    const allOrders = results.flatMap(res => res.data || []);

    // Deduplicate by ID and return as array
    const uniqueOrders = Array.from(new Map(allOrders.map(o => [o.id, o])).values());
    return { data: uniqueOrders, error: null };
  };

  // Fetch dry ice orders for a single month
  const fetchDryIceMonthData = async (year: number, month: number, fromDate: string, toDate: string) => {
    const monthStr = String(month).padStart(2, '0');
    const monthStartDate = `${year}-${monthStr}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const monthEndDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;

    // Clamp to the actual date range
    const effectiveStart = monthStartDate < fromDate ? fromDate : monthStartDate;
    const effectiveEnd = monthEndDate > toDate ? toDate : monthEndDate;

    let query = supabase
      .from("dry_ice_orders")
      .select("*")
      .gte("scheduled_date", effectiveStart)
      .lte("scheduled_date", effectiveEnd)
      .order("scheduled_date", { ascending: true })
      .limit(5000);

    // Add location filter (only sol_emmen has dry ice production)
    if (location !== "all") {
      query = query.eq("location", location);
    }

    return query;
  };

  const fetchReportData = async () => {
    setLoading(true);
    const fromDate = format(dateRange.from, "yyyy-MM-dd");
    const toDate = format(dateRange.to, "yyyy-MM-dd");

    // Calculate previous period (same length, immediately before)
    const periodLength = differenceInDays(dateRange.to, dateRange.from);
    const prevTo = subDays(dateRange.from, 1);
    const prevFrom = subDays(prevTo, periodLength);
    const prevFromDate = format(prevFrom, "yyyy-MM-dd");
    const prevToDate = format(prevTo, "yyyy-MM-dd");

    // Get all months in the range
    const months = getMonthsInRange(dateRange.from, dateRange.to);
    const prevMonths = getMonthsInRange(prevFrom, prevTo);

    // Fetch data for each month in parallel
    const cylinderPromises = months.map(({ year, month }) =>
      fetchCylinderMonthData(year, month, fromDate, toDate)
    );
    const dryIcePromises = months.map(({ year, month }) =>
      fetchDryIceMonthData(year, month, fromDate, toDate)
    );

    // Fetch previous period data
    const prevCylinderPromises = prevMonths.map(({ year, month }) =>
      fetchCylinderMonthData(year, month, prevFromDate, prevToDate)
    );
    const prevDryIcePromises = prevMonths.map(({ year, month }) =>
      fetchDryIceMonthData(year, month, prevFromDate, prevToDate)
    );

    const [cylinderResults, dryIceResults, prevCylinderResults, prevDryIceResults] = await Promise.all([
      Promise.all(cylinderPromises),
      Promise.all(dryIcePromises),
      Promise.all(prevCylinderPromises),
      Promise.all(prevDryIcePromises)
    ]);

    // Combine results from all months
    const allCylinderOrders = cylinderResults.flatMap(res => res.data || []);
    const allDryIceOrders = dryIceResults.flatMap(res => res.data || []);
    const allPrevCylinderOrders = prevCylinderResults.flatMap(res => res.data || []);
    const allPrevDryIceOrders = prevDryIceResults.flatMap(res => res.data || []);

    // Remove duplicates (in case of overlapping date boundaries)
    const uniqueCylinderOrders = Array.from(
      new Map(allCylinderOrders.map(o => [o.id, o])).values()
    ).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

    const uniqueDryIceOrders = Array.from(
      new Map(allDryIceOrders.map(o => [o.id, o])).values()
    ).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

    const uniquePrevCylinderOrders = Array.from(
      new Map(allPrevCylinderOrders.map(o => [o.id, o])).values()
    );
    const uniquePrevDryIceOrders = Array.from(
      new Map(allPrevDryIceOrders.map(o => [o.id, o])).values()
    );

    // Calculate previous period stats
    setPreviousPeriodStats({
      cylinderOrders: uniquePrevCylinderOrders.length,
      totalCylinders: uniquePrevCylinderOrders.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + o.cylinder_count, 0),
      dryIceOrders: uniquePrevDryIceOrders.length,
      totalDryIce: uniquePrevDryIceOrders.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + Number(o.quantity_kg), 0),
      completed: uniquePrevCylinderOrders.filter(o => o.status === "completed").length + uniquePrevDryIceOrders.filter(o => o.status === "completed").length,
      pending: uniquePrevCylinderOrders.filter(o => o.status === "pending").length + uniquePrevDryIceOrders.filter(o => o.status === "pending").length
    });

    setCylinderOrders(uniqueCylinderOrders);
    setDryIceOrders(uniqueDryIceOrders);
    setLoading(false);
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
    }
  };

  // Calculate statistics
  const cylinderStats = {
    total: cylinderOrders.length,
    completed: cylinderOrders.filter(o => o.status === "completed").length,
    pending: cylinderOrders.filter(o => o.status === "pending").length,
    inProgress: cylinderOrders.filter(o => o.status === "in_progress").length,
    cancelled: cylinderOrders.filter(o => o.status === "cancelled").length,
    totalCylinders: cylinderOrders.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + o.cylinder_count, 0)
  };

  const dryIceStats = {
    total: dryIceOrders.length,
    completed: dryIceOrders.filter(o => o.status === "completed").length,
    pending: dryIceOrders.filter(o => o.status === "pending").length,
    inProgress: dryIceOrders.filter(o => o.status === "in_progress").length,
    cancelled: dryIceOrders.filter(o => o.status === "cancelled").length,
    totalKg: dryIceOrders.filter(o => o.status !== "cancelled").reduce((sum, o) => sum + Number(o.quantity_kg), 0)
  };

  // Gas type labels mapping (defined early for use in distribution calculation)
  const gasTypeLabels: Record<string, string> = {
    co2: "CO₂",
    nitrogen: "Stikstof (N₂)",
    argon: "Argon",
    acetylene: "Acetyleen",
    oxygen: "Zuurstof",
    helium: "Helium",
    other: "Overig",
  };

  // Prepare chart data - orders per day
  const getOrdersPerDay = () => {
    const dayMap = new Map<string, { date: string; cylinders: number; dryIce: number }>();

    cylinderOrders.forEach(order => {
      const date = order.scheduled_date;
      const existing = dayMap.get(date) || { date, cylinders: 0, dryIce: 0 };
      existing.cylinders += order.cylinder_count;
      dayMap.set(date, existing);
    });

    dryIceOrders.forEach(order => {
      const date = order.scheduled_date;
      const existing = dayMap.get(date) || { date, cylinders: 0, dryIce: 0 };
      existing.dryIce += Number(order.quantity_kg);
      dayMap.set(date, existing);
    });

    return Array.from(dayMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(item => ({
        ...item,
        displayDate: format(new Date(item.date), "d MMM", { locale: nl })
      }));
  };

  // Gas type distribution - use gas_type_id/gas_type_ref when available
  const getGasTypeDistribution = () => {
    const gasMap = new Map<string, { count: number; color: string }>();

    cylinderOrders.filter(o => o.status !== "cancelled").forEach(order => {
      // Get gas type name - prioritize joined data
      let gasTypeName: string;
      let gasTypeColor = "#3b82f6"; // default blue

      if (order.gas_type_ref?.name) {
        gasTypeName = order.gas_type_ref.name;
        gasTypeColor = order.gas_type_ref.color;
      } else if (order.gas_type_id) {
        // Try to find in loaded gas types
        const matchedType = gasTypes.find(gt => gt.id === order.gas_type_id);
        if (matchedType) {
          gasTypeName = matchedType.name;
          gasTypeColor = matchedType.color;
        } else {
          gasTypeName = gasTypeLabels[order.gas_type] || order.gas_type;
        }
      } else {
        gasTypeName = gasTypeLabels[order.gas_type] || order.gas_type;
      }

      const current = gasMap.get(gasTypeName) || { count: 0, color: gasTypeColor };
      current.count += order.cylinder_count;
      gasMap.set(gasTypeName, current);
    });

    return Array.from(gasMap.entries())
      .map(([name, data]) => ({
        name,
        value: data.count,
        color: data.color
      }))
      .sort((a, b) => b.value - a.value); // Sort descending by value
  };

  // Customer ranking
  const getCustomerRanking = (type: "cylinder" | "dryIce") => {
    const customerMap = new Map<string, number>();
    const orders = type === "cylinder" ? cylinderOrders : dryIceOrders;

    orders.filter(o => o.status !== "cancelled").forEach(order => {
      const current = customerMap.get(order.customer_name) || 0;
      const value = type === "cylinder"
        ? (order as GasCylinderOrder).cylinder_count
        : Number((order as DryIceOrder).quantity_kg);
      customerMap.set(order.customer_name, current + value);
    });

    return Array.from(customerMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  };

  const ordersPerDay = getOrdersPerDay();
  const gasTypeDistribution = getGasTypeDistribution();

  // Get gas type label - prioritize gas_type_ref from join, then gas_type_id lookup
  const getGasTypeLabel = (order: GasCylinderOrder) => {
    // First check if we have the joined gas_type_ref
    if (order.gas_type_ref?.name) {
      return order.gas_type_ref.name;
    }

    // Then check if we can match by gas_type_id
    if (order.gas_type_id) {
      const matchedType = gasTypes.find(gt => gt.id === order.gas_type_id);
      if (matchedType) {
        return matchedType.name;
      }
    }

    // Fallback to enum labels
    return gasTypeLabels[order.gas_type] || order.gas_type;
  };

  // Get gas type color
  const getGasTypeColor = (order: GasCylinderOrder) => {
    if (order.gas_type_ref?.color) {
      return order.gas_type_ref.color;
    }
    if (order.gas_type_id) {
      const matchedType = gasTypes.find(gt => gt.id === order.gas_type_id);
      if (matchedType) {
        return matchedType.color;
      }
    }
    return "#3b82f6"; // default blue
  };

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
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, from: date }))}
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
                      onSelect={(date) => date && setDateRange(prev => ({ ...prev, to: date }))}
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
        <TabsList className="grid w-full max-w-3xl grid-cols-5 bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overzicht
          </TabsTrigger>
          <TabsTrigger value="insights" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" />
            Insights
          </TabsTrigger>
          <TabsTrigger value="cylinders" className="flex items-center gap-2">
            <Cylinder className="h-4 w-4" />
            Cilinders
          </TabsTrigger>
          {showDryIce && (
            <TabsTrigger value="dryice" className="flex items-center gap-2">
              <Snowflake className="h-4 w-4" />
              Droogijs
            </TabsTrigger>
          )}
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Jaarvergelijking
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
                {getCustomerRanking("cylinder").length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={getCustomerRanking("cylinder")} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} />
                      <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))'
                        }}
                      />
                      <Bar dataKey="value" name="Cilinders" fill="#f97316" radius={[0, 4, 4, 0]} />
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
              <VirtualizedTable
                data={cylinderOrders}
                maxHeight={500}
                emptyMessage={
                  <div className="text-center py-12 text-muted-foreground">
                    <Cylinder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Geen cilinder orders in deze periode</p>
                  </div>
                }
                columns={[
                  { header: "Order", accessor: (order) => <span className="font-medium">{order.order_number}</span> },
                  { header: "Klant", accessor: (order) => order.customer_name },
                  {
                    header: "Gastype",
                    accessor: (order) => (
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full flex-shrink-0"
                          style={{ backgroundColor: getGasTypeColor(order) }}
                        />
                        {getGasTypeLabel(order)}
                      </div>
                    )
                  },
                  {
                    header: "M/T",
                    accessor: (order) => (
                      <Badge variant={order.gas_grade === "medical" ? "default" : "secondary"}>
                        {order.gas_grade === "medical" ? "M" : "T"}
                      </Badge>
                    )
                  },
                  { header: "Aantal", accessor: (order) => `${formatNumber(order.cylinder_count, 0)} st.` },
                  { header: "Druk", accessor: (order) => `${formatNumber(order.pressure, 0)} bar` },
                  { header: "Datum", accessor: (order) => format(new Date(order.scheduled_date), "d MMM yyyy", { locale: nl }) },
                  { header: "Status", accessor: (order) => getStatusBadge(order.status) },
                ]}
              />
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
                <VirtualizedTable
                  data={dryIceOrders}
                  maxHeight={500}
                  emptyMessage={
                    <div className="text-center py-12 text-muted-foreground">
                      <Snowflake className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>Geen droogijs orders in deze periode</p>
                    </div>
                  }
                  columns={[
                    { header: "Order", accessor: (order) => <span className="font-medium">{order.order_number}</span> },
                    { header: "Klant", accessor: (order) => order.customer_name },
                    { header: "Type", accessor: (order) => order.product_type === "blocks" ? "pellets 9mm" : order.product_type },
                    { header: "Hoeveelheid", accessor: (order) => `${formatNumber(order.quantity_kg, 0)} kg` },
                    { header: "Datum", accessor: (order) => format(new Date(order.scheduled_date), "d MMM yyyy", { locale: nl }) },
                    { header: "Status", accessor: (order) => getStatusBadge(order.status) },
                  ]}
                />
              </CardContent>
            </Card>

            {/* Top customers for dry ice */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-lg">Top 5 klanten - Droogijs</CardTitle>
                <CardDescription>Klanten met de meeste droogijs orders (kg)</CardDescription>
              </CardHeader>
              <CardContent>
                {getCustomerRanking("dryIce").length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={getCustomerRanking("dryIce")} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} />
                      <YAxis dataKey="name" type="category" width={120} className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))'
                        }}
                      />
                      <Bar dataKey="value" name="Droogijs (kg)" fill="#06b6d4" radius={[0, 4, 4, 0]} />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
