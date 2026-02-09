import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { api } from "@/lib/api";
import { cn, formatNumber } from "@/lib/utils";
import { FadeIn } from "@/components/ui/fade-in";
import { CustomerListSkeleton } from "@/components/ui/skeletons";
import { format, differenceInDays, subDays } from "date-fns";
import { nl } from "date-fns/locale";

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

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

type DateRange = {
  from: Date;
  to: Date;
};

interface TopCustomersWidgetProps {
  refreshKey?: number;
  isRefreshing?: boolean;
  location?: ProductionLocation;
  dateRange?: DateRange;
}

export const TopCustomersWidget = React.memo(function TopCustomersWidget({
  refreshKey = 0,
  isRefreshing = false,
  location = "all",
  dateRange
}: TopCustomersWidgetProps) {
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopCustomers();
  }, [refreshKey, location, dateRange]);

  const fetchTopCustomers = async () => {
    setLoading(true);

    try {
      // Determine if using custom date range or year-based
      if (dateRange) {
        await fetchCustomersByDateRange(dateRange);
      } else {
        await fetchCustomersByYear();
      }
    } catch (error) {
      console.error("Error fetching top customers:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomersByYear = async () => {
    const currentYear = new Date().getFullYear();
    const previousYear = currentYear - 1;

    // Pass location filter to the RPC function (null for "all")
    const locationFilter = location === "all" ? null : location;

    const [currentData, previousData] = await Promise.all([
      api.reports.getYearlyTotalsByCustomer(currentYear, locationFilter).catch(error => {
        console.error("[TopCustomersWidget] Error fetching current year data:", error);
        return null;
      }),
      api.reports.getYearlyTotalsByCustomer(previousYear, locationFilter).catch(error => {
        console.error("[TopCustomersWidget] Error fetching previous year data:", error);
        return null;
      })
    ]);

    const previousMap = new Map<string, { cylinders: number; dryIce: number }>();
    if (previousData) {
      previousData.forEach((c: { customer_name: string; total_cylinders: number; total_dry_ice_kg: number }) => {
        previousMap.set(c.customer_name, {
          cylinders: Number(c.total_cylinders) || 0,
          dryIce: Number(c.total_dry_ice_kg) || 0
        });
      });
    }

    const enriched: CustomerData[] = (currentData || []).map((c: { customer_id: string | null; customer_name: string; total_cylinders: number; total_dry_ice_kg: number }) => {
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
  };

  const fetchCustomersByDateRange = async (range: DateRange) => {
    const fromDate = format(range.from, "yyyy-MM-dd");
    const toDate = format(range.to, "yyyy-MM-dd");

    // Calculate previous period (same length, immediately before)
    const periodLength = differenceInDays(range.to, range.from);
    const prevTo = subDays(range.from, 1);
    const prevFrom = subDays(prevTo, periodLength);
    const prevFromDate = format(prevFrom, "yyyy-MM-dd");
    const prevToDate = format(prevTo, "yyyy-MM-dd");

    const locationFilter = location === "all" ? null : location;

    // Use RPC function for server-side aggregation (avoids 1000 row limit)
    const [currentData, previousData] = await Promise.all([
      api.reports.getCustomerTotals(fromDate, toDate, locationFilter).catch(error => {
        console.error("[TopCustomersWidget] Error fetching current period data:", error);
        return null;
      }),
      api.reports.getCustomerTotals(prevFromDate, prevToDate, locationFilter).catch(error => {
        console.error("[TopCustomersWidget] Error fetching previous period data:", error);
        return null;
      })
    ]);

    // Build previous period map for trend calculation
    const prevMap = new Map<string, { cylinders: number; dryIce: number }>();
    if (previousData) {
      previousData.forEach((c: { customer_name: string; total_cylinders: number; total_dry_ice_kg: number }) => {
        prevMap.set(c.customer_name, {
          cylinders: Number(c.total_cylinders) || 0,
          dryIce: Number(c.total_dry_ice_kg) || 0
        });
      });
    }

    // Build enriched customer data
    const enriched: CustomerData[] = (currentData || []).map((c: { customer_id: string | null; customer_name: string; total_cylinders: number; total_dry_ice_kg: number }) => {
      const prev = prevMap.get(c.customer_name) || { cylinders: 0, dryIce: 0 };
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
  };

  const getTrendIcon = useCallback((change: number) => {
    if (change > 5) return <TrendingUp className="h-3 w-3 text-green-500" />;
    if (change < -5) return <TrendingDown className="h-3 w-3 text-red-500" />;
    return <Minus className="h-3 w-3 text-muted-foreground" />;
  }, []);

  const getMedalColor = useCallback((index: number) => {
    switch (index) {
      case 0: return "text-yellow-500";
      case 1: return "text-gray-400";
      case 2: return "text-amber-600";
      default: return "text-muted-foreground";
    }
  }, []);

  if (loading) {
    return <CustomerListSkeleton />;
  }

  return (
    <FadeIn show={!loading}>
      <Card className={cn(
        "glass-card transition-all duration-300",
        isRefreshing && "animate-pulse ring-2 ring-primary/30"
      )}>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2 flex-wrap">
            <Trophy className="h-4 w-4 text-yellow-500" />
            <span>Top 5 Klanten {dateRange
              ? `${format(dateRange.from, "d MMM", { locale: nl })} - ${format(dateRange.to, "d MMM yyyy", { locale: nl })}`
              : new Date().getFullYear()
            }</span>
            {location !== "all" && (
              <Badge variant="outline" className="text-[10px] py-0">
                {location === "sol_emmen" ? "Emmen" : "Tilburg"}
              </Badge>
            )}
            {dateRange && (
              <Badge variant="outline" className="text-[10px] py-0 bg-primary/5">
                Gefilterd
              </Badge>
            )}
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
    </FadeIn>
  );
});

TopCustomersWidget.displayName = "TopCustomersWidget";
