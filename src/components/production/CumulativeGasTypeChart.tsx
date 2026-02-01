import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Cylinder, LineChart as LineChartIcon, TrendingUp, TrendingDown, Minus, Trophy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/utils";
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

interface YearData {
  year: number;
  gasTypes: GasTypeData[];
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
  const [yearData, setYearData] = useState<YearData[]>([]);
  const [selectedGasTypes, setSelectedGasTypes] = useState<string[]>([]);
  const [selectedYear1, setSelectedYear1] = useState<number>(new Date().getFullYear());
  const [selectedYear2, setSelectedYear2] = useState<number>(new Date().getFullYear() - 1);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [allGasTypes, setAllGasTypes] = useState<{ id: string; name: string; color: string }[]>([]);
  const [animatingTopFive, setAnimatingTopFive] = useState(false);
  const [animatingAll, setAnimatingAll] = useState(false);
  const [animatingClear, setAnimatingClear] = useState(false);
  

  useEffect(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear; y >= 2017; y--) {
      years.push(y);
    }
    setAvailableYears(years);
  }, []);

  useEffect(() => {
    fetchBothYearsData();
  }, [selectedYear1, selectedYear2]);

  const fetchBothYearsData = async () => {
    setLoading(true);

    const [result1, result2] = await Promise.all([
      supabase.rpc("get_monthly_cylinder_totals_by_gas_type", { p_year: selectedYear1 }),
      supabase.rpc("get_monthly_cylinder_totals_by_gas_type", { p_year: selectedYear2 })
    ]);

    const processData = (data: any[]): GasTypeData[] => {
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

      return Array.from(gasTypeMap.values());
    };

    const year1Data = processData(result1.data || []);
    const year2Data = processData(result2.data || []);

    // Collect all unique gas types from both years
    const gasTypeMap = new Map<string, { id: string; name: string; color: string }>();
    [...year1Data, ...year2Data].forEach(gt => {
      if (!gasTypeMap.has(gt.id)) {
        gasTypeMap.set(gt.id, { id: gt.id, name: gt.name, color: gt.color });
      }
    });

    const allTypes = Array.from(gasTypeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    setAllGasTypes(allTypes);

    setYearData([
      { year: selectedYear1, gasTypes: year1Data },
      { year: selectedYear2, gasTypes: year2Data }
    ]);

    // No default selection - start with empty selection

    setLoading(false);
  };

  const getGasTypeInfo = (id: string) => {
    return allGasTypes.find(gt => gt.id === id);
  };

  // Calculate growth/decline percentages per gas type
  const growthData = useMemo(() => {
    return selectedGasTypes.map(gasTypeId => {
      const info = allGasTypes.find(gt => gt.id === gasTypeId);
      const year1DataItem = yearData.find(yd => yd.year === selectedYear1);
      const year2DataItem = yearData.find(yd => yd.year === selectedYear2);
      
      const gasType1 = year1DataItem?.gasTypes.find(gt => gt.id === gasTypeId);
      const gasType2 = year2DataItem?.gasTypes.find(gt => gt.id === gasTypeId);
      
      const total1 = gasType1?.months.reduce((a, b) => a + b, 0) || 0;
      const total2 = gasType2?.months.reduce((a, b) => a + b, 0) || 0;
      
      let percentChange = 0;
      if (total2 > 0) {
        percentChange = ((total1 - total2) / total2) * 100;
      } else if (total1 > 0) {
        percentChange = 100;
      }
      
      return {
        id: gasTypeId,
        name: info?.name || gasTypeId,
        color: info?.color || "#94a3b8",
        total1,
        total2,
        difference: total1 - total2,
        percentChange
      };
    });
  }, [selectedGasTypes, yearData, selectedYear1, selectedYear2, allGasTypes]);

  const cumulativeChartData = useMemo(() => {
    const chartData: CumulativeChartData[] = [];

    for (let m = 0; m < 12; m++) {
      const entry: CumulativeChartData = {
        month: m + 1,
        monthName: MONTH_NAMES[m]
      };

      selectedGasTypes.forEach(gasTypeId => {
        yearData.forEach(yd => {
          const gasType = yd.gasTypes.find(gt => gt.id === gasTypeId);
          if (gasType) {
            let cumulative = 0;
            for (let i = 0; i <= m; i++) {
              cumulative += gasType.months[i];
            }
            entry[`${gasTypeId}_${yd.year}`] = cumulative;
          } else {
            entry[`${gasTypeId}_${yd.year}`] = 0;
          }
        });
      });

      chartData.push(entry);
    }

    return chartData;
  }, [yearData, selectedGasTypes]);

  const toggleGasType = (gasTypeId: string) => {
    setSelectedGasTypes(prev => {
      if (prev.includes(gasTypeId)) {
        return prev.filter(id => id !== gasTypeId);
      } else {
        return [...prev, gasTypeId];
      }
    });
  };

  // Calculate all gas type volumes for tooltips
  const allGasTypeVolumes = useMemo(() => {
    return allGasTypes.map(gt => {
      const y1 = yearData.find(yd => yd.year === selectedYear1)?.gasTypes.find(d => d.id === gt.id);
      const y2 = yearData.find(yd => yd.year === selectedYear2)?.gasTypes.find(d => d.id === gt.id);
      const total = (y1?.months.reduce((a, b) => a + b, 0) || 0) + (y2?.months.reduce((a, b) => a + b, 0) || 0);
      return { id: gt.id, total };
    });
  }, [allGasTypes, yearData, selectedYear1, selectedYear2]);

  const totalAllGasTypesVolume = useMemo(() => {
    return allGasTypeVolumes.reduce((sum, gtv) => sum + gtv.total, 0);
  }, [allGasTypeVolumes]);

  const topFiveWithVolume = useMemo(() => {
    return [...allGasTypeVolumes].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [allGasTypeVolumes]);

  const topFiveGasTypes = topFiveWithVolume.map(t => t.id);

  const getGasTypeVolume = (gasTypeId: string) => {
    return allGasTypeVolumes.find(t => t.id === gasTypeId)?.total || 0;
  };

  const getGasTypePercentage = (gasTypeId: string) => {
    if (totalAllGasTypesVolume === 0) return 0;
    return (getGasTypeVolume(gasTypeId) / totalAllGasTypesVolume) * 100;
  };

  const selectTopFive = () => {
    setSelectedGasTypes(topFiveGasTypes);
    setAnimatingTopFive(true);
    setTimeout(() => setAnimatingTopFive(false), 600);
  };

  const selectAllGasTypes = () => {
    setSelectedGasTypes(allGasTypes.map(gt => gt.id));
    setAnimatingAll(true);
    setTimeout(() => setAnimatingAll(false), 600);
  };

  const clearGasTypes = () => {
    setSelectedGasTypes([]);
    setAnimatingClear(true);
    setTimeout(() => setAnimatingClear(false), 300);
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
              Cilinders per gastype — jaarvergelijking
            </CardTitle>
            <CardDescription>
              Cumulatieve productie per maand — vergelijk twee jaren
            </CardDescription>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Jaar 1:</Label>
              <Select value={selectedYear1.toString()} onValueChange={(v) => setSelectedYear1(parseInt(v))}>
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
            <div className="flex items-center gap-2">
              <Label className="text-sm text-muted-foreground">Jaar 2:</Label>
              <Select value={selectedYear2.toString()} onValueChange={(v) => setSelectedYear2(parseInt(v))}>
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
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Gas Type Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Selecteer gastypes</Label>
            <div className="flex gap-2">
              <button 
                onClick={selectTopFive}
                className="text-xs text-primary font-medium px-2 py-1 rounded-md transition-all duration-200 hover:bg-primary/10 hover:scale-105 active:scale-95"
              >
                Top 5
              </button>
              <span className="text-muted-foreground">|</span>
              <button 
                onClick={selectAllGasTypes}
                className="text-xs text-primary font-medium px-2 py-1 rounded-md transition-all duration-200 hover:bg-primary/10 hover:scale-105 active:scale-95"
              >
                Alles
              </button>
              <span className="text-muted-foreground">|</span>
              <button 
                onClick={clearGasTypes}
                className="text-xs text-primary font-medium px-2 py-1 rounded-md transition-all duration-200 hover:bg-primary/10 hover:scale-105 active:scale-95"
              >
                Wissen
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {allGasTypes.map(gasType => {
              const isSelected = selectedGasTypes.includes(gasType.id);
              const isTopFive = topFiveGasTypes.includes(gasType.id);
              const topRank = topFiveGasTypes.indexOf(gasType.id);
              const shouldAnimate = 
                (animatingTopFive && isTopFive) || 
                animatingAll || 
                (animatingClear && isSelected);
              const gasTypeVolume = getGasTypeVolume(gasType.id);
              
              return (
                <TooltipProvider key={gasType.id} delayDuration={0}>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer transition-all duration-200 flex items-center gap-1 hover:scale-105 hover:shadow-md active:scale-95 ${
                          shouldAnimate 
                            ? "animate-[pulse_0.3s_ease-in-out_2] scale-110" 
                            : ""
                        }`}
                        style={{
                          backgroundColor: isSelected ? gasType.color : undefined,
                          borderColor: gasType.color,
                          color: isSelected ? "white" : gasType.color
                        }}
                        onClick={() => toggleGasType(gasType.id)}
                      >
                        {isTopFive && (
                          <Trophy 
                            className={`h-3 w-3 ${
                              topRank === 0 ? "text-yellow-400" : 
                              topRank === 1 ? "text-gray-300" : 
                              topRank === 2 ? "text-amber-600" : 
                              isSelected ? "text-white/70" : "opacity-50"
                            }`} 
                          />
                        )}
                        {gasType.name}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="text-center">
                        {isTopFive && (
                          <div className="font-medium text-primary">#{topRank + 1} in volume</div>
                        )}
                        <div className={isTopFive ? "text-muted-foreground" : "font-medium"}>
                          {formatNumber(gasTypeVolume, 0)} cilinders
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          {getGasTypePercentage(gasType.id).toFixed(1)}% van totaal
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          ({selectedYear1} + {selectedYear2})
                        </div>
                      </div>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>

        {/* Growth/Decline Indicators */}
        {selectedGasTypes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {growthData.map(item => (
              <div 
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-medium text-sm truncate max-w-[120px]">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right text-xs text-muted-foreground">
                    <div>{formatNumber(item.total1, 0)} ({selectedYear1})</div>
                    <div>{formatNumber(item.total2, 0)} ({selectedYear2})</div>
                  </div>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
                    item.percentChange > 0 
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' 
                      : item.percentChange < 0 
                        ? 'bg-red-500/10 text-red-600 dark:text-red-400'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {item.percentChange > 0 ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : item.percentChange < 0 ? (
                      <TrendingDown className="h-3 w-3" />
                    ) : (
                      <Minus className="h-3 w-3" />
                    )}
                    <span>
                      {item.percentChange > 0 ? '+' : ''}
                      {item.percentChange.toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Legend for years */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-current" />
            <span>{selectedYear1} (doorgetrokken)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-0.5 bg-current border-dashed border-t-2 border-current" style={{ borderStyle: 'dashed' }} />
            <span>{selectedYear2} (gestreept)</span>
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
                tickFormatter={(value) => formatNumber(value, 0)}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--background))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => {
                  const [gasTypeId, year] = name.split('_');
                  const info = getGasTypeInfo(gasTypeId);
                  return [formatNumber(value, 0), `${info?.name || gasTypeId} (${year})`];
                }}
                labelFormatter={(label) => `Maand: ${label}`}
              />
              <Legend 
                formatter={(value) => {
                  const [gasTypeId, year] = value.split('_');
                  const info = getGasTypeInfo(gasTypeId);
                  return `${info?.name || gasTypeId} (${year})`;
                }}
              />
              {selectedGasTypes.flatMap(gasTypeId => {
                const info = getGasTypeInfo(gasTypeId);
                return [
                  <Line
                    key={`${gasTypeId}_${selectedYear1}`}
                    type="monotone"
                    dataKey={`${gasTypeId}_${selectedYear1}`}
                    name={`${gasTypeId}_${selectedYear1}`}
                    stroke={info?.color || "#94a3b8"}
                    strokeWidth={2}
                    dot={{ fill: info?.color || "#94a3b8", r: 3 }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />,
                  <Line
                    key={`${gasTypeId}_${selectedYear2}`}
                    type="monotone"
                    dataKey={`${gasTypeId}_${selectedYear2}`}
                    name={`${gasTypeId}_${selectedYear2}`}
                    stroke={info?.color || "#94a3b8"}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: info?.color || "#94a3b8", r: 3, strokeDasharray: "0" }}
                    activeDot={{ r: 5 }}
                    connectNulls
                  />
                ];
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
                  <th className="text-left py-2 px-2 font-medium">Jaar</th>
                  {MONTH_NAMES.map(month => (
                    <th key={month} className="text-right py-2 px-1 font-medium text-xs">{month}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {selectedGasTypes.flatMap(gasTypeId => {
                  const info = getGasTypeInfo(gasTypeId);
                  
                  return yearData.map((yd, yIdx) => {
                    const gasType = yd.gasTypes.find(gt => gt.id === gasTypeId);
                    let cumulative = 0;
                    const cumulativeValues = (gasType?.months || new Array(12).fill(0)).map(v => {
                      cumulative += v;
                      return cumulative;
                    });

                    return (
                      <tr key={`${gasTypeId}_${yd.year}`} className="border-b hover:bg-muted/50">
                        {yIdx === 0 && (
                          <td className="py-2 px-2 font-medium" rowSpan={2}>
                            <span 
                              className="inline-block w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: info?.color }}
                            />
                            {info?.name}
                          </td>
                        )}
                        <td className="py-2 px-2 text-muted-foreground">
                          {yd.year}
                        </td>
                        {cumulativeValues.map((value, i) => (
                          <td key={i} className="text-right py-2 px-1 text-xs">
                            {value > 0 ? formatNumber(value, 0) : "-"}
                          </td>
                        ))}
                      </tr>
                    );
                  });
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}