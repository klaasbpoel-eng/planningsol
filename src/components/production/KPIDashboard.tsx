import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown,
  CheckCircle2, 
  Clock, 
  Target,
  ChevronDown,
  ChevronUp,
  Zap,
  BarChart3,
  Minus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn, formatNumber } from "@/lib/utils";
import { FadeIn } from "@/components/ui/fade-in";
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip
} from "recharts";

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface KPIDashboardProps {
  location: ProductionLocation;
  refreshKey?: number;
}

interface EfficiencyData {
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  efficiency_rate: number;
  total_cylinders: number;
  completed_cylinders: number;
}

interface SparklineData {
  week: string;
  value: number;
}

export function KPIDashboard({ location, refreshKey = 0 }: KPIDashboardProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [currentYearData, setCurrentYearData] = useState<EfficiencyData | null>(null);
  const [previousYearData, setPreviousYearData] = useState<EfficiencyData | null>(null);
  const [weeklyData, setWeeklyData] = useState<SparklineData[]>([]);
  const [loading, setLoading] = useState(true);

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    fetchKPIData();
  }, [location, refreshKey]);

  const fetchKPIData = async () => {
    setLoading(true);
    
    const locationParam = location === "all" ? null : location;
    
    // Fetch current year and previous year efficiency
    const [currentResult, previousResult] = await Promise.all([
      supabase.rpc("get_production_efficiency", { 
        p_year: currentYear, 
        p_location: locationParam 
      }),
      supabase.rpc("get_production_efficiency", { 
        p_year: currentYear - 1, 
        p_location: locationParam 
      })
    ]);

    if (currentResult.data && currentResult.data.length > 0) {
      setCurrentYearData(currentResult.data[0]);
    }
    
    if (previousResult.data && previousResult.data.length > 0) {
      setPreviousYearData(previousResult.data[0]);
    }

    // Fetch weekly sparkline data (last 8 weeks)
    const weeklySparkline = await fetchWeeklySparkline(locationParam);
    setWeeklyData(weeklySparkline);
    
    setLoading(false);
  };

  const fetchWeeklySparkline = async (locationParam: string | null): Promise<SparklineData[]> => {
    const weeks: SparklineData[] = [];
    const today = new Date();
    
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - (i * 7) - today.getDay() + 1);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      
      const startStr = weekStart.toISOString().split('T')[0];
      const endStr = weekEnd.toISOString().split('T')[0];
      
      let query = supabase
        .from("gas_cylinder_orders")
        .select("cylinder_count")
        .gte("scheduled_date", startStr)
        .lte("scheduled_date", endStr)
        .neq("status", "cancelled");
      
      if (locationParam === "sol_emmen" || locationParam === "sol_tilburg") {
        query = query.eq("location", locationParam);
      }
      
      const { data } = await query;
      const total = data?.reduce((sum, o) => sum + o.cylinder_count, 0) || 0;
      
      weeks.push({
        week: `W${8 - i}`,
        value: total
      });
    }
    
    return weeks;
  };

  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const efficiencyTrend = useMemo(() => {
    if (!currentYearData || !previousYearData) return 0;
    return calculateTrend(currentYearData.efficiency_rate, previousYearData.efficiency_rate);
  }, [currentYearData, previousYearData]);

  const volumeTrend = useMemo(() => {
    if (!currentYearData || !previousYearData) return 0;
    return calculateTrend(currentYearData.total_cylinders, previousYearData.total_cylinders);
  }, [currentYearData, previousYearData]);

  const completionRate = useMemo(() => {
    if (!currentYearData) return 0;
    const nonCancelled = currentYearData.total_orders - currentYearData.cancelled_orders;
    if (nonCancelled === 0) return 0;
    return Math.round((currentYearData.completed_orders / nonCancelled) * 100);
  }, [currentYearData]);

  const getTrendIcon = (value: number) => {
    if (value > 0) return <TrendingUp className="h-3 w-3" />;
    if (value < 0) return <TrendingDown className="h-3 w-3" />;
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = (value: number) => {
    if (value > 0) return "text-success";
    if (value < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  const getEfficiencyColor = (rate: number) => {
    if (rate >= 80) return "text-success";
    if (rate >= 60) return "text-warning";
    return "text-destructive";
  };

  if (loading) {
    return (
      <Card className="glass-card animate-pulse">
        <CardHeader className="pb-2">
          <div className="h-6 w-48 bg-muted rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-24 bg-muted/50 rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="glass-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-2 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                KPI Dashboard
                <Badge variant="outline" className="ml-2 text-xs">
                  {currentYear}
                </Badge>
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0">
            <FadeIn show={true}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Efficiency Rate */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-primary" />
                      <span className="text-xs font-medium text-muted-foreground">Efficiëntie</span>
                    </div>
                    <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor(efficiencyTrend))}>
                      {getTrendIcon(efficiencyTrend)}
                      <span>{efficiencyTrend > 0 ? "+" : ""}{efficiencyTrend}%</span>
                    </div>
                  </div>
                  <div className={cn("text-3xl font-bold", getEfficiencyColor(currentYearData?.efficiency_rate || 0))}>
                    {currentYearData?.efficiency_rate || 0}%
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Voltooiingspercentage orders
                  </p>
                </div>

                {/* Total Cylinders */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-orange-500/10 to-orange-500/5 border border-orange-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-orange-500" />
                      <span className="text-xs font-medium text-muted-foreground">Volume YTD</span>
                    </div>
                    <div className={cn("flex items-center gap-1 text-xs font-medium", getTrendColor(volumeTrend))}>
                      {getTrendIcon(volumeTrend)}
                      <span>{volumeTrend > 0 ? "+" : ""}{volumeTrend}%</span>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-orange-500">
                    {formatNumber(currentYearData?.total_cylinders || 0, 0)}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Cilinders dit jaar
                  </p>
                </div>

                {/* Completion Rate */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/10 to-green-500/5 border border-green-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span className="text-xs font-medium text-muted-foreground">Voltooid</span>
                    </div>
                  </div>
                  <div className="text-3xl font-bold text-green-500">
                    {formatNumber(currentYearData?.completed_orders || 0, 0)}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-green-500 rounded-full transition-all duration-500"
                        style={{ width: `${completionRate}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground">{completionRate}%</span>
                  </div>
                </div>

                {/* Weekly Trend Sparkline */}
                <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-blue-500" />
                      <span className="text-xs font-medium text-muted-foreground">Wekelijkse trend</span>
                    </div>
                  </div>
                  <div className="h-12">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weeklyData}>
                        <Tooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-popover border rounded-lg px-2 py-1 text-xs shadow-md">
                                  <span className="font-medium">{payload[0].value} cilinders</span>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="value" 
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Laatste 8 weken
                  </p>
                </div>
              </div>

              {/* Additional Stats Row */}
              <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-yellow-500/10">
                    <Clock className="h-4 w-4 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{formatNumber(currentYearData?.pending_orders || 0, 0)}</p>
                    <p className="text-xs text-muted-foreground">Openstaand</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Target className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{formatNumber(currentYearData?.total_orders || 0, 0)}</p>
                    <p className="text-xs text-muted-foreground">Totaal orders</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/10">
                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{formatNumber(currentYearData?.completed_cylinders || 0, 0)}</p>
                    <p className="text-xs text-muted-foreground">Cilinders voltooid</p>
                  </div>
                </div>
              </div>
            </FadeIn>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
