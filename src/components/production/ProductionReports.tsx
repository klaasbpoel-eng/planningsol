import { useState, useEffect, useMemo } from "react";
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
  Loader2,
  GitCompare
} from "lucide-react";
import { YearComparisonReport } from "./YearComparisonReport";
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek } from "date-fns";
import { nl } from "date-fns/locale";
import { cn, formatNumber } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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

  useEffect(() => {
    fetchGasTypes();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [dateRange, refreshKey, location]);

  useEffect(() => {
    fetchGasTypes();
  }, []);

  useEffect(() => {
    fetchReportData();
  }, [dateRange, location]);

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
    
    return supabase
      .from("dry_ice_orders")
      .select("*")
      .gte("scheduled_date", effectiveStart)
      .lte("scheduled_date", effectiveEnd)
      .order("scheduled_date", { ascending: true })
      .limit(5000);
  };

  const fetchReportData = async () => {
    setLoading(true);
    const fromDate = format(dateRange.from, "yyyy-MM-dd");
    const toDate = format(dateRange.to, "yyyy-MM-dd");

    // Get all months in the range
    const months = getMonthsInRange(dateRange.from, dateRange.to);
    
    // Fetch data for each month in parallel
    const cylinderPromises = months.map(({ year, month }) => 
      fetchCylinderMonthData(year, month, fromDate, toDate)
    );
    const dryIcePromises = months.map(({ year, month }) => 
      fetchDryIceMonthData(year, month, fromDate, toDate)
    );

    const [cylinderResults, dryIceResults] = await Promise.all([
      Promise.all(cylinderPromises),
      Promise.all(dryIcePromises)
    ]);

    // Combine results from all months
    const allCylinderOrders = cylinderResults.flatMap(res => res.data || []);
    const allDryIceOrders = dryIceResults.flatMap(res => res.data || []);

    // Remove duplicates (in case of overlapping date boundaries)
    const uniqueCylinderOrders = Array.from(
      new Map(allCylinderOrders.map(o => [o.id, o])).values()
    ).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));
    
    const uniqueDryIceOrders = Array.from(
      new Map(allDryIceOrders.map(o => [o.id, o])).values()
    ).sort((a, b) => a.scheduled_date.localeCompare(b.scheduled_date));

    setCylinderOrders(uniqueCylinderOrders);
    setDryIceOrders(uniqueDryIceOrders);
    setLoading(false);
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

    return Array.from(gasMap.entries()).map(([name, data]) => ({
      name,
      value: data.count,
      color: data.color
    }));
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
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
        <Card className="glass-card border-orange-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Cylinder className="h-4 w-4 text-orange-500" />
              Cilinder orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cylinderStats.total}</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-orange-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Package className="h-4 w-4 text-orange-500" />
              Totaal cilinders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(cylinderStats.totalCylinders, 0)}</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-cyan-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-cyan-500" />
              Droogijs orders
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dryIceStats.total}</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-cyan-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-cyan-500" />
              Totaal droogijs
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(dryIceStats.totalKg, 0)} kg</div>
          </CardContent>
        </Card>

        <Card className="glass-card border-green-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Voltooid
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {cylinderStats.completed + dryIceStats.completed}
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card border-yellow-500/20">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-yellow-500" />
              Gepland
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {cylinderStats.pending + dryIceStats.pending}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full max-w-2xl grid-cols-4 bg-muted/50 backdrop-blur-sm">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Overzicht
          </TabsTrigger>
          <TabsTrigger value="cylinders" className="flex items-center gap-2">
            <Cylinder className="h-4 w-4" />
            Cilinders
          </TabsTrigger>
          <TabsTrigger value="dryice" className="flex items-center gap-2">
            <Snowflake className="h-4 w-4" />
            Droogijs
          </TabsTrigger>
          <TabsTrigger value="comparison" className="flex items-center gap-2">
            <GitCompare className="h-4 w-4" />
            Jaarvergelijking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6 space-y-6">
          {/* Production Chart */}
          <Card className="glass-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-lg">Productie per dag</CardTitle>
                <CardDescription>
                  {productionChartView === "both" && "Overzicht van cilinders en droogijs orders"}
                  {productionChartView === "cylinders" && "Overzicht van cilinder orders"}
                  {productionChartView === "dryIce" && "Overzicht van droogijs orders"}
                </CardDescription>
              </div>
              <ToggleGroup 
                type="single" 
                value={productionChartView} 
                onValueChange={(value) => value && setProductionChartView(value as "both" | "cylinders" | "dryIce")}
                className="bg-muted/50 rounded-md p-1"
              >
                <ToggleGroupItem value="both" aria-label="Beide" className="text-xs px-3 data-[state=on]:bg-background">
                  Beide
                </ToggleGroupItem>
                <ToggleGroupItem value="cylinders" aria-label="Cilinders" className="text-xs px-3 data-[state=on]:bg-orange-500 data-[state=on]:text-white">
                  <Cylinder className="h-3 w-3 mr-1" />
                  Cilinders
                </ToggleGroupItem>
                <ToggleGroupItem value="dryIce" aria-label="Droogijs" className="text-xs px-3 data-[state=on]:bg-cyan-500 data-[state=on]:text-white">
                  <Snowflake className="h-3 w-3 mr-1" />
                  Droogijs
                </ToggleGroupItem>
              </ToggleGroup>
            </CardHeader>
            <CardContent>
              {ordersPerDay.length > 0 ? (
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
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={gasTypeDistribution}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {gasTypeDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color || COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
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
              {cylinderOrders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead>Gastype</TableHead>
                      <TableHead>M/T</TableHead>
                      <TableHead>Aantal</TableHead>
                      <TableHead>Druk</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cylinderOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-2 h-2 rounded-full flex-shrink-0" 
                              style={{ backgroundColor: getGasTypeColor(order) }}
                            />
                            {getGasTypeLabel(order)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={order.gas_grade === "medical" ? "default" : "secondary"}>
                            {order.gas_grade === "medical" ? "M" : "T"}
                          </Badge>
                        </TableCell>
                        <TableCell>{formatNumber(order.cylinder_count, 0)} st.</TableCell>
                        <TableCell>{formatNumber(order.pressure, 0)} bar</TableCell>
                        <TableCell>{format(new Date(order.scheduled_date), "d MMM yyyy", { locale: nl })}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Cylinder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Geen cilinder orders in deze periode</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

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
              {dryIceOrders.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Hoeveelheid</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dryIceOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>{order.product_type}</TableCell>
                        <TableCell>{formatNumber(order.quantity_kg, 0)} kg</TableCell>
                        <TableCell>{format(new Date(order.scheduled_date), "d MMM yyyy", { locale: nl })}</TableCell>
                        <TableCell>{getStatusBadge(order.status)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <Snowflake className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Geen droogijs orders in deze periode</p>
                </div>
              )}
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

        <TabsContent value="comparison" className="mt-6">
          <YearComparisonReport location={location} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
