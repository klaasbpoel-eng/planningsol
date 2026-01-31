import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Cylinder, LineChart as LineChartIcon } from "lucide-react";
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

interface GasTypeData {
  id: string;
  name: string;
  color: string;
  months: number[];
}

interface CumulativeChartData {
  month: number;
  monthName: string;
  [key: string]: number | string;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

export function CumulativeGasTypeChart() {
  const [loading, setLoading] = useState(true);
  const [gasTypeData, setGasTypeData] = useState<GasTypeData[]>([]);
  const [selectedGasTypes, setSelectedGasTypes] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([]);

  useEffect(() => {
    // Generate available years
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= 2017; y--) {
      years.push(y);
    }
    setAvailableYears(years);
  }, []);

  useEffect(() => {
    fetchGasTypeData();
  }, [selectedYear]);

  const fetchGasTypeData = async () => {
    setLoading(true);

    const { data, error } = await supabase.rpc("get_monthly_cylinder_totals_by_gas_type", {
      p_year: selectedYear
    });

    if (error) {
      console.error("Error fetching gas type data:", error);
      setLoading(false);
      return;
    }

    // Process data into gas type structure
    const gasTypeMap = new Map<string, GasTypeData>();

    data?.forEach((item: { month: number; gas_type_id: string; gas_type_name: string; gas_type_color: string; total_cylinders: number }) => {
      if (!item.gas_type_id) return;

      if (!gasTypeMap.has(item.gas_type_id)) {
        gasTypeMap.set(item.gas_type_id, {
          id: item.gas_type_id,
          name: item.gas_type_name || "Onbekend",
          color: item.gas_type_color || "#94a3b8",
          months: new Array(12).fill(0)
        });
      }

      const gasType = gasTypeMap.get(item.gas_type_id)!;
      gasType.months[item.month - 1] = Number(item.total_cylinders) || 0;
    });

    const allGasTypes = Array.from(gasTypeMap.values())
      .filter(gt => gt.months.some(v => v > 0))
      .sort((a, b) => {
        const totalA = a.months.reduce((sum, v) => sum + v, 0);
        const totalB = b.months.reduce((sum, v) => sum + v, 0);
        return totalB - totalA;
      });

    setGasTypeData(allGasTypes);

    // Default: select top 5 gas types
    if (selectedGasTypes.length === 0) {
      setSelectedGasTypes(allGasTypes.slice(0, 5).map(gt => gt.id));
    }

    setLoading(false);
  };

  const cumulativeChartData = useMemo(() => {
    const chartData: CumulativeChartData[] = [];

    for (let m = 0; m < 12; m++) {
      const entry: CumulativeChartData = {
        month: m + 1,
        monthName: MONTH_NAMES[m]
      };

      selectedGasTypes.forEach(gasTypeId => {
        const gasType = gasTypeData.find(gt => gt.id === gasTypeId);
        if (gasType) {
          let cumulative = 0;
          for (let i = 0; i <= m; i++) {
            cumulative += gasType.months[i];
          }
          entry[gasTypeId] = cumulative;
        }
      });

      chartData.push(entry);
    }

    return chartData;
  }, [gasTypeData, selectedGasTypes]);

  const toggleGasType = (gasTypeId: string) => {
    setSelectedGasTypes(prev => {
      if (prev.includes(gasTypeId)) {
        return prev.filter(id => id !== gasTypeId);
      } else {
        return [...prev, gasTypeId];
      }
    });
  };

  const selectAllGasTypes = () => {
    setSelectedGasTypes(gasTypeData.map(gt => gt.id));
  };

  const clearGasTypes = () => {
    setSelectedGasTypes([]);
  };

  const getGasTypeInfo = (id: string) => {
    return gasTypeData.find(gt => gt.id === id);
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

  return (
    <Card className="glass-card border-orange-500/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cylinder className="h-5 w-5 text-orange-500" />
              <LineChartIcon className="h-4 w-4" />
              Cilinders per gastype cumulatief
            </CardTitle>
            <CardDescription>
              Cumulatieve productie per maand — per gastype
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground">Jaar:</Label>
            <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
              <SelectTrigger className="w-24">
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gas Type Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Selecteer gastypes</Label>
            <div className="flex gap-2">
              <button 
                onClick={selectAllGasTypes}
                className="text-xs text-primary hover:underline"
              >
                Alles
              </button>
              <span className="text-muted-foreground">|</span>
              <button 
                onClick={clearGasTypes}
                className="text-xs text-primary hover:underline"
              >
                Wissen
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {gasTypeData.map(gasType => {
              const isSelected = selectedGasTypes.includes(gasType.id);
              return (
                <Badge
                  key={gasType.id}
                  variant={isSelected ? "default" : "outline"}
                  className="cursor-pointer transition-colors"
                  style={{
                    backgroundColor: isSelected ? gasType.color : undefined,
                    borderColor: gasType.color,
                    color: isSelected ? "white" : gasType.color
                  }}
                  onClick={() => toggleGasType(gasType.id)}
                >
                  {gasType.name}
                </Badge>
              );
            })}
          </div>
        </div>

        {/* Cumulative Line Chart */}
        {selectedGasTypes.length > 0 ? (
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
                formatter={(value: number, name: string) => {
                  const info = getGasTypeInfo(name);
                  return [value.toLocaleString(), info?.name || name];
                }}
                labelFormatter={(label) => `Maand: ${label}`}
              />
              <Legend 
                formatter={(value) => {
                  const info = getGasTypeInfo(value);
                  return info?.name || value;
                }}
              />
              {selectedGasTypes.map(gasTypeId => {
                const info = getGasTypeInfo(gasTypeId);
                return (
                  <Line
                    key={gasTypeId}
                    type="monotone"
                    dataKey={gasTypeId}
                    name={gasTypeId}
                    stroke={info?.color || "#94a3b8"}
                    strokeWidth={2}
                    dot={{ fill: info?.color || "#94a3b8", r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                );
              })}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            Selecteer minimaal één gastype om de grafiek te tonen
          </div>
        )}

        {/* Summary Table */}
        {selectedGasTypes.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2 font-medium">Gastype</th>
                  {MONTH_NAMES.map(month => (
                    <th key={month} className="text-right py-2 px-1 font-medium text-xs">{month}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedGasTypes.map(gasTypeId => {
                  const gasType = gasTypeData.find(gt => gt.id === gasTypeId);
                  if (!gasType) return null;

                  let cumulative = 0;
                  const cumulativeValues = gasType.months.map(v => {
                    cumulative += v;
                    return cumulative;
                  });

                  return (
                    <tr key={gasTypeId} className="border-b hover:bg-muted/50">
                      <td className="py-2 px-2 font-medium">
                        <span 
                          className="inline-block w-3 h-3 rounded-full mr-2"
                          style={{ backgroundColor: gasType.color }}
                        />
                        {gasType.name}
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
