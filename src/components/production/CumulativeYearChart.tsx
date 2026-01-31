import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Cylinder, Snowflake, LineChart as LineChartIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface YearlyMonthlyData {
  year: number;
  months: number[];
}

interface CumulativeChartData {
  month: number;
  monthName: string;
  [key: string]: number | string; // Dynamic keys for each year
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

// Colors for different years - distinct and accessible
const YEAR_COLORS: Record<number, string> = {
  2017: "#1e40af", // blue-800
  2018: "#7c3aed", // violet-600
  2019: "#059669", // emerald-600
  2020: "#dc2626", // red-600
  2021: "#ea580c", // orange-600
  2022: "#0891b2", // cyan-600
  2023: "#4f46e5", // indigo-600
  2024: "#16a34a", // green-600
  2025: "#f97316", // orange-500
  2026: "#0ea5e9", // sky-500
  2027: "#8b5cf6", // violet-500
};

const getYearColor = (year: number): string => {
  return YEAR_COLORS[year] || `hsl(${(year * 47) % 360}, 70%, 50%)`;
};

interface CumulativeYearChartProps {
  type: "cylinders" | "dryIce";
}

export function CumulativeYearChart({ type }: CumulativeYearChartProps) {
  const [loading, setLoading] = useState(true);
  const [yearlyData, setYearlyData] = useState<YearlyMonthlyData[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  useEffect(() => {
    fetchAllYearsData();
  }, [type]);

  const fetchAllYearsData = async () => {
    setLoading(true);

    const currentYear = new Date().getFullYear();
    const startYear = 2017;
    const years: number[] = [];
    
    for (let y = currentYear; y >= startYear; y--) {
      years.push(y);
    }

    // Fetch data for all years in parallel
    const orderType = type === "cylinders" ? "cylinder" : "dry_ice";
    const promises = years.map(year => 
      supabase.rpc("get_monthly_order_totals", { 
        p_year: year, 
        p_order_type: orderType 
      })
    );

    const results = await Promise.all(promises);

    const allYearData: YearlyMonthlyData[] = [];

    results.forEach((result, index) => {
      const year = years[index];
      const monthlyTotals = new Array(12).fill(0);

      if (result.data) {
        result.data.forEach((item: { month: number; total_value: number }) => {
          monthlyTotals[item.month - 1] = Number(item.total_value) || 0;
        });
      }

      // Only include years that have data
      const hasData = monthlyTotals.some(v => v > 0);
      if (hasData) {
        allYearData.push({
          year,
          months: monthlyTotals
        });
      }
    });

    // Sort by year descending
    allYearData.sort((a, b) => b.year - a.year);

    setYearlyData(allYearData);
    setAvailableYears(allYearData.map(d => d.year));
    
    // Default: select current year and previous 2 years that have data
    const defaultYears = allYearData.slice(0, 4).map(d => d.year);
    setSelectedYears(defaultYears);

    setLoading(false);
  };

  const cumulativeChartData = useMemo(() => {
    const chartData: CumulativeChartData[] = [];

    for (let m = 0; m < 12; m++) {
      const entry: CumulativeChartData = {
        month: m + 1,
        monthName: MONTH_NAMES[m]
      };

      // Calculate cumulative values for each selected year
      selectedYears.forEach(year => {
        const yearData = yearlyData.find(d => d.year === year);
        if (yearData) {
          let cumulative = 0;
          for (let i = 0; i <= m; i++) {
            cumulative += yearData.months[i];
          }
          entry[year.toString()] = cumulative;
        }
      });

      chartData.push(entry);
    }

    return chartData;
  }, [yearlyData, selectedYears]);

  const toggleYear = (year: number) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year);
      } else {
        return [...prev, year].sort((a, b) => b - a);
      }
    });
  };

  const selectAllYears = () => {
    setSelectedYears(availableYears);
  };

  const clearYears = () => {
    setSelectedYears([]);
  };

  if (loading) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const icon = type === "cylinders" 
    ? <Cylinder className="h-5 w-5 text-orange-500" />
    : <Snowflake className="h-5 w-5 text-cyan-500" />;
  
  const title = type === "cylinders" 
    ? "Cilindervullingen per jaar cumulatief"
    : "Droogijs per jaar cumulatief (kg)";

  const borderColor = type === "cylinders" 
    ? "border-orange-500/20"
    : "border-cyan-500/20";

  return (
    <Card className={`glass-card ${borderColor}`}>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          {icon}
          <LineChartIcon className="h-4 w-4" />
          {title}
        </CardTitle>
        <CardDescription>
          Cumulatieve productie per maand — vergelijk meerdere jaren
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Year Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Selecteer jaren</Label>
            <div className="flex gap-2">
              <button 
                onClick={selectAllYears}
                className="text-xs text-primary hover:underline"
              >
                Alles
              </button>
              <span className="text-muted-foreground">|</span>
              <button 
                onClick={clearYears}
                className="text-xs text-primary hover:underline"
              >
                Wissen
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableYears.map(year => {
              const isSelected = selectedYears.includes(year);
              return (
                <Badge
                  key={year}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  style={{
                    backgroundColor: isSelected ? getYearColor(year) : undefined,
                    borderColor: getYearColor(year),
                    color: isSelected ? "white" : getYearColor(year)
                  }}
                  onClick={() => toggleYear(year)}
                >
                  {year}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Cumulative Line Chart */}
        {selectedYears.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={cumulativeChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="monthName" 
                className="text-xs"
              />
              <YAxis 
                className="text-xs"
                tickFormatter={(value) => value.toLocaleString()}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => [
                  value.toLocaleString() + (type === "dryIce" ? " kg" : ""),
                  name
                ]}
                labelFormatter={(label) => `Maand: ${label}`}
              />
              <Legend />
              {selectedYears.map(year => (
                <Line
                  key={year}
                  type="monotone"
                  dataKey={year.toString()}
                  name={year.toString()}
                  stroke={getYearColor(year)}
                  strokeWidth={2}
                  dot={{ fill: getYearColor(year), r: 3 }}
                  activeDot={{ r: 5 }}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Selecteer minimaal één jaar om de grafiek te tonen
          </div>
        )}

        {/* Summary Table */}
        {selectedYears.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">Jaar</th>
                  {MONTH_NAMES.map(month => (
                    <th key={month} className="text-right py-2 px-1 font-medium text-xs">{month}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedYears.map(year => {
                  const yearData = yearlyData.find(d => d.year === year);
                  if (!yearData) return null;

                  let cumulative = 0;
                  const cumulativeValues = yearData.months.map(v => {
                    cumulative += v;
                    return cumulative;
                  });

                  return (
                    <tr key={year} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium">
                        <span 
                          className="inline-block w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: getYearColor(year) }}
                        />
                        {year}
                      </td>
                      {cumulativeValues.map((value, i) => (
                        <td key={i} className="text-right py-2 px-1 text-xs">
                          {value > 0 ? value.toLocaleString() : "-"}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
