import { useState, useEffect, useMemo } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Cylinder,
  Snowflake
} from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths } from "date-fns";
import { nl } from "date-fns/locale";
import { FadeIn } from "@/components/ui/fade-in";

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";
type ViewType = "cylinders" | "dryIce";

interface ProductionHeatMapProps {
  location: ProductionLocation;
  refreshKey?: number;
  dateRange?: { from: Date; to: Date };
  hideDigital?: boolean;
  hasDigitalTypes?: boolean;
}

interface DailyData {
  date: string;
  cylinders: number;
  dryIce: number;
}

export function ProductionHeatMap({ location, refreshKey = 0, dateRange, hideDigital = false, hasDigitalTypes = false }: ProductionHeatMapProps) {
  const [currentDate, setCurrentDate] = useState(dateRange?.from ?? new Date());
  const [viewType, setViewType] = useState<ViewType>("cylinders");
  const [dailyData, setDailyData] = useState<Map<string, DailyData>>(new Map());
  const [loading, setLoading] = useState(true);

  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;

  // Sync currentDate when dateRange changes externally
  useEffect(() => {
    if (dateRange?.from) {
      setCurrentDate(dateRange.from);
    }
  }, [dateRange?.from.getTime()]);

  useEffect(() => {
    fetchHeatMapData();
  }, [currentDate, location, refreshKey]);

  const fetchHeatMapData = async () => {
    setLoading(true);

    const locationParam = location === "all" ? null : location;
    const fromDate = format(startOfMonth(currentDate), "yyyy-MM-dd");
    const toDate = format(endOfMonth(currentDate), "yyyy-MM-dd");

    try {
      const data = await api.reports.getDailyProductionByPeriod(fromDate, toDate, locationParam);

      if (data) {
        const dataMap = new Map<string, DailyData>();
        // @ts-ignore - Supabase RPC types might not be fully inferred yet
        data.forEach((row: { production_date: string; cylinder_count: number; dry_ice_kg: number }) => {
          dataMap.set(row.production_date, {
            date: row.production_date,
            cylinders: Number(row.cylinder_count),
            dryIce: Number(row.dry_ice_kg)
          });
        });
        setDailyData(dataMap);
      }
    } catch (error) {
      console.error("Error fetching heatmap data:", error);
    }

    setLoading(false);
  };

  const daysInMonth = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const firstDayOffset = useMemo(() => {
    const firstDay = startOfMonth(currentDate);
    // Convert Sunday = 0 to Monday = 0 based week
    const day = getDay(firstDay);
    return day === 0 ? 6 : day - 1;
  }, [currentDate]);

  const maxValue = useMemo(() => {
    let max = 0;
    dailyData.forEach(data => {
      const value = viewType === "cylinders" ? data.cylinders : data.dryIce;
      if (value > max) max = value;
    });
    return max || 1;
  }, [dailyData, viewType]);

  const totalVolume = useMemo(() => {
    let total = 0;
    dailyData.forEach(data => {
      total += viewType === "cylinders" ? data.cylinders : data.dryIce;
    });
    return total;
  }, [dailyData, viewType]);

  const activeDays = useMemo(() => {
    let count = 0;
    dailyData.forEach(data => {
      const value = viewType === "cylinders" ? data.cylinders : data.dryIce;
      if (value > 0) count++;
    });
    return count;
  }, [dailyData, viewType]);

  const getIntensityClass = (value: number): string => {
    if (value === 0) return "bg-muted/30";
    const intensity = value / maxValue;
    if (intensity < 0.2) return "bg-green-200 dark:bg-green-900/50";
    if (intensity < 0.4) return "bg-green-300 dark:bg-green-800/60";
    if (intensity < 0.6) return "bg-yellow-300 dark:bg-yellow-700/60";
    if (intensity < 0.8) return "bg-orange-400 dark:bg-orange-600/70";
    return "bg-red-500 dark:bg-red-600/80";
  };

  const weekDays = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  if (loading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <div className="h-6 w-48 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="aspect-square bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" />
              Productie Heatmap
              {hideDigital && hasDigitalTypes && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-sky-400/40 text-sky-500 bg-sky-400/10 font-normal">
                  Alleen fysiek
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Volume-intensiteit per dag
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <ToggleGroup
              type="single"
              value={viewType}
              onValueChange={(v) => v && setViewType(v as ViewType)}
              className="bg-muted/50 rounded-lg p-0.5"
            >
              <ToggleGroupItem value="cylinders" size="sm" className="text-xs gap-1 data-[state=on]:bg-orange-500 data-[state=on]:text-white">
                <Cylinder className="h-3 w-3" />
                Cilinders
              </ToggleGroupItem>
              <ToggleGroupItem value="dryIce" size="sm" className="text-xs gap-1 data-[state=on]:bg-cyan-500 data-[state=on]:text-white">
                <Snowflake className="h-3 w-3" />
                Droogijs
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>

        {/* Month Navigation */}
        <div className="flex items-center justify-between mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Vorige
          </Button>

          <div className="text-center">
            <span className="text-lg font-semibold capitalize">
              {format(currentDate, "MMMM yyyy", { locale: nl })}
            </span>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            Volgende
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        <FadeIn show={true}>
          {/* Summary Stats */}
          <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-muted/30">
            <div>
              <p className="text-2xl font-bold">
                {formatNumber(totalVolume, 0)}
                <span className="text-sm font-normal text-muted-foreground ml-1">
                  {viewType === "cylinders" ? "cilinders" : "kg"}
                </span>
              </p>
              <p className="text-xs text-muted-foreground">Totaal deze maand</p>
            </div>
            <div className="border-l border-border pl-4">
              <p className="text-lg font-semibold">{activeDays}</p>
              <p className="text-xs text-muted-foreground">Actieve dagen</p>
            </div>
            <div className="border-l border-border pl-4">
              <p className="text-lg font-semibold">
                {activeDays > 0 ? formatNumber(totalVolume / activeDays, 0) : 0}
              </p>
              <p className="text-xs text-muted-foreground">Gem. per dag</p>
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map(day => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-1"
              >
                {day}
              </div>
            ))}
          </div>

          <TooltipProvider>
            <div className="grid grid-cols-7 gap-1">
              {/* Empty cells for offset */}
              {Array.from({ length: firstDayOffset }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}

              {/* Day cells */}
              {daysInMonth.map(day => {
                const dateStr = format(day, "yyyy-MM-dd");
                const data = dailyData.get(dateStr);
                const value = data
                  ? (viewType === "cylinders" ? data.cylinders : data.dryIce)
                  : 0;

                return (
                  <Tooltip key={dateStr}>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "aspect-square rounded-md flex flex-col items-center justify-center cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-primary/50 hover:scale-105",
                          getIntensityClass(value),
                          value > 0 && "text-foreground"
                        )}
                      >
                        <span className="text-xs font-medium leading-tight">{format(day, "d")}</span>
                        {value > 0 && (
                          <span className="text-[9px] leading-tight opacity-75 font-medium">
                            {value >= 1000 ? `${Math.round(value / 1000)}k` : value}
                          </span>
                        )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-sm">
                      <div className="font-semibold mb-1">
                        {format(day, "EEEE d MMMM", { locale: nl })}
                      </div>
                      {data ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Cylinder className="h-3 w-3 text-orange-500" />
                            <span>{formatNumber(data.cylinders, 0)} cilinders</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Snowflake className="h-3 w-3 text-cyan-500" />
                            <span>{formatNumber(data.dryIce, 0)} kg droogijs</span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">Geen productie</span>
                      )}
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>

          {/* Legend */}
          <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t border-border/50">
            <span className="text-xs text-muted-foreground mr-2">Intensiteit:</span>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-muted/30" />
              <span className="text-xs text-muted-foreground">0</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-200 dark:bg-green-900/50" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-green-300 dark:bg-green-800/60" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-yellow-300 dark:bg-yellow-700/60" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-orange-400 dark:bg-orange-600/70" />
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-red-500 dark:bg-red-600/80" />
              <span className="text-xs text-muted-foreground">Max</span>
            </div>
          </div>
        </FadeIn>
      </CardContent>
    </Card>
  );
}
