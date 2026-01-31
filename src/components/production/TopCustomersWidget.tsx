import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn, formatNumber } from "@/lib/utils";

interface CustomerData {
  customer_id: string | null;
  customer_name: string;
  total_cylinders: number;
  total_dry_ice_kg: number;
  previousCylinders: number;
  previousDryIce: number;
  totalVolume: number;
  changePercent: number;
}

interface TopCustomersWidgetProps {
  refreshKey?: number;
  isRefreshing?: boolean;
}

export function TopCustomersWidget({ refreshKey = 0, isRefreshing = false }: TopCustomersWidgetProps) {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopCustomers();
  }, [refreshKey]);

  const fetchTopCustomers = async () => {
    try {
      const currentYear = new Date().getFullYear();
      const previousYear = currentYear - 1;

      const [currentRes, previousRes] = await Promise.all([
        supabase.rpc("get_yearly_totals_by_customer", { p_year: currentYear }),
        supabase.rpc("get_yearly_totals_by_customer", { p_year: previousYear })
      ]);

      if (currentRes.error) throw currentRes.error;

      const previousMap = new Map<string, { cylinders: number; dryIce: number }>();
      if (previousRes.data) {
        previousRes.data.forEach((c: { customer_name: string; total_cylinders: number; total_dry_ice_kg: number }) => {
          previousMap.set(c.customer_name, {
            cylinders: Number(c.total_cylinders) || 0,
            dryIce: Number(c.total_dry_ice_kg) || 0
          });
        });
      }

      const enriched: CustomerData[] = (currentRes.data || []).map((c: { customer_id: string | null; customer_name: string; total_cylinders: number; total_dry_ice_kg: number }) => {
        const prev = previousMap.get(c.customer_name) || { cylinders: 0, dryIce: 0 };
        const currentTotal = Number(c.total_cylinders) + Number(c.total_dry_ice_kg);
        const previousTotal = prev.cylinders + prev.dryIce;
        const changePercent = previousTotal > 0 
          ? ((currentTotal - previousTotal) / previousTotal) * 100 
          : currentTotal > 0 ? 100 : 0;

        return {
          customer_id: c.customer_id,
          customer_name: c.customer_name,
          total_cylinders: Number(c.total_cylinders) || 0,
          total_dry_ice_kg: Number(c.total_dry_ice_kg) || 0,
          previousCylinders: prev.cylinders,
          previousDryIce: prev.dryIce,
          totalVolume: currentTotal,
          changePercent
        };
      });

      const top5 = enriched
        .sort((a, b) => b.total_cylinders - a.total_cylinders)
        .slice(0, 5);

      setCustomers(top5);
    } catch (error) {
      console.error("Error fetching top customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const getTrendIcon = (change: number) => {
    if (change > 5) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (change < -5) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  };

  const getMedalColor = (index: number) => {
    switch (index) {
      case 0: return "text-yellow-500";
      case 1: return "text-gray-400";
      case 2: return "text-amber-600";
      default: return "text-muted-foreground";
    }
  };

  if (loading) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-yellow-500" />
            Top 5 Klanten
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "glass-card transition-all duration-300",
      isRefreshing && "animate-pulse ring-2 ring-primary/30"
    )}>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-yellow-500" />
          Top 5 Klanten {new Date().getFullYear()}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {customers.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Geen klantdata beschikbaar
          </p>
        ) : (
          customers.map((customer, index) => (
            <div
              key={customer.customer_id || customer.customer_name}
              className="flex items-center justify-between p-2 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`font-bold text-lg ${getMedalColor(index)}`}>
                  #{index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{customer.customer_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span>{formatNumber(customer.total_cylinders, 0)} cil.</span>
                    <span>•</span>
                    <span>{formatNumber(customer.total_dry_ice_kg, 0)} kg</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {getTrendIcon(customer.changePercent)}
                <Badge 
                  variant={customer.changePercent >= 0 ? "default" : "destructive"}
                  className="text-xs"
                >
                  {customer.changePercent >= 0 ? "+" : ""}{customer.changePercent.toFixed(0)}%
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
