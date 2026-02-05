import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Snowflake, Cylinder, Package, BarChart3, MapPin, Lock, ShieldAlert, Truck } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { TopCustomersWidget } from "./TopCustomersWidget";
import { KPIDashboard } from "./KPIDashboard";
import { StockSummaryWidget } from "./StockSummaryWidget";
import { FadeIn } from "@/components/ui/fade-in";
import { TableSkeleton, ChartSkeleton } from "@/components/ui/skeletons";

// Lazy load heavy tab components
const DryIcePlanning = lazy(() => import("./DryIcePlanning").then(m => ({ default: m.DryIcePlanning })));
const GasCylinderPlanning = lazy(() => import("./GasCylinderPlanning").then(m => ({ default: m.GasCylinderPlanning })));
const ProductionReports = lazy(() => import("./ProductionReports").then(m => ({ default: m.ProductionReports })));
const SafetyInstructions = lazy(() => import("./SafetyInstructions").then(m => ({ default: m.SafetyInstructions })));
const SiteMap = lazy(() => import("./SiteMap").then(m => ({ default: m.SiteMap })));
const TrailerPlanning = lazy(() => import("./TrailerPlanning").then(m => ({ default: m.TrailerPlanning })));

// ... (existing code)



// Loading fallback component with skeleton
const TabLoadingFallback = () => (
  <TableSkeleton rows={6} columns={5} />
);

const ReportLoadingFallback = () => (
  <ChartSkeleton height={350} />
);
import { supabase } from "@/integrations/supabase/client";
import { format, subWeeks, startOfMonth, endOfMonth, differenceInDays, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import type { Database } from "@/integrations/supabase/types";
import type { RolePermissions } from "@/hooks/useUserPermissions";

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";
type UserProductionLocation = Database["public"]["Enums"]["production_location"] | null;

type DateRange = {
  from: Date;
  to: Date;
};

interface ProductionPlanningProps {
  userProductionLocation?: UserProductionLocation;
  canViewAllLocations?: boolean;
  permissions?: RolePermissions;
}

export function ProductionPlanning({
  userProductionLocation,
  canViewAllLocations = true,
  permissions
}: ProductionPlanningProps) {
  const [activeTab, setActiveTab] = useState("droogijs");
  const [dryIceToday, setDryIceToday] = useState(0);
  const [cylindersToday, setCylindersToday] = useState(0);
  const [weekOrders, setWeekOrders] = useState(0);
  const [previousDryIceToday, setPreviousDryIceToday] = useState(0);
  const [previousCylindersToday, setPreviousCylindersToday] = useState(0);
  const [previousWeekOrders, setPreviousWeekOrders] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Date range state for dashboard sync with reports
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  // Determine initial and allowed location based on user's assigned location
  const getInitialLocation = (): ProductionLocation => {
    if (canViewAllLocations) return "all";
    if (userProductionLocation) return userProductionLocation;
    return "all";
  };

  const [selectedLocation, setSelectedLocation] = useState<ProductionLocation>(getInitialLocation());

  // Update selected location when user's production location changes
  // Update selected location when user's production location changes
  useEffect(() => {
    if (!canViewAllLocations && userProductionLocation) {
      setSelectedLocation(userProductionLocation);
    }
  }, [canViewAllLocations, userProductionLocation]);

  // Fetch stats when location or refreshKey changes
  useEffect(() => {
    fetchStats();
  }, [refreshKey, selectedLocation, dateRange]);

  // Trigger refresh animation when refreshKey changes (but not on initial load)
  useEffect(() => {
    if (refreshKey > 0) {
      setIsRefreshing(true);
      const timer = setTimeout(() => setIsRefreshing(false), 600);
      return () => clearTimeout(timer);
    }
  }, [refreshKey]);

  const handleDataChanged = useCallback(() => {
    // Increment refreshKey to trigger re-fetch of all stats and reports
    setRefreshKey(prev => prev + 1);
  }, []);

  const calculateTrend = (current: number, previous: number): number => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const handleDateRangeChange = useCallback((newRange: DateRange) => {
    setDateRange(newRange);
  }, []);

  const fetchStats = async () => {
    const fromDate = format(dateRange.from, "yyyy-MM-dd");
    const toDate = format(dateRange.to, "yyyy-MM-dd");
    
    // Calculate previous period (same length, immediately before)
    const periodLength = differenceInDays(dateRange.to, dateRange.from);
    const prevTo = subDays(dateRange.from, 1);
    const prevFrom = subDays(prevTo, periodLength);
    const prevFromDate = format(prevFrom, "yyyy-MM-dd");
    const prevToDate = format(prevTo, "yyyy-MM-dd");

    // Fetch dry ice orders for date range
    let dryIceQuery = supabase
      .from("dry_ice_orders")
      .select("quantity_kg")
      .gte("scheduled_date", fromDate)
      .lte("scheduled_date", toDate)
      .neq("status", "cancelled");

    const { data: dryIceData } = await dryIceQuery;

    if (dryIceData) {
      setDryIceToday(dryIceData.reduce((sum, o) => sum + Number(o.quantity_kg), 0));
    }

    // Fetch dry ice orders for previous period (for trend)
    const { data: prevDryIceData } = await supabase
      .from("dry_ice_orders")
      .select("quantity_kg")
      .gte("scheduled_date", prevFromDate)
      .lte("scheduled_date", prevToDate)
      .neq("status", "cancelled");

    if (prevDryIceData) {
      setPreviousDryIceToday(prevDryIceData.reduce((sum, o) => sum + Number(o.quantity_kg), 0));
    }

    // Fetch cylinder orders for date range (filtered by location)
    let cylinderQuery = supabase
      .from("gas_cylinder_orders")
      .select("cylinder_count")
      .gte("scheduled_date", fromDate)
      .lte("scheduled_date", toDate)
      .neq("status", "cancelled");

    if (selectedLocation !== "all") {
      cylinderQuery = cylinderQuery.eq("location", selectedLocation);
    }

    const { data: cylinderData } = await cylinderQuery;

    if (cylinderData) {
      setCylindersToday(cylinderData.reduce((sum, o) => sum + o.cylinder_count, 0));
    }

    // Fetch cylinder orders for previous period (for trend)
    let prevCylinderQuery = supabase
      .from("gas_cylinder_orders")
      .select("cylinder_count")
      .gte("scheduled_date", prevFromDate)
      .lte("scheduled_date", prevToDate)
      .neq("status", "cancelled");

    if (selectedLocation !== "all") {
      prevCylinderQuery = prevCylinderQuery.eq("location", selectedLocation);
    }

    const { data: prevCylinderData } = await prevCylinderQuery;

    if (prevCylinderData) {
      setPreviousCylindersToday(prevCylinderData.reduce((sum, o) => sum + o.cylinder_count, 0));
    }

    // Fetch total orders count for date range
    const { count: dryIceCount } = await supabase
      .from("dry_ice_orders")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_date", fromDate)
      .lte("scheduled_date", toDate);

    // Cylinder count with location filter
    let periodCylinderQuery = supabase
      .from("gas_cylinder_orders")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_date", fromDate)
      .lte("scheduled_date", toDate);

    if (selectedLocation !== "all") {
      periodCylinderQuery = periodCylinderQuery.eq("location", selectedLocation);
    }

    const { count: cylinderCount } = await periodCylinderQuery;

    setWeekOrders((dryIceCount || 0) + (cylinderCount || 0));

    // Fetch previous period orders count (for trend)
    const { count: prevDryIceCount } = await supabase
      .from("dry_ice_orders")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_date", prevFromDate)
      .lte("scheduled_date", prevToDate);

    let prevPeriodCylinderQuery = supabase
      .from("gas_cylinder_orders")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_date", prevFromDate)
      .lte("scheduled_date", prevToDate);

    if (selectedLocation !== "all") {
      prevPeriodCylinderQuery = prevPeriodCylinderQuery.eq("location", selectedLocation);
    }

    const { count: prevCylinderCount } = await prevPeriodCylinderQuery;

    setPreviousWeekOrders((prevDryIceCount || 0) + (prevCylinderCount || 0));
  };

  return (
    <div className="space-y-6">
      {/* KPI Dashboard */}
      <KPIDashboard location={selectedLocation} refreshKey={refreshKey} dateRange={dateRange} />

      {/* Location Filter */}
      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border/50">
        <MapPin className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm text-muted-foreground mr-2">Locatie:</span>
        <TooltipProvider>
          <div className="flex gap-1">
            {/* "Alle locaties" - only clickable for admins */}
            {canViewAllLocations ? (
              <Badge
                variant={selectedLocation === "all" ? "default" : "outline"}
                className="cursor-pointer hover:bg-primary/80"
                onClick={() => setSelectedLocation("all")}
              >
                Alle locaties
              </Badge>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="cursor-not-allowed opacity-50 flex items-center gap-1"
                  >
                    <Lock className="h-3 w-3" />
                    Alle locaties
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Je hebt alleen toegang tot je toegewezen locatie</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* SOL Emmen */}
            {canViewAllLocations || userProductionLocation === "sol_emmen" ? (
              <Badge
                variant={selectedLocation === "sol_emmen" ? "default" : "outline"}
                className={cn(
                  "cursor-pointer",
                  selectedLocation === "sol_emmen"
                    ? "bg-orange-500 hover:bg-orange-600 text-white"
                    : "hover:bg-orange-100 dark:hover:bg-orange-900/30"
                )}
                onClick={() => setSelectedLocation("sol_emmen")}
              >
                SOL Emmen
              </Badge>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="cursor-not-allowed opacity-50 flex items-center gap-1"
                  >
                    <Lock className="h-3 w-3" />
                    SOL Emmen
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Je hebt geen toegang tot deze locatie</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* SOL Tilburg */}
            {canViewAllLocations || userProductionLocation === "sol_tilburg" ? (
              <Badge
                variant={selectedLocation === "sol_tilburg" ? "default" : "outline"}
                className={cn(
                  "cursor-pointer",
                  selectedLocation === "sol_tilburg"
                    ? "bg-blue-500 hover:bg-blue-600 text-white"
                    : "hover:bg-blue-100 dark:hover:bg-blue-900/30"
                )}
                onClick={() => setSelectedLocation("sol_tilburg")}
              >
                SOL Tilburg
              </Badge>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge
                    variant="outline"
                    className="cursor-not-allowed opacity-50 flex items-center gap-1"
                  >
                    <Lock className="h-3 w-3" />
                    SOL Tilburg
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Je hebt geen toegang tot deze locatie</p>
                </TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>

        {/* Show user's assigned location info if restricted */}
        {!canViewAllLocations && userProductionLocation && (
          <span className="text-xs text-muted-foreground ml-2 flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Beperkt tot jouw locatie
          </span>
        )}
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          value={`${dryIceToday} kg`}
          label="Droogijs gepland"
          icon={<Snowflake className="h-5 w-5 text-cyan-500" />}
          iconBgColor="bg-cyan-500/10"
          trend={{
            value: calculateTrend(dryIceToday, previousDryIceToday),
            label: "vs. vorige periode"
          }}
          className={cn(
            "glass-card transition-all duration-300",
            isRefreshing && "animate-pulse ring-2 ring-primary/30"
          )}
        />

        <div className="relative">
          <StatCard
            value={cylindersToday}
            label="Cilinders gepland"
            icon={<Cylinder className="h-5 w-5 text-orange-500" />}
            iconBgColor="bg-orange-500/10"
            trend={{
              value: calculateTrend(cylindersToday, previousCylindersToday),
              label: "vs. vorige periode"
            }}
            className={cn(
              "glass-card transition-all duration-300",
              isRefreshing && "animate-pulse ring-2 ring-primary/30"
            )}
          />
          {selectedLocation !== "all" && (
            <Badge variant="outline" className="absolute top-2 right-2 text-[10px] py-0">
              {selectedLocation === "sol_emmen" ? "Emmen" : "Tilburg"}
            </Badge>
          )}
        </div>

        <div className="relative">
          <StatCard
            value={weekOrders}
            label="Totaal orders"
            icon={<Package className="h-5 w-5 text-green-500" />}
            iconBgColor="bg-green-500/10"
            trend={{
              value: calculateTrend(weekOrders, previousWeekOrders),
              label: "vs. vorige periode"
            }}
            className={cn(
              "glass-card transition-all duration-300",
              isRefreshing && "animate-pulse ring-2 ring-primary/30"
            )}
          />
          {selectedLocation !== "all" && (
            <Badge variant="outline" className="absolute top-2 right-2 text-[10px] py-0">
              {selectedLocation === "sol_emmen" ? "Emmen" : "Tilburg"}
            </Badge>
          )}
        </div>

        <StockSummaryWidget
          refreshKey={refreshKey}
          isRefreshing={isRefreshing}
        />

        {/* Top 5 Customers Widget */}
        <TopCustomersWidget
          refreshKey={refreshKey}
          isRefreshing={isRefreshing}
          location={selectedLocation}
          dateRange={dateRange}
        />
      </div>

      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full max-w-5xl grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 bg-muted/50 backdrop-blur-sm overflow-x-auto">
          <TabsTrigger
            value="droogijs"
            className="data-[state=active]:bg-blue-500 data-[state=active]:text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
          >
            <Snowflake className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Droogijs</span>
            <span className="sm:hidden">IJs</span>
          </TabsTrigger>
          <TabsTrigger
            value="gascilinders"
            className="data-[state=active]:bg-blue-500 data-[state=active]:text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
          >
            <Cylinder className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Gascilinders</span>
            <span className="sm:hidden">Gas</span>
          </TabsTrigger>
          <TabsTrigger
            value="rapportage"
            className="data-[state=active]:bg-blue-500 data-[state=active]:text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
          >
            <BarChart3 className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Rapportage</span>
            <span className="sm:hidden">Stats</span>
          </TabsTrigger>
          <TabsTrigger
            value="veiligheid"
            className="data-[state=active]:bg-red-500 data-[state=active]:text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
          >
            <ShieldAlert className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Veiligheid</span>
            <span className="sm:hidden">Veilig</span>
          </TabsTrigger>
          <TabsTrigger
            value="sitemap"
            className="data-[state=active]:bg-blue-500 data-[state=active]:text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
          >
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Site Map</span>
            <span className="sm:hidden">Map</span>
          </TabsTrigger>
          <TabsTrigger
            value="trailer"
            className="data-[state=active]:bg-blue-500 data-[state=active]:text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
          >
            <Truck className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Trailer</span>
            <span className="sm:hidden">Truck</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="droogijs" className="mt-6">
          <Suspense fallback={<TabLoadingFallback />}>
            <DryIcePlanning
              onDataChanged={handleDataChanged}
              location={selectedLocation}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="gascilinders" className="mt-6">
          <Suspense fallback={<TabLoadingFallback />}>
            <GasCylinderPlanning
              onDataChanged={handleDataChanged}
              location={selectedLocation}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="rapportage" className="mt-6">
          <Suspense fallback={<ReportLoadingFallback />}>
            <ProductionReports 
              refreshKey={refreshKey} 
              onDataChanged={handleDataChanged} 
              location={selectedLocation}
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="veiligheid" className="mt-6">
          <Suspense fallback={<TabLoadingFallback />}>
            <SafetyInstructions />
          </Suspense>
        </TabsContent>

        <TabsContent value="sitemap" className="mt-6">
          <Suspense fallback={<TabLoadingFallback />}>
            <SiteMap location={selectedLocation} />
          </Suspense>
        </TabsContent>

        <TabsContent value="trailer" className="mt-6">
          <Suspense fallback={<TabLoadingFallback />}>
            <TrailerPlanning location={selectedLocation} />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div>
  );
}
