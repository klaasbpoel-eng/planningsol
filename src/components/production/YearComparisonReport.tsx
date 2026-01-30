import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, Minus, Cylinder, Snowflake, Award, AlertTriangle, X, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  AreaChart,
  Area,
  ReferenceLine,
  Cell,
} from "recharts";

interface MonthlyData {
  month: number;
  monthName: string;
  currentYear: number;
  previousYear: number;
  change: number;
  changePercent: number;
}

interface YearlyTotals {
  currentYear: number;
  previousYear: number;
  change: number;
  changePercent: number;
}

interface GasTypeMonthlyData {
  gas_type_id: string;
  gas_type_name: string;
  gas_type_color: string;
  months: number[];
  total: number;
}

interface GasTypeYearComparison {
  gas_type_id: string;
  gas_type_name: string;
  gas_type_color: string;
  currentYear: number;
  previousYear: number;
  change: number;
  changePercent: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

export function YearComparisonReport() {
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [cylinderData, setCylinderData] = useState<MonthlyData[]>([]);
  const [dryIceData, setDryIceData] = useState<MonthlyData[]>([]);
  const [cylinderTotals, setCylinderTotals] = useState<YearlyTotals | null>(null);
  const [dryIceTotals, setDryIceTotals] = useState<YearlyTotals | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [highlightSignificant, setHighlightSignificant] = useState(false);
  const [gasTypeComparison, setGasTypeComparison] = useState<GasTypeYearComparison[]>([]);
  const [gasTypes, setGasTypes] = useState<{ id: string; name: string; color: string }[]>([]);
  const [selectedGasTypes, setSelectedGasTypes] = useState<string[]>([]);

  const isSignificantGrowth = (percent: number) => percent > 10 || percent < -10;

  useEffect(() => {
    // Generate years from 2024 to current year + 1
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= 2024; y--) {
      years.push(y);
    }
    setAvailableYears(years);
    
    // Fetch gas types for filter
    fetchGasTypes();
  }, []);

  const fetchGasTypes = async () => {
    const { data } = await supabase
      .from("gas_types")
      .select("id, name, color")
      .eq("is_active", true)
      .order("sort_order");
    
    if (data) {
      setGasTypes(data);
    }
  };

  useEffect(() => {
    if (selectedYear) {
      fetchYearComparisonData();
    }
  }, [selectedYear]);

  const fetchYearComparisonData = async () => {
    setLoading(true);
    
    const currentYear = selectedYear;
    const previousYear = selectedYear - 1;

    // Use database function to get aggregated monthly totals - bypasses the 1000 row limit
    const [
      currentCylinderRes, 
      previousCylinderRes, 
      currentDryIceRes, 
      previousDryIceRes,
      currentGasTypeRes,
      previousGasTypeRes
    ] = await Promise.all([
      supabase.rpc("get_monthly_order_totals", { p_year: currentYear, p_order_type: "cylinder" }),
      supabase.rpc("get_monthly_order_totals", { p_year: previousYear, p_order_type: "cylinder" }),
      supabase.rpc("get_monthly_order_totals", { p_year: currentYear, p_order_type: "dry_ice" }),
      supabase.rpc("get_monthly_order_totals", { p_year: previousYear, p_order_type: "dry_ice" }),
      supabase.rpc("get_monthly_cylinder_totals_by_gas_type", { p_year: currentYear }),
      supabase.rpc("get_monthly_cylinder_totals_by_gas_type", { p_year: previousYear })
    ]);

    // Process cylinder data from aggregated results
    const cylinderMonthly = processMonthlyDataFromAggregated(
      currentCylinderRes.data || [],
      previousCylinderRes.data || []
    );
    setCylinderData(cylinderMonthly);
    setCylinderTotals(calculateTotals(cylinderMonthly));

    // Process dry ice data from aggregated results
    const dryIceMonthly = processMonthlyDataFromAggregated(
      currentDryIceRes.data || [],
      previousDryIceRes.data || []
    );
    setDryIceData(dryIceMonthly);
    setDryIceTotals(calculateTotals(dryIceMonthly));

    // Process gas type comparison data
    const gasTypeData = processGasTypeComparison(
      currentGasTypeRes.data || [],
      previousGasTypeRes.data || []
    );
    setGasTypeComparison(gasTypeData);

    setLoading(false);
  };

  const processGasTypeComparison = (
    currentData: { gas_type_id: string; gas_type_name: string; gas_type_color: string; total_cylinders: number }[],
    previousData: { gas_type_id: string; gas_type_name: string; gas_type_color: string; total_cylinders: number }[]
  ): GasTypeYearComparison[] => {
    // Group by gas type and sum totals
    const currentMap = new Map<string, { name: string; color: string; total: number }>();
    const previousMap = new Map<string, { name: string; color: string; total: number }>();

    currentData.forEach(item => {
      if (!item.gas_type_id) return;
      const existing = currentMap.get(item.gas_type_id);
      if (existing) {
        existing.total += Number(item.total_cylinders) || 0;
      } else {
        currentMap.set(item.gas_type_id, {
          name: item.gas_type_name || "Onbekend",
          color: item.gas_type_color || "#94a3b8",
          total: Number(item.total_cylinders) || 0
        });
      }
    });

    previousData.forEach(item => {
      if (!item.gas_type_id) return;
      const existing = previousMap.get(item.gas_type_id);
      if (existing) {
        existing.total += Number(item.total_cylinders) || 0;
      } else {
        previousMap.set(item.gas_type_id, {
          name: item.gas_type_name || "Onbekend",
          color: item.gas_type_color || "#94a3b8",
          total: Number(item.total_cylinders) || 0
        });
      }
    });

    // Merge both years
    const allGasTypeIds = new Set([...currentMap.keys(), ...previousMap.keys()]);
    const result: GasTypeYearComparison[] = [];

    allGasTypeIds.forEach(id => {
      const current = currentMap.get(id);
      const previous = previousMap.get(id);
      const currentTotal = current?.total || 0;
      const previousTotal = previous?.total || 0;
      const change = currentTotal - previousTotal;
      const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100) : (currentTotal > 0 ? 100 : 0);

      result.push({
        gas_type_id: id,
        gas_type_name: current?.name || previous?.name || "Onbekend",
        gas_type_color: current?.color || previous?.color || "#94a3b8",
        currentYear: currentTotal,
        previousYear: previousTotal,
        change,
        changePercent
      });
    });

    // Sort by current year total descending
    return result.sort((a, b) => b.currentYear - a.currentYear);
  };

  const processMonthlyDataFromAggregated = (
    currentData: { month: number; total_value: number }[],
    previousData: { month: number; total_value: number }[]
  ): MonthlyData[] => {
    const monthlyData: MonthlyData[] = [];

    // Create lookup maps for quick access
    const currentMap = new Map(currentData.map(d => [d.month, Number(d.total_value) || 0]));
    const previousMap = new Map(previousData.map(d => [d.month, Number(d.total_value) || 0]));

    for (let month = 1; month <= 12; month++) {
      const currentValue = currentMap.get(month) || 0;
      const previousValue = previousMap.get(month) || 0;
      const change = currentValue - previousValue;
      const changePercent = previousValue > 0 ? ((change / previousValue) * 100) : (currentValue > 0 ? 100 : 0);

      monthlyData.push({
        month,
        monthName: MONTH_NAMES[month - 1],
        currentYear: currentValue,
        previousYear: previousValue,
        change,
        changePercent
      });
    }

    return monthlyData;
  };

  const calculateTotals = (monthlyData: MonthlyData[]): YearlyTotals => {
    const currentYear = monthlyData.reduce((sum, m) => sum + m.currentYear, 0);
    const previousYear = monthlyData.reduce((sum, m) => sum + m.previousYear, 0);
    const change = currentYear - previousYear;
    const changePercent = previousYear > 0 ? ((change / previousYear) * 100) : (currentYear > 0 ? 100 : 0);

    return { currentYear, previousYear, change, changePercent };
  };

  const getGrowthHighlights = (data: MonthlyData[]) => {
    // Filter months with data (at least one of the years has values)
    const validMonths = data.filter(m => m.currentYear > 0 || m.previousYear > 0);
    
    if (validMonths.length === 0) {
      return { best: null, worst: null };
    }

    const sorted = [...validMonths].sort((a, b) => b.changePercent - a.changePercent);
    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1]
    };
  };

  const getTrendIcon = (changePercent: number) => {
    if (changePercent > 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (changePercent < -5) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getChangeColor = (changePercent: number) => {
    if (changePercent > 5) return "text-green-500";
    if (changePercent < -5) return "text-red-500";
    return "text-muted-foreground";
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
      {/* Year Selector */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Jaarvergelijking
          </CardTitle>
          <CardDescription>
            Vergelijk productiedata per maand met het voorgaande jaar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Vergelijk jaar:</span>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                vs {selectedYear - 1}
              </span>
            </div>
          </div>

          {/* Gas Type Filter */}
          {gasTypes.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filter op gastype (cilinders)
                </Label>
                {selectedGasTypes.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedGasTypes([])}
                    className="h-7 text-xs"
                  >
                    <X className="h-3 w-3 mr-1" />
                    Wis filter
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {gasTypes.map((gasType) => (
                  <label
                    key={gasType.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border cursor-pointer transition-colors ${
                      selectedGasTypes.includes(gasType.id)
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <Checkbox
                      checked={selectedGasTypes.includes(gasType.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setSelectedGasTypes([...selectedGasTypes, gasType.id]);
                        } else {
                          setSelectedGasTypes(selectedGasTypes.filter(id => id !== gasType.id));
                        }
                      }}
                    />
                    <div
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: gasType.color }}
                    />
                    <span className="text-sm">{gasType.name}</span>
                  </label>
                ))}
              </div>
              {selectedGasTypes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {selectedGasTypes.length} gastype{selectedGasTypes.length !== 1 ? 's' : ''} geselecteerd
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cylinder Totals */}
        <Card className="glass-card border-orange-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Cylinder className="h-5 w-5 text-orange-500" />
              Cilinders Jaartotaal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {cylinderTotals && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{selectedYear}</p>
                    <p className="text-2xl font-bold">{cylinderTotals.currentYear.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{selectedYear - 1}</p>
                    <p className="text-2xl font-bold text-muted-foreground">{cylinderTotals.previousYear.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getTrendIcon(cylinderTotals.changePercent)}
                  <span className={`font-medium ${getChangeColor(cylinderTotals.changePercent)}`}>
                    {cylinderTotals.change >= 0 ? "+" : ""}{cylinderTotals.change.toLocaleString()}
                  </span>
                  <Badge variant={cylinderTotals.changePercent >= 0 ? "default" : "destructive"}>
                    {cylinderTotals.changePercent >= 0 ? "+" : ""}{cylinderTotals.changePercent.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dry Ice Totals */}
        <Card className="glass-card border-cyan-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Snowflake className="h-5 w-5 text-cyan-500" />
              Droogijs Jaartotaal (kg)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dryIceTotals && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{selectedYear}</p>
                    <p className="text-2xl font-bold">{dryIceTotals.currentYear.toLocaleString()}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{selectedYear - 1}</p>
                    <p className="text-2xl font-bold text-muted-foreground">{dryIceTotals.previousYear.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getTrendIcon(dryIceTotals.changePercent)}
                  <span className={`font-medium ${getChangeColor(dryIceTotals.changePercent)}`}>
                    {dryIceTotals.change >= 0 ? "+" : ""}{dryIceTotals.change.toLocaleString()} kg
                  </span>
                  <Badge variant={dryIceTotals.changePercent >= 0 ? "default" : "destructive"}>
                    {dryIceTotals.changePercent >= 0 ? "+" : ""}{dryIceTotals.changePercent.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Growth Highlights Summary */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Groei Highlights
          </CardTitle>
          <CardDescription>
            Beste en slechtste maanden qua groei t.o.v. {selectedYear - 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cylinder Highlights */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Cylinder className="h-4 w-4 text-orange-500" />
                Cilinders
              </h4>
              {(() => {
                const highlights = getGrowthHighlights(cylinderData);
                return (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Best Month */}
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-1">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-xs font-medium">Beste maand</span>
                      </div>
                      {highlights.best ? (
                        <>
                          <p className="text-lg font-bold">{highlights.best.monthName}</p>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            {highlights.best.changePercent >= 0 ? "+" : ""}{highlights.best.changePercent.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {highlights.best.currentYear.toLocaleString()} vs {highlights.best.previousYear.toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Geen data</p>
                      )}
                    </div>
                    {/* Worst Month */}
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xs font-medium">Slechtste maand</span>
                      </div>
                      {highlights.worst ? (
                        <>
                          <p className="text-lg font-bold">{highlights.worst.monthName}</p>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {highlights.worst.changePercent >= 0 ? "+" : ""}{highlights.worst.changePercent.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {highlights.worst.currentYear.toLocaleString()} vs {highlights.worst.previousYear.toLocaleString()}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Geen data</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Dry Ice Highlights */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Snowflake className="h-4 w-4 text-cyan-500" />
                Droogijs
              </h4>
              {(() => {
                const highlights = getGrowthHighlights(dryIceData);
                return (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Best Month */}
                    <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                      <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400 mb-1">
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-xs font-medium">Beste maand</span>
                      </div>
                      {highlights.best ? (
                        <>
                          <p className="text-lg font-bold">{highlights.best.monthName}</p>
                          <p className="text-sm text-green-600 dark:text-green-400">
                            {highlights.best.changePercent >= 0 ? "+" : ""}{highlights.best.changePercent.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {highlights.best.currentYear.toLocaleString()} kg vs {highlights.best.previousYear.toLocaleString()} kg
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Geen data</p>
                      )}
                    </div>
                    {/* Worst Month */}
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xs font-medium">Slechtste maand</span>
                      </div>
                      {highlights.worst ? (
                        <>
                          <p className="text-lg font-bold">{highlights.worst.monthName}</p>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {highlights.worst.changePercent >= 0 ? "+" : ""}{highlights.worst.changePercent.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {highlights.worst.currentYear.toLocaleString()} kg vs {highlights.worst.previousYear.toLocaleString()} kg
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">Geen data</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Gas Type Year Comparison */}
      {gasTypeComparison.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cylinder className="h-5 w-5 text-orange-500" />
              Cilinders per gastype
              {selectedGasTypes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedGasTypes.length} gefilterd
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Jaarvergelijking {selectedYear} vs {selectedYear - 1} per gastype
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              // Filter gas type comparison based on selected gas types
              const filteredGasTypeComparison = selectedGasTypes.length > 0
                ? gasTypeComparison.filter(gt => selectedGasTypes.includes(gt.gas_type_id))
                : gasTypeComparison;

              if (filteredGasTypeComparison.length === 0) {
                return (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    Geen data voor geselecteerde gastypes
                  </div>
                );
              }

              return (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bar Chart */}
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={filteredGasTypeComparison}
                    layout="vertical"
                    margin={{ left: 80 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" />
                    <YAxis 
                      type="category" 
                      dataKey="gas_type_name" 
                      className="text-xs"
                      width={75}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--background))',
                        border: '1px solid hsl(var(--border))'
                      }}
                      formatter={(value: number, name: string) => [
                        value.toLocaleString(),
                        name === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()
                      ]}
                    />
                    <Legend
                      formatter={(value) => value === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()}
                    />
                    <Bar dataKey="previousYear" name="previousYear" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="currentYear" name="currentYear" radius={[0, 4, 4, 0]}>
                      {filteredGasTypeComparison.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.gas_type_color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Details Table */}
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground mb-3">
                  Overzicht per gastype
                </div>
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {filteredGasTypeComparison.map((gasType) => (
                    <div 
                      key={gasType.gas_type_id}
                      className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                    >
                      <div className="flex items-center gap-3">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: gasType.gas_type_color }}
                        />
                        <span className="font-medium">{gasType.gas_type_name}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-right">
                          <div className="font-medium">{gasType.currentYear.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">
                            vs {gasType.previousYear.toLocaleString()}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 min-w-[80px] justify-end">
                          {getTrendIcon(gasType.changePercent)}
                          <Badge 
                            variant={gasType.changePercent >= 0 ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {gasType.changePercent >= 0 ? "+" : ""}{gasType.changePercent.toFixed(1)}%
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Monthly Comparison Charts */}
      <div className="grid grid-cols-1 gap-6">
        {/* Cylinder Monthly Comparison */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cylinder className="h-5 w-5 text-orange-500" />
              Cilinders per maand
            </CardTitle>
            <CardDescription>
              Vergelijking {selectedYear} vs {selectedYear - 1}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={cylinderData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="monthName" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))'
                  }}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString(),
                    name === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()
                  ]}
                />
                <Legend
                  formatter={(value) => value === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()}
                />
                <Bar dataKey="previousYear" name="previousYear" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="currentYear" name="currentYear" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Dry Ice Monthly Comparison */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Snowflake className="h-5 w-5 text-cyan-500" />
              Droogijs per maand (kg)
            </CardTitle>
            <CardDescription>
              Vergelijking {selectedYear} vs {selectedYear - 1}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dryIceData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="monthName" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))'
                  }}
                  formatter={(value: number, name: string) => [
                    value.toLocaleString() + " kg",
                    name === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()
                  ]}
                />
                <Legend
                  formatter={(value) => value === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()}
                />
                <Bar dataKey="previousYear" name="previousYear" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="currentYear" name="currentYear" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Growth Trend Area Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Groeipercentage per maand
          </CardTitle>
          <CardDescription>
            Procentuele verandering t.o.v. {selectedYear - 1} — boven 0% = groei, onder 0% = daling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={cylinderData.map((c, i) => ({
                monthName: c.monthName,
                cylinders: parseFloat(c.changePercent.toFixed(1)),
                dryIce: parseFloat((dryIceData[i]?.changePercent || 0).toFixed(1))
              }))}
            >
              <defs>
                <linearGradient id="colorCylinders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorDryIce" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="monthName" className="text-xs" />
              <YAxis 
                className="text-xs" 
                tickFormatter={(v) => `${v}%`}
                domain={['dataMin - 10', 'dataMax + 10']}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => [
                  `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`,
                  name
                ]}
                labelFormatter={(label) => `Maand: ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="cylinders"
                name="Cilinders"
                stroke="#f97316"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCylinders)"
              />
              <Area
                type="monotone"
                dataKey="dryIce"
                name="Droogijs"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorDryIce)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Growth Line Chart Detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-card border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Cylinder className="h-4 w-4 text-orange-500" />
              Cilinders groeitrend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={cylinderData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="monthName" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))'
                  }}
                  formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, 'Groei']}
                />
                <Line
                  type="monotone"
                  dataKey="changePercent"
                  name="Groei %"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: "#f97316", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="glass-card border-cyan-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-cyan-500" />
              Droogijs groeitrend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={dryIceData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="monthName" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))'
                  }}
                  formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, 'Groei']}
                />
                <Line
                  type="monotone"
                  dataKey="changePercent"
                  name="Groei %"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  dot={{ fill: "#06b6d4", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Details Table */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg">Maandelijks overzicht</CardTitle>
              <CardDescription>Gedetailleerde vergelijking per maand</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="highlight-significant"
                checked={highlightSignificant}
                onCheckedChange={setHighlightSignificant}
              />
              <Label htmlFor="highlight-significant" className="text-sm cursor-pointer">
                Markeer significante groei (&gt;10% of &lt;-10%)
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">Maand</th>
                  <th className="text-right py-3 px-2 font-medium" colSpan={3}>Cilinders</th>
                  <th className="text-right py-3 px-2 font-medium" colSpan={3}>Droogijs (kg)</th>
                </tr>
                <tr className="border-b text-muted-foreground">
                  <th></th>
                  <th className="text-right py-2 px-2 text-xs">{selectedYear}</th>
                  <th className="text-right py-2 px-2 text-xs">{selectedYear - 1}</th>
                  <th className="text-right py-2 px-2 text-xs">Δ%</th>
                  <th className="text-right py-2 px-2 text-xs">{selectedYear}</th>
                  <th className="text-right py-2 px-2 text-xs">{selectedYear - 1}</th>
                  <th className="text-right py-2 px-2 text-xs">Δ%</th>
                </tr>
              </thead>
              <tbody>
                {cylinderData.map((cylinder, i) => {
                  const dryIce = dryIceData[i];
                  const cylinderSignificant = isSignificantGrowth(cylinder.changePercent);
                  const dryIceSignificant = isSignificantGrowth(dryIce?.changePercent || 0);
                  const rowHighlight = highlightSignificant && (cylinderSignificant || dryIceSignificant);
                  
                  return (
                    <tr 
                      key={cylinder.month} 
                      className={`border-b hover:bg-muted/50 ${
                        rowHighlight 
                          ? cylinderSignificant && cylinder.changePercent > 10 || dryIceSignificant && (dryIce?.changePercent || 0) > 10
                            ? "bg-green-500/10"
                            : "bg-red-500/10"
                          : ""
                      }`}
                    >
                      <td className="py-3 px-2 font-medium">
                        {cylinder.monthName}
                        {highlightSignificant && (cylinderSignificant || dryIceSignificant) && (
                          <Badge 
                            variant={cylinder.changePercent > 10 || (dryIce?.changePercent || 0) > 10 ? "default" : "destructive"} 
                            className="ml-2 text-[10px] px-1.5 py-0"
                          >
                            Significant
                          </Badge>
                        )}
                      </td>
                      <td className={`text-right py-3 px-2 ${highlightSignificant && cylinderSignificant ? "font-semibold" : ""}`}>
                        {cylinder.currentYear.toLocaleString()}
                      </td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{cylinder.previousYear.toLocaleString()}</td>
                      <td className={`text-right py-3 px-2 ${getChangeColor(cylinder.changePercent)} ${highlightSignificant && cylinderSignificant ? "font-bold" : ""}`}>
                        {cylinder.changePercent >= 0 ? "+" : ""}{cylinder.changePercent.toFixed(1)}%
                      </td>
                      <td className={`text-right py-3 px-2 ${highlightSignificant && dryIceSignificant ? "font-semibold" : ""}`}>
                        {dryIce?.currentYear.toLocaleString() || 0}
                      </td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{dryIce?.previousYear.toLocaleString() || 0}</td>
                      <td className={`text-right py-3 px-2 ${getChangeColor(dryIce?.changePercent || 0)} ${highlightSignificant && dryIceSignificant ? "font-bold" : ""}`}>
                        {(dryIce?.changePercent || 0) >= 0 ? "+" : ""}{(dryIce?.changePercent || 0).toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="bg-muted/30 font-bold">
                  <td className="py-3 px-2">Totaal</td>
                  <td className="text-right py-3 px-2">{cylinderTotals?.currentYear.toLocaleString()}</td>
                  <td className="text-right py-3 px-2 text-muted-foreground">{cylinderTotals?.previousYear.toLocaleString()}</td>
                  <td className={`text-right py-3 px-2 ${getChangeColor(cylinderTotals?.changePercent || 0)}`}>
                    {(cylinderTotals?.changePercent || 0) >= 0 ? "+" : ""}{(cylinderTotals?.changePercent || 0).toFixed(1)}%
                  </td>
                  <td className="text-right py-3 px-2">{dryIceTotals?.currentYear.toLocaleString()}</td>
                  <td className="text-right py-3 px-2 text-muted-foreground">{dryIceTotals?.previousYear.toLocaleString()}</td>
                  <td className={`text-right py-3 px-2 ${getChangeColor(dryIceTotals?.changePercent || 0)}`}>
                    {(dryIceTotals?.changePercent || 0) >= 0 ? "+" : ""}{(dryIceTotals?.changePercent || 0).toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
