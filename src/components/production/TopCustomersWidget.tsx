import React, { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trophy, TrendingUp, TrendingDown, Minus, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchTopCustomers();
  }, [refreshKey, location, dateRange]);

  const fetchTopCustomers = useCallback(async (retryCount = 0) => {
    setLoading(true);
    setError(null);

    try {
      if (dateRange) {
        await fetchCustomersByDateRange(dateRange);
      } else {
        await fetchCustomersByYear();
      }
    } catch (err) {
      console.error("[TopCustomersWidget] Error fetching top customers:", err);
      if (retryCount < 1) {
        setTimeout(() => fetchTopCustomers(retryCount + 1), 1000);
        return;
      }
      setError("Kon klantdata niet laden");
    } finally {
      setLoading(false);
    }
  }, [dateRange, location]);

  // Fetch Productie rows for a date range and group by customer
  const fetchProductieByCustomer = async (
    fromDate: string,
    toDate: string,
    locationFilter: string | null
  ): Promise<Map<string, number>> => {
    const fromYear = parseInt(fromDate.substring(0, 4));
    const toYear = parseInt(toDate.substring(0, 4));
    const yearsNeeded = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i);

    const allRows: any[] = [];
    for (const year of yearsNeeded) {
      const PAGE = 1000;
      let from = 0;
      while (true) {
        const { data } = await (supabase.from("Productie" as never) as any)
          .select("Datum,Locatie,Aantal,Klant")
          .eq("Jaar", year)
          .range(from, from + PAGE - 1);
        if (!data || data.length === 0) break;
        allRows.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
    }

    const filtered = allRows.filter((row: any) => {
      const raw: string = row.Datum || "";
      if (!raw) return false;
      const iso = raw.includes("T") ? raw.substring(0, 10)
        : (() => { const p = raw.split("-"); return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : raw; })();
      if (iso < fromDate || iso > toDate) return false;
      if (locationFilter) {
        const loc = row.Locatie?.toLowerCase().includes("emmen") ? "sol_emmen" : "sol_tilburg";
        if (loc !== locationFilter) return false;
      }
      return true;
    });

    const byCustomer = new Map<string, number>();
    for (const row of filtered) {
      const name = row.Klant || "Onbekend";
      byCustomer.set(name, (byCustomer.get(name) || 0) + (row.Aantal || 0));
    }
    return byCustomer;
  };

  // Fetch Productie rows for a full year and group by customer
  const fetchProductieByCustomerForYear = async (
    year: number,
    locationFilter: string | null
  ): Promise<Map<string, number>> => {
    const PAGE = 1000;
    const data: any[] = [];
    let from = 0;
    while (true) {
      const { data: page } = await (supabase.from("Productie" as never) as any)
        .select("Locatie,Aantal,Klant")
        .eq("Jaar", year)
        .range(from, from + PAGE - 1);
      if (!page || page.length === 0) break;
      data.push(...page);
      if (page.length < PAGE) break;
      from += PAGE;
    }

    const filtered = (data || []).filter((row: any) => {
      if (!locationFilter) return true;
      const loc = row.Locatie?.toLowerCase().includes("emmen") ? "sol_emmen" : "sol_tilburg";
      return loc === locationFilter;
    });

    const byCustomer = new Map<string, number>();
    for (const row of filtered) {
      const name = row.Klant || "Onbekend";
      byCustomer.set(name, (byCustomer.get(name) || 0) + (row.Aantal || 0));
    }
    return byCustomer;
  };

  const buildCustomerList = (
    currentMap: Map<string, number>,
    previousMap: Map<string, number>
  ): CustomerData[] => {
    return Array.from(currentMap.entries())
      .map(([name, cylinders]) => {
        const prevCylinders = previousMap.get(name) || 0;
        const changePercent =
          prevCylinders > 0
            ? ((cylinders - prevCylinders) / prevCylinders) * 100
            : cylinders > 0
            ? 100
            : 0;
        return {
          customer_id: null,
          customer_name: name,
          total_cylinders: cylinders,
          total_dry_ice_kg: 0,
          previousCylinders: prevCylinders,
          previousDryIce: 0,
          totalVolume: cylinders,
          changePercent,
        };
      })
      .sort((a, b) => b.total_cylinders - a.total_cylinders)
      .slice(0, 5);
  };

  const fetchCustomersByYear = async () => {
    const currentYear = new Date().getFullYear();
    const locationFilter = location === "all" ? null : location;

    const [currentMap, previousMap] = await Promise.all([
      fetchProductieByCustomerForYear(currentYear, locationFilter),
      fetchProductieByCustomerForYear(currentYear - 1, locationFilter),
    ]);

    setCustomers(buildCustomerList(currentMap, previousMap));
  };

  const fetchCustomersByDateRange = async (range: DateRange) => {
    const fromDate = format(range.from, "yyyy-MM-dd");
    const toDate = format(range.to, "yyyy-MM-dd");

    const periodLength = differenceInDays(range.to, range.from);
    const prevTo = subDays(range.from, 1);
    const prevFrom = subDays(prevTo, periodLength);
    const prevFromDate = format(prevFrom, "yyyy-MM-dd");
    const prevToDate = format(prevTo, "yyyy-MM-dd");

    const locationFilter = location === "all" ? null : location;

    const [currentMap, previousMap] = await Promise.all([
      fetchProductieByCustomer(fromDate, toDate, locationFilter),
      fetchProductieByCustomer(prevFromDate, prevToDate, locationFilter),
    ]);

    setCustomers(buildCustomerList(currentMap, previousMap));
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
          {error ? (
            <div className="text-center py-4 space-y-2">
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchTopCustomers()}>
                <RefreshCw className="h-3 w-3 mr-1" />
                Opnieuw proberen
              </Button>
            </div>
          ) : customers.length === 0 ? (
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
                      {customer.total_dry_ice_kg > 0 && (
                        <>
                          <span>•</span>
                          <span>{formatNumber(customer.total_dry_ice_kg, 0)} kg</span>
                        </>
                      )}
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
