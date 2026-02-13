import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Snowflake, Cylinder, Package, BarChart3, MapPin, Lock, ShieldAlert, Truck, FlaskConical } from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { TopCustomersWidget } from "./TopCustomersWidget";
import { KPIDashboard } from "./KPIDashboard";
import { StockSummaryWidget } from "./StockSummaryWidget";
import { FadeIn } from "@/components/ui/fade-in";
import { TableSkeleton, ChartSkeleton } from "@/components/ui/skeletons";

// Lazy load heavy tab components

const GasCylinderPlanning = lazy(() => import("./GasCylinderPlanning").then(m => ({ default: m.GasCylinderPlanning })));
const ProductionReports = lazy(() => import("./ProductionReports").then(m => ({ default: m.ProductionReports })));
const DryIcePlanning = lazy(() => import("./DryIcePlanning").then(m => ({ default: m.DryIcePlanning })));
const GasMixtureRecipemaker = lazy(() => import("./GasMixtureRecipemaker"));


// ... (existing code)



// Loading fallback component with skeleton
const TabLoadingFallback = () => (
  <TableSkeleton rows={6} columns={5} />
);

const ReportLoadingFallback = () => (
  <ChartSkeleton height={350} />
);
import { api } from "@/lib/api";
import { format, subWeeks, startOfMonth, endOfMonth, differenceInDays, subDays, startOfYear, endOfYear, startOfWeek, endOfWeek, isSameDay, isSameMonth, isSameYear, subMonths, subYears } from "date-fns";
import { nl } from "date-fns/locale";
import { cn, formatNumber } from "@/lib/utils";
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
  const [activeTab, setActiveTab] = useState("gascilinders");
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

  // Helper function to format date range as human-readable label
  const getDateRangeLabel = useCallback((range: DateRange): string => {
    const now = new Date();
    const { from, to } = range;

    // Check for common presets
    // This year
    if (isSameDay(from, startOfYear(now)) && isSameDay(to, endOfYear(now))) {
      return "Dit jaar";
    }

    // Last year
    const lastYear = subYears(now, 1);
    if (isSameDay(from, startOfYear(lastYear)) && isSameDay(to, endOfYear(lastYear))) {
      return "Vorig jaar";
    }

    // This month
    if (isSameDay(from, startOfMonth(now)) && isSameDay(to, endOfMonth(now))) {
      return "Deze maand";
    }

    // Last month
    const lastMonth = subMonths(now, 1);
    if (isSameDay(from, startOfMonth(lastMonth)) && isSameDay(to, endOfMonth(lastMonth))) {
      return "Vorige maand";
    }

    // This week
    if (isSameDay(from, startOfWeek(now, { weekStartsOn: 1 })) &&
      isSameDay(to, endOfWeek(now, { weekStartsOn: 1 }))) {
      return "Deze week";
    }

    // Check for quarter (3 months ending this month)
    const threeMonthsAgo = subMonths(startOfMonth(now), 2);
    if (isSameDay(from, threeMonthsAgo) && isSameDay(to, endOfMonth(now))) {
      return "Laatste 3 maanden";
    }

    // Check if it's a full month
    if (isSameDay(from, startOfMonth(from)) && isSameDay(to, endOfMonth(from)) && isSameMonth(from, to)) {
      return format(from, "MMMM yyyy", { locale: nl });
    }

    // Check if it's a full year
    if (isSameDay(from, startOfYear(from)) && isSameDay(to, endOfYear(from)) && isSameYear(from, to)) {
      return format(from, "yyyy");
    }

    // Default: show date range
    if (isSameYear(from, to)) {
      return `${format(from, "d MMM", { locale: nl })} - ${format(to, "d MMM yyyy", { locale: nl })}`;
    }
    return `${format(from, "d MMM yyyy", { locale: nl })} - ${format(to, "d MMM yyyy", { locale: nl })}`;
  }, []);

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

    // Use RPC functions for server-side aggregation (avoids 1000 row limit)
    const locationParam = selectedLocation === "all" ? null : selectedLocation;

    try {
      // Fetch current period stats using RPC functions (parallel calls)
      const isTilburg = selectedLocation === "sol_tilburg";

      // Skip dry ice RPC calls for Tilburg (dry ice is only produced in Emmen)
      // Skip dry ice RPC calls for Tilburg (dry ice is only produced in Emmen)
      const dryIcePromise = isTilburg
        ? Promise.resolve([{ total_kg: 0, total_orders: 0 }] as any)
        : api.reports.getDryIceEfficiency(fromDate, toDate, null);
      const prevDryIcePromise = isTilburg
        ? Promise.resolve([{ total_kg: 0, total_orders: 0 }] as any)
        : api.reports.getDryIceEfficiency(prevFromDate, prevToDate, null);

      const [dryIceData, cylinderData, prevDryIceData, prevCylinderData] = await Promise.all([
        dryIcePromise,
        api.reports.getProductionEfficiency(fromDate, toDate, locationParam),
        prevDryIcePromise,
        api.reports.getProductionEfficiency(prevFromDate, prevToDate, locationParam)
      ]);

      // Handle dry ice current period
      if (dryIceData?.[0]) {
        setDryIceToday(Number(dryIceData[0].total_kg) || 0);
      }

      // Handle cylinder current period
      if (cylinderData?.[0]) {
        setCylindersToday(Number(cylinderData[0].total_cylinders) || 0);
      }

      // Handle dry ice previous period
      if (prevDryIceData?.[0]) {
        setPreviousDryIceToday(Number(prevDryIceData[0].total_kg) || 0);
      }

      // Handle cylinder previous period
      if (prevCylinderData?.[0]) {
        setPreviousCylindersToday(Number(prevCylinderData[0].total_cylinders) || 0);
      }

      // Calculate total orders from RPC responses
      const currentDryIceOrders = isTilburg ? 0 : (dryIceData?.[0]?.total_orders || 0);
      const currentCylinderOrders = cylinderData?.[0]?.total_orders || 0;
      setWeekOrders(Number(currentDryIceOrders) + Number(currentCylinderOrders));

      const prevDryIceOrders = isTilburg ? 0 : (prevDryIceData?.[0]?.total_orders || 0);
      const prevCylinderOrders = prevCylinderData?.[0]?.total_orders || 0;
      setPreviousWeekOrders(Number(prevDryIceOrders) + Number(prevCylinderOrders));

    } catch (error) {
      console.error("[ProductionPlanning] Error fetching stats:", error);
    }
  };

  // Determine which tabs to show based on permissions
  const showAdvancedTabs = permissions?.canViewReports ?? true;
  const showKPIDashboard = permissions?.canViewKPIDashboard ?? true;
  const showAdvancedWidgets = permissions?.canViewAdvancedWidgets ?? true;

  return (
    <div className="space-y-6">
      {/* KPI Dashboard - only for non-operators */}
      {showKPIDashboard && (
        <KPIDashboard location={selectedLocation} refreshKey={refreshKey} dateRange={dateRange} />
      )}

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

      {/* Quick stats - Only show for planning tabs, hide for reporting to give more space */}
      {activeTab !== 'rapportage' && (
        <div className="space-y-2">
          {/* Period indicator - only show report tab hint for users who can see reports */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-medium">
              📅 {getDateRangeLabel(dateRange)}
            </Badge>
            {showAdvancedTabs && (
              <span className="text-xs text-muted-foreground">
                Wijzig periode in Rapportage tab
              </span>
            )}
          </div>

          <div className={cn(
            "grid gap-4",
            showAdvancedWidgets
              ? selectedLocation === "sol_tilburg"
                ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
                : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5"
              : selectedLocation === "sol_tilburg"
                ? "grid-cols-1 sm:grid-cols-2"
                : "grid-cols-1 sm:grid-cols-3"
          )}>
            {selectedLocation !== "sol_tilburg" && (
              <StatCard
                value={`${formatNumber(dryIceToday, 0)} kg`}
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
            )}

            <div className="relative">
              <StatCard
                value={formatNumber(cylindersToday, 0)}
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
                value={formatNumber(weekOrders, 0)}
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

            {/* Advanced widgets - only for non-operators */}
            {showAdvancedWidgets && (
              <>
                <StockSummaryWidget
                  refreshKey={refreshKey}
                  isRefreshing={isRefreshing}
                  selectedLocation={selectedLocation}
                />

                <TopCustomersWidget
                  refreshKey={refreshKey}
                  isRefreshing={isRefreshing}
                  location={selectedLocation}
                  dateRange={dateRange}
                />
              </>
            )}
          </div>
        </div>
      )}

      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={cn(
          "w-full max-w-5xl grid bg-muted/50 backdrop-blur-sm overflow-x-auto h-auto p-1",
          showAdvancedTabs
            ? "grid-cols-4 sm:grid-cols-7"
            : "grid-cols-3 sm:grid-cols-4"
        )}>

          <TabsTrigger
            value="gascilinders"
            className="data-[state=active]:bg-blue-500 data-[state=active]:text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
          >
            <Cylinder className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Gascilinders</span>
            <span className="sm:hidden">Cilinders</span>
          </TabsTrigger>
          <TabsTrigger
            value="droogijs"
            className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
          >
            <Snowflake className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Droogijs</span>
            <span className="sm:hidden">Droogijs</span>
          </TabsTrigger>
          {showAdvancedTabs && (
            <>
              <TabsTrigger
                value="rapportage"
                className="data-[state=active]:bg-blue-500 data-[state=active]:text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
              >
                <BarChart3 className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Rapportage</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
            </>
          )}
          <TabsTrigger
            value="recepten"
            className="data-[state=active]:bg-purple-500 data-[state=active]:text-white flex items-center gap-1 sm:gap-2 text-xs sm:text-sm px-2 sm:px-3"
          >
            <FlaskConical className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Recepten</span>
            <span className="sm:hidden">Recept</span>
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

        {showAdvancedTabs && (
          <>
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


          </>
        )}

        <TabsContent value="recepten" className="mt-6">
          <Suspense fallback={<TabLoadingFallback />}>
            <GasMixtureRecipemaker />
          </Suspense>
        </TabsContent>
      </Tabs>
    </div >
  );
}
