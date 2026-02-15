import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip as UITooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Cylinder, Snowflake, LineChart as LineChartIcon, Trophy, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/utils";
import { ChartSkeleton } from "@/components/ui/skeletons/chart-skeleton";
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

// Constants
export const MONTH_NAMES = [
  "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

export const YEAR_COLORS: Record<number, string> = {
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

export const getYearColor = (year: number): string => {
  return YEAR_COLORS[year] || `hsl(${(year * 47) % 360}, 70%, 50%)`;
};

// Types
export type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface YearlyMonthlyData {
  year: number;
  months: number[];
}

interface CumulativeChartData {
  month: number;
  monthName: string;
  [key: string]: number | string;
}

interface CumulativeYearChartProps {
  type: "cylinders" | "dryIce";
  location?: ProductionLocation;
  hideDigital?: boolean;
}

export const CumulativeYearChart = React.memo(function CumulativeYearChart({ type, location = "all", hideDigital = false }: CumulativeYearChartProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [yearlyDataRaw, setYearlyDataRaw] = useState<YearlyMonthlyData[]>([]);
  const [digitalMonthlyByYear, setDigitalMonthlyByYear] = useState<Map<number, number[]>>(new Map());
  const [hasDigitalTypes, setHasDigitalTypes] = useState(false);
  const [selectedYears, setSelectedYears] = useState<number[]>([]);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [animatingTopFive, setAnimatingTopFive] = useState(false);
  const [animatingAll, setAnimatingAll] = useState(false);
  const [animatingClear, setAnimatingClear] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const currentYear = new Date().getFullYear();
        const startYear = 2017;
        const years: number[] = [];

        for (let y = currentYear; y >= startYear; y--) {
          years.push(y);
        }

        const orderType = type === "cylinders" ? "cylinder" : "dry_ice";
        const locationParam = location === "all" ? null : location;

        // For cylinders, also fetch digital gas type info
        let digitalGasTypeIds = new Set<string>();
        if (type === "cylinders") {
          const { data: gasTypesData } = await supabase.from("gas_types").select("id, is_digital");
          if (gasTypesData) {
            const digitalTypes = gasTypesData.filter((gt: any) => gt.is_digital);
            digitalGasTypeIds = new Set(digitalTypes.map((gt: any) => gt.id));
            setHasDigitalTypes(digitalTypes.length > 0);
          }
        }

        // Fetch all years in parallel using API
        const [totalResults, gasTypeResults] = await Promise.all([
          Promise.all(
            years.map(async (year) => {
              try {
                const data = await api.reports.getMonthlyOrderTotals(year, orderType, locationParam);
                return { data, error: null };
              } catch (err) {
                return { data: null, error: err };
              }
            })
          ),
          // For cylinders, also fetch per-gas-type data to compute digital monthly totals
          type === "cylinders" && digitalGasTypeIds.size > 0
            ? Promise.all(
                years.map(async (year) => {
                  try {
                    const data = await api.reports.getMonthlyCylinderTotalsByGasType(year, locationParam);
                    return { data, error: null };
                  } catch (err) {
                    return { data: null, error: err };
                  }
                })
              )
            : Promise.resolve(null),
        ]);

        // Build digital monthly map
        const digitalMap = new Map<number, number[]>();
        if (gasTypeResults) {
          gasTypeResults.forEach((result: any, index: number) => {
            const year = years[index];
            const monthlyDigital = new Array(12).fill(0);
            if (result?.data) {
              result.data.forEach((item: any) => {
                if (digitalGasTypeIds.has(item.gas_type_id)) {
                  monthlyDigital[item.month - 1] += Number(item.total_cylinders) || 0;
                }
              });
            }
            digitalMap.set(year, monthlyDigital);
          });
        }
        setDigitalMonthlyByYear(digitalMap);

        const allYearData: YearlyMonthlyData[] = [];

        totalResults.forEach((result, index) => {
          const year = years[index];

          if (result.error) {
            console.error(`[CumulativeYearChart] RPC error for ${year}:`, result.error);
            return;
          }

          const monthlyTotals = new Array(12).fill(0);

          if (result.data) {
            result.data.forEach((item: { month: number; total_value: number }) => {
              monthlyTotals[item.month - 1] = Number(item.total_value) || 0;
            });
          }

          const hasData = monthlyTotals.some(v => v > 0);
          if (hasData) {
            allYearData.push({ year, months: monthlyTotals });
          }
        });

        allYearData.sort((a, b) => b.year - a.year);

        setYearlyDataRaw(allYearData);
        setAvailableYears(allYearData.map(d => d.year));

        const defaultYears = allYearData.slice(0, 4).map(d => d.year);
        setSelectedYears(defaultYears);
      } catch (err) {
        console.error("[CumulativeYearChart] Fetch error:", err);
        setError("Fout bij ophalen data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [type, location]);

  // Apply digital filter to yearly data
  const effectiveYearlyData = useMemo(() => {
    if (!hideDigital || type !== "cylinders" || digitalMonthlyByYear.size === 0) return yearlyDataRaw;
    return yearlyDataRaw.map(yd => {
      const digitalMonths = digitalMonthlyByYear.get(yd.year);
      if (!digitalMonths) return yd;
      return {
        ...yd,
        months: yd.months.map((val, i) => Math.max(0, val - digitalMonths[i])),
      };
    });
  }, [yearlyDataRaw, hideDigital, type, digitalMonthlyByYear]);

  const cumulativeChartData = useMemo(() => {
    const chartData: CumulativeChartData[] = [];

    for (let m = 0; m < 12; m++) {
      const entry: CumulativeChartData = {
        month: m + 1,
        monthName: MONTH_NAMES[m]
      };

      // Calculate cumulative values for each selected year
      selectedYears.forEach(year => {
        const yearData = effectiveYearlyData.find(d => d.year === year);
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
  }, [effectiveYearlyData, selectedYears]);

  const toggleYear = useCallback((year: number) => {
    setSelectedYears(prev => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year);
      } else {
        return [...prev, year].sort((a, b) => b - a);
      }
    });
  }, []);

  const selectAllYears = useCallback(() => {
    setSelectedYears(availableYears);
    setAnimatingAll(true);
    setTimeout(() => setAnimatingAll(false), 600);
  }, [availableYears]);

  const clearYears = useCallback(() => {
    setSelectedYears([]);
    setAnimatingClear(true);
    setTimeout(() => setAnimatingClear(false), 300);
  }, []);

  // Calculate top 5 years by total volume (memoized for indicator display)
  // Calculate all year volumes for tooltips
  const allYearVolumes = useMemo(() => {
    return effectiveYearlyData.map(yd => ({
      year: yd.year,
      total: yd.months.reduce((sum, val) => sum + val, 0)
    }));
  }, [effectiveYearlyData]);

  const totalAllYearsVolume = useMemo(() => {
    return allYearVolumes.reduce((sum, yv) => sum + yv.total, 0);
  }, [allYearVolumes]);

  const topFiveWithVolume = useMemo(() => {
    return [...allYearVolumes].sort((a, b) => b.total - a.total).slice(0, 5);
  }, [allYearVolumes]);

  const topFiveYears = topFiveWithVolume.map(t => t.year);

  const getYearVolume = (year: number) => {
    return allYearVolumes.find(t => t.year === year)?.total || 0;
  };

  const getYearPercentage = (year: number) => {
    if (totalAllYearsVolume === 0) return 0;
    return (getYearVolume(year) / totalAllYearsVolume) * 100;
  };

  const selectTopFive = useCallback(() => {
    setSelectedYears(topFiveYears);
    setAnimatingTopFive(true);
    setTimeout(() => setAnimatingTopFive(false), 600);
  }, [topFiveYears]);

  if (loading) {
    return <ChartSkeleton height={400} showLegend />;
  }

  if (error) {
    return (
      <Card className="glass-card">
        <CardContent className="flex items-center justify-center py-12 text-destructive">
          {error}
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
          {hideDigital && type === "cylinders" && hasDigitalTypes && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-sky-400/40 text-sky-500 bg-sky-400/10 font-normal">
              Alleen fysiek
            </Badge>
          )}
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
                onClick={selectTopFive}
                className="text-xs text-primary font-medium px-2 py-1 rounded-md transition-all duration-200 hover:bg-primary/10 hover:scale-105 active:scale-95"
              >
                Top 5
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={selectAllYears}
                className="text-xs text-primary font-medium px-2 py-1 rounded-md transition-all duration-200 hover:bg-primary/10 hover:scale-105 active:scale-95"
              >
                Alles
              </button>
              <span className="text-muted-foreground">|</span>
              <button
                onClick={clearYears}
                className="text-xs text-primary font-medium px-2 py-1 rounded-md transition-all duration-200 hover:bg-primary/10 hover:scale-105 active:scale-95"
              >
                Wissen
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableYears.map(year => {
              const isSelected = selectedYears.includes(year);
              const isTopFive = topFiveYears.includes(year);
              const topRank = topFiveYears.indexOf(year);
              const shouldAnimate =
                (animatingTopFive && isTopFive) ||
                animatingAll ||
                (animatingClear && isSelected);
              const yearVolume = getYearVolume(year);

              return (
                <TooltipProvider key={year} delayDuration={0}>
                  <UITooltip>
                    <TooltipTrigger asChild>
                      <Badge
                        variant={isSelected ? "default" : "outline"}
                        className={`cursor-pointer transition-all duration-200 flex items-center gap-1 hover:scale-105 hover:shadow-md active:scale-95 ${shouldAnimate
                          ? "animate-[pulse_0.3s_ease-in-out_2] scale-110"
                          : ""
                          }`}
                        style={{
                          backgroundColor: isSelected ? getYearColor(year) : undefined,
                          borderColor: getYearColor(year),
                          color: isSelected ? "white" : getYearColor(year)
                        }}
                        onClick={() => toggleYear(year)}
                      >
                        {isTopFive && (
                          <Trophy
                            className={`h-3 w-3 ${topRank === 0 ? "text-yellow-400" :
                              topRank === 1 ? "text-gray-300" :
                                topRank === 2 ? "text-amber-600" :
                                  isSelected ? "text-white/70" : "opacity-50"
                              }`}
                          />
                        )}
                        {year}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      <div className="text-center">
                        {isTopFive && (
                          <div className="font-medium text-primary">#{topRank + 1} in volume</div>
                        )}
                        <div className={isTopFive ? "text-muted-foreground" : "font-medium"}>
                          {formatNumber(yearVolume, 0)} {type === "dryIce" ? "kg" : "cilinders"}
                        </div>
                        <div className="text-muted-foreground text-[10px]">
                          {getYearPercentage(year).toFixed(1)}% van totaal
                        </div>
                      </div>
                    </TooltipContent>
                  </UITooltip>
                </TooltipProvider>
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
                tickFormatter={(value) => formatNumber(value, 0)}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  backgroundColor: "hsl(var(--background))",
                  padding: "10px 14px",
                  fontSize: "13px"
                }}
                formatter={(value: number, name: string) => [
                  formatNumber(value, 0) + (type === "dryIce" ? " kg" : ""),
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
                  const yearData = effectiveYearlyData.find(d => d.year === year);
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
                          {value > 0 ? formatNumber(value, 0) : "-"}
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
});

CumulativeYearChart.displayName = "CumulativeYearChart";
