import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Loader2, Cylinder, LineChart as LineChartIcon, TrendingUp, TrendingDown, Minus, Trophy, Ruler } from "lucide-react";
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
} from "recharts";

interface CylinderSizeData {
  name: string;
  capacityLiters: number | null;
  months: number[];
}

interface YearData {
  year: number;
  cylinderSizes: CylinderSizeData[];
}

interface CumulativeChartData {
  month: number;
  monthName: string;
  [key: string]: number | string;
}

interface CylinderSizeInfo {
  name: string;
  capacityLiters: number | null;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

// Generate colors for cylinder sizes based on capacity
const getColorForSize = (name: string, index: number): string => {
  const colors = [
    "#06b6d4", "#f97316", "#22c55e", "#ef4444", "#8b5cf6", 
    "#eab308", "#ec4899", "#14b8a6", "#6366f1", "#84cc16",
    "#f43f5e", "#0ea5e9", "#a855f7", "#10b981", "#f59e0b"
  ];
  return colors[index % colors.length];
};

// Get capacity group label
const getCapacityGroup = (capacity: number | null): string => {
  if (capacity === null) return "Overig";
  if (capacity <= 10) return "Klein (≤10L)";
  if (capacity <= 50) return "Medium (11-50L)";
  if (capacity <= 100) return "Groot (51-100L)";
  return "Bundels (>100L)";
};

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface CumulativeCylinderSizeChartProps {
  location?: ProductionLocation;
}

export function CumulativeCylinderSizeChart({ location = "all" }: CumulativeCylinderSizeChartProps) {
  const [loading, setLoading] = useState(true);
  const [yearData, setYearData] = useState<YearData[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedYear1, setSelectedYear1] = useState<number>(new Date().getFullYear());
  const [selectedYear2, setSelectedYear2] = useState<number>(new Date().getFullYear() - 1);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [allCylinderSizes, setAllCylinderSizes] = useState<CylinderSizeInfo[]>([]);
  const [cylinderSizeColors, setCylinderSizeColors] = useState<Map<string, string>>(new Map());
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
  }, [selectedYear1, selectedYear2, location]);

  const fetchBothYearsData = async () => {
    setLoading(true);

    // Fetch cylinder sizes metadata for capacity info
    const { data: cylinderSizesData } = await supabase
      .from("cylinder_sizes")
      .select("name, capacity_liters")
      .eq("is_active", true)
      .order("sort_order");

    const cylinderSizeCapacities = new Map<string, number | null>();
    cylinderSizesData?.forEach(cs => {
      cylinderSizeCapacities.set(cs.name, cs.capacity_liters);
    });

    const locationParam = location !== "all" ? location : null;

    const [result1, result2] = await Promise.all([
      supabase.rpc("get_monthly_cylinder_totals_by_size", { p_year: selectedYear1, p_location: locationParam }),
      supabase.rpc("get_monthly_cylinder_totals_by_size", { p_year: selectedYear2, p_location: locationParam })
    ]);

    const processData = (data: any[]): CylinderSizeData[] => {
      const sizeMap = new Map<string, CylinderSizeData>();

      data?.forEach((item: { month: number; cylinder_size: string; total_cylinders: number }) => {
        if (!item.cylinder_size) return;

        if (!sizeMap.has(item.cylinder_size)) {
          sizeMap.set(item.cylinder_size, {
            name: item.cylinder_size,
            capacityLiters: cylinderSizeCapacities.get(item.cylinder_size) ?? null,
            months: new Array(12).fill(0)
          });
        }

        const size = sizeMap.get(item.cylinder_size)!;
        size.months[item.month - 1] = Number(item.total_cylinders) || 0;
      });

      return Array.from(sizeMap.values());
    };

    const year1Data = processData(result1.data || []);
    const year2Data = processData(result2.data || []);

    // Collect all unique cylinder sizes from both years
    const sizeMap = new Map<string, CylinderSizeInfo>();
    [...year1Data, ...year2Data].forEach(cs => {
      if (!sizeMap.has(cs.name)) {
        sizeMap.set(cs.name, { name: cs.name, capacityLiters: cs.capacityLiters });
      }
    });

    const allSizes = Array.from(sizeMap.values()).sort((a, b) => {
      // Sort by capacity (nulls at end)
      if (a.capacityLiters === null && b.capacityLiters === null) return a.name.localeCompare(b.name);
      if (a.capacityLiters === null) return 1;
      if (b.capacityLiters === null) return -1;
      return a.capacityLiters - b.capacityLiters;
    });
    setAllCylinderSizes(allSizes);

    // Generate colors for each size
    const colorMap = new Map<string, string>();
    allSizes.forEach((size, index) => {
      colorMap.set(size.name, getColorForSize(size.name, index));
    });
    setCylinderSizeColors(colorMap);

    setYearData([
      { year: selectedYear1, cylinderSizes: year1Data },
      { year: selectedYear2, cylinderSizes: year2Data }
    ]);

    // No default selection - start with empty selection
    setLoading(false);
  };

  // Calculate growth/decline percentages per cylinder size
  const growthData = useMemo(() => {
    return selectedSizes.map(sizeName => {
      const info = allCylinderSizes.find(cs => cs.name === sizeName);
      const year1DataItem = yearData.find(yd => yd.year === selectedYear1);
      const year2DataItem = yearData.find(yd => yd.year === selectedYear2);
      
      const size1 = year1DataItem?.cylinderSizes.find(cs => cs.name === sizeName);
      const size2 = year2DataItem?.cylinderSizes.find(cs => cs.name === sizeName);
      
      const total1 = size1?.months.reduce((a, b) => a + b, 0) || 0;
      const total2 = size2?.months.reduce((a, b) => a + b, 0) || 0;
      
      let percentChange = 0;
      if (total2 > 0) {
        percentChange = ((total1 - total2) / total2) * 100;
      } else if (total1 > 0) {
        percentChange = 100;
      }
      
      return {
        name: sizeName,
        capacityLiters: info?.capacityLiters ?? null,
        color: cylinderSizeColors.get(sizeName) || "#94a3b8",
        total1,
        total2,
        difference: total1 - total2,
        percentChange
      };
    });
  }, [selectedSizes, yearData, selectedYear1, selectedYear2, allCylinderSizes, cylinderSizeColors]);

  const cumulativeChartData = useMemo(() => {
    const chartData: CumulativeChartData[] = [];

    for (let m = 0; m < 12; m++) {
      const entry: CumulativeChartData = {
        month: m + 1,
        monthName: MONTH_NAMES[m]
      };

      selectedSizes.forEach(sizeName => {
        yearData.forEach(yd => {
          const size = yd.cylinderSizes.find(cs => cs.name === sizeName);
          if (size) {
            let cumulative = 0;
            for (let i = 0; i <= m; i++) {
              cumulative += size.months[i];
            }
            entry[`${sizeName}_${yd.year}`] = cumulative;
          } else {
            entry[`${sizeName}_${yd.year}`] = 0;
          }
        });
      });

      chartData.push(entry);
    }

    return chartData;
  }, [yearData, selectedSizes]);

  const toggleSize = (sizeName: string) => {
    setSelectedSizes(prev => {
      if (prev.includes(sizeName)) {
        return prev.filter(name => name !== sizeName);
      } else {
        return [...prev, sizeName];
      }
    });
  };

  // Calculate all cylinder size volumes for tooltips
  const allSizeVolumes = useMemo(() => {
    return allCylinderSizes.map(cs => {
      const y1 = yearData.find(yd => yd.year === selectedYear1)?.cylinderSizes.find(d => d.name === cs.name);
      const y2 = yearData.find(yd => yd.year === selectedYear2)?.cylinderSizes.find(d => d.name === cs.name);
      const total = (y1?.months.reduce((a, b) => a + b, 0) || 0) + (y2?.months.reduce((a, b) => a + b, 0) || 0);
      return { name: cs.name, total };
    });
  }, [allCylinderSizes, yearData, selectedYear1, selectedYear2]);

  const totalAllSizesVolume = useMemo(() => {
    return allSizeVolumes.reduce((sum, sv) => sum + sv.total, 0);
  }, [allSizeVolumes]);

  const topFiveWithVolume = useMemo(() => {
    return [...allSizeVolumes].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [allSizeVolumes]);

  const topFiveSizes = topFiveWithVolume.map(t => t.name);

  const getSizeVolume = (sizeName: string) => {
    return allSizeVolumes.find(t => t.name === sizeName)?.total || 0;
  };

  const getSizePercentage = (sizeName: string) => {
    if (totalAllSizesVolume === 0) return 0;
    return (getSizeVolume(sizeName) / totalAllSizesVolume) * 100;
  };

  const selectTopFive = () => {
    setSelectedSizes(topFiveSizes);
    setAnimatingTopFive(true);
    setTimeout(() => setAnimatingTopFive(false), 600);
  };

  const selectAllSizes = () => {
    setSelectedSizes(allCylinderSizes.map(cs => cs.name));
    setAnimatingAll(true);
    setTimeout(() => setAnimatingAll(false), 600);
  };

  const clearSizes = () => {
    setSelectedSizes([]);
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
    <Card className="glass-card border-purple-500/20">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ruler className="h-5 w-5 text-purple-500" />
              <LineChartIcon className="h-4 w-4" />
              Cilinders per grootte — jaarvergelijking
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
        {/* Cylinder Size Selection */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-sm text-muted-foreground">Selecteer cilindergroottes</Label>
            <div className="flex gap-2">
              <button 
                onClick={selectTopFive}
                className="text-xs text-primary font-medium px-2 py-1 rounded-md transition-all duration-200 hover:bg-primary/10 hover:scale-105 active:scale-95"
              >
                Top 5
              </button>
              <span className="text-muted-foreground">|</span>
              <button 
                onClick={selectAllSizes}
                className="text-xs text-primary font-medium px-2 py-1 rounded-md transition-all duration-200 hover:bg-primary/10 hover:scale-105 active:scale-95"
              >
                Alles
              </button>
              <span className="text-muted-foreground">|</span>
              <button 
                onClick={clearSizes}
                className="text-xs text-primary font-medium px-2 py-1 rounded-md transition-all duration-200 hover:bg-primary/10 hover:scale-105 active:scale-95"
              >
                Wissen
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {allCylinderSizes.map(size => {
              const isSelected = selectedSizes.includes(size.name);
              const isTopFive = topFiveSizes.includes(size.name);
              const topRank = topFiveSizes.indexOf(size.name);
              const shouldAnimate = 
                (animatingTopFive && isTopFive) || 
                animatingAll || 
                (animatingClear && isSelected);
              const sizeVolume = getSizeVolume(size.name);
              const sizeColor = cylinderSizeColors.get(size.name) || "#94a3b8";
              
              return (
                <TooltipProvider key={size.name} delayDuration={0}>
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
                          backgroundColor: isSelected ? sizeColor : undefined,
                          borderColor: sizeColor,
                          color: isSelected ? "white" : sizeColor
                        }}
                        onClick={() => toggleSize(size.name)}
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
                        {size.name}
                        {size.capacityLiters && (
                          <span className="text-[10px] opacity-75">({size.capacityLiters}L)</span>
                        )}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="text-center">
                        {isTopFive && (
                          <div className="font-medium text-primary">#{topRank + 1} in volume</div>
                        )}
                        <div className={isTopFive ? "text-muted-foreground" : "font-medium"}>
                          {formatNumber(sizeVolume, 0)} cilinders
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          {getSizePercentage(size.name).toFixed(1)}% van totaal
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          ({selectedYear1} + {selectedYear2})
                        </div>
                        {size.capacityLiters && (
                          <div className="text-muted-foreground text-[10px]">
                            {getCapacityGroup(size.capacityLiters)}
                          </div>
                        )}
                      </div>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
              );
            })}
          </div>
        </div>

        {/* Growth/Decline Indicators */}
        {selectedSizes.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {growthData.map(item => (
              <div 
                key={item.name}
                className="flex items-center justify-between p-3 rounded-lg border bg-card"
              >
                <div className="flex items-center gap-2">
                  <span 
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="flex flex-col">
                    <span className="font-medium text-sm truncate max-w-[120px]">{item.name}</span>
                    {item.capacityLiters && (
                      <span className="text-[10px] text-muted-foreground">{item.capacityLiters}L</span>
                    )}
                  </div>
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
        {selectedSizes.length > 0 ? (
          <ResponsiveContainer width="100%" height={400}>
            <LineChart data={cumulativeChartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="monthName" className="text-xs" />
              <YAxis className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
                formatter={(value: number, name: string) => {
                  const [sizeName, year] = name.split('_');
                  return [formatNumber(value, 0), `${sizeName} (${year})`];
                }}
              />
              {selectedSizes.map(sizeName => {
                const color = cylinderSizeColors.get(sizeName) || "#94a3b8";
                return [
                  <Line 
                    key={`${sizeName}_${selectedYear1}`}
                    type="monotone" 
                    dataKey={`${sizeName}_${selectedYear1}`}
                    name={`${sizeName}_${selectedYear1}`}
                    stroke={color}
                    strokeWidth={2}
                    dot={{ fill: color, strokeWidth: 2 }}
                    activeDot={{ r: 6, stroke: color }}
                  />,
                  <Line 
                    key={`${sizeName}_${selectedYear2}`}
                    type="monotone" 
                    dataKey={`${sizeName}_${selectedYear2}`}
                    name={`${sizeName}_${selectedYear2}`}
                    stroke={color}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ fill: color, strokeWidth: 2 }}
                    activeDot={{ r: 6, stroke: color }}
                  />
                ];
              }).flat()}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            <div className="text-center">
              <Cylinder className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Selecteer cilindergroottes om de grafiek te bekijken</p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
