import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, Minus, Cylinder, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
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

  useEffect(() => {
    // Generate years from 2024 to current year + 1
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= 2024; y--) {
      years.push(y);
    }
    setAvailableYears(years);
  }, []);

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
    const [currentCylinderRes, previousCylinderRes, currentDryIceRes, previousDryIceRes] = await Promise.all([
      supabase.rpc("get_monthly_order_totals", { p_year: currentYear, p_order_type: "cylinder" }),
      supabase.rpc("get_monthly_order_totals", { p_year: previousYear, p_order_type: "cylinder" }),
      supabase.rpc("get_monthly_order_totals", { p_year: currentYear, p_order_type: "dry_ice" }),
      supabase.rpc("get_monthly_order_totals", { p_year: previousYear, p_order_type: "dry_ice" })
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

    setLoading(false);
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
        <CardContent>
          <div className="flex items-center gap-4">
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

      {/* Growth Trend Line Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Procentuele groei per maand</CardTitle>
          <CardDescription>
            Verandering t.o.v. {selectedYear - 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart
              data={cylinderData.map((c, i) => ({
                monthName: c.monthName,
                cylinders: c.changePercent,
                dryIce: dryIceData[i]?.changePercent || 0
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="monthName" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))'
                }}
                formatter={(value: number) => [`${value.toFixed(1)}%`]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="cylinders"
                name="Cilinders"
                stroke="#f97316"
                strokeWidth={2}
                dot={{ fill: "#f97316" }}
              />
              <Line
                type="monotone"
                dataKey="dryIce"
                name="Droogijs"
                stroke="#06b6d4"
                strokeWidth={2}
                dot={{ fill: "#06b6d4" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Monthly Details Table */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Maandelijks overzicht</CardTitle>
          <CardDescription>Gedetailleerde vergelijking per maand</CardDescription>
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
                  return (
                    <tr key={cylinder.month} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-2 font-medium">{cylinder.monthName}</td>
                      <td className="text-right py-3 px-2">{cylinder.currentYear.toLocaleString()}</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{cylinder.previousYear.toLocaleString()}</td>
                      <td className={`text-right py-3 px-2 ${getChangeColor(cylinder.changePercent)}`}>
                        {cylinder.changePercent >= 0 ? "+" : ""}{cylinder.changePercent.toFixed(1)}%
                      </td>
                      <td className="text-right py-3 px-2">{dryIce?.currentYear.toLocaleString() || 0}</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{dryIce?.previousYear.toLocaleString() || 0}</td>
                      <td className={`text-right py-3 px-2 ${getChangeColor(dryIce?.changePercent || 0)}`}>
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
