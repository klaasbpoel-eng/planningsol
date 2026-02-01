import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Snowflake, Cylinder, Package, TrendingUp, BarChart3, MapPin, Lock } from "lucide-react";
import { DryIcePlanning } from "./DryIcePlanning";
import { GasCylinderPlanning } from "./GasCylinderPlanning";
import { ProductionReports } from "./ProductionReports";
import { TopCustomersWidget } from "./TopCustomersWidget";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Database } from "@/integrations/supabase/types";
import type { RolePermissions } from "@/hooks/useUserPermissions";

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";
type UserProductionLocation = Database["public"]["Enums"]["production_location"] | null;

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
  const [refreshKey, setRefreshKey] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
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
  }, [refreshKey, selectedLocation]);

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

  const fetchStats = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    
    // Fetch dry ice orders for today (filtered by location if not "all")
    let dryIceQuery = supabase
      .from("dry_ice_orders")
      .select("quantity_kg")
      .eq("scheduled_date", today)
      .neq("status", "cancelled");
    
    // Note: dry_ice_orders doesn't have a location column, so we don't filter it by location
    
    const { data: dryIceData } = await dryIceQuery;
    
    if (dryIceData) {
      setDryIceToday(dryIceData.reduce((sum, o) => sum + Number(o.quantity_kg), 0));
    }

    // Fetch cylinder orders for today (filtered by location)
    let cylinderQuery = supabase
      .from("gas_cylinder_orders")
      .select("cylinder_count")
      .eq("scheduled_date", today)
      .neq("status", "cancelled");
    
    if (selectedLocation !== "all") {
      cylinderQuery = cylinderQuery.eq("location", selectedLocation);
    }
    
    const { data: cylinderData } = await cylinderQuery;
    
    if (cylinderData) {
      setCylindersToday(cylinderData.reduce((sum, o) => sum + o.cylinder_count, 0));
    }

    // Fetch week orders count
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const { count: dryIceCount } = await supabase
      .from("dry_ice_orders")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_date", format(weekStart, "yyyy-MM-dd"))
      .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"));

    // Week cylinder count with location filter
    let weekCylinderQuery = supabase
      .from("gas_cylinder_orders")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_date", format(weekStart, "yyyy-MM-dd"))
      .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"));
    
    if (selectedLocation !== "all") {
      weekCylinderQuery = weekCylinderQuery.eq("location", selectedLocation);
    }
    
    const { count: cylinderCount } = await weekCylinderQuery;

    setWeekOrders((dryIceCount || 0) + (cylinderCount || 0));
  };

  return (
    <div className="space-y-6">
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
        <Card className={cn(
          "glass-card transition-all duration-300",
          isRefreshing && "animate-pulse ring-2 ring-primary/30"
        )}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-cyan-500" />
              Droogijs vandaag
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dryIceToday} kg</div>
            <p className="text-xs text-muted-foreground">Gepland voor productie</p>
          </CardContent>
        </Card>
        
        <Card className={cn(
          "glass-card transition-all duration-300",
          isRefreshing && "animate-pulse ring-2 ring-primary/30"
        )}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Cylinder className="h-4 w-4 text-orange-500" />
              Gascilinders vandaag
              {selectedLocation !== "all" && (
                <Badge variant="outline" className="ml-1 text-[10px] py-0">
                  {selectedLocation === "sol_emmen" ? "Emmen" : "Tilburg"}
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cylindersToday}</div>
            <p className="text-xs text-muted-foreground">Gepland voor vulling</p>
          </CardContent>
        </Card>
        
        <Card className={cn(
          "glass-card transition-all duration-300",
          isRefreshing && "animate-pulse ring-2 ring-primary/30"
        )}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Package className="h-4 w-4 text-green-500" />
              Orders deze week
              {selectedLocation !== "all" && (
                <Badge variant="outline" className="ml-1 text-[10px] py-0">
                  {selectedLocation === "sol_emmen" ? "Emmen" : "Tilburg"}
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekOrders}</div>
            <p className="text-xs text-muted-foreground">Totaal te verwerken</p>
          </CardContent>
        </Card>
        
        <Card className={cn(
          "glass-card transition-all duration-300",
          isRefreshing && "animate-pulse ring-2 ring-primary/30"
        )}>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" />
              Voorraadstatus
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">Goed</div>
            <p className="text-xs text-muted-foreground">Alle niveaus op peil</p>
          </CardContent>
        </Card>

        {/* Top 5 Customers Widget */}
        <TopCustomersWidget 
          refreshKey={refreshKey} 
          isRefreshing={isRefreshing} 
          location={selectedLocation}
        />
      </div>

      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-lg grid-cols-3 bg-muted/50 backdrop-blur-sm">
          <TabsTrigger 
            value="droogijs" 
            className="data-[state=active]:bg-cyan-500 data-[state=active]:text-white flex items-center gap-2"
          >
            <Snowflake className="h-4 w-4" />
            Droogijs
          </TabsTrigger>
          <TabsTrigger 
            value="gascilinders"
            className="data-[state=active]:bg-orange-500 data-[state=active]:text-white flex items-center gap-2"
          >
            <Cylinder className="h-4 w-4" />
            Gascilinders
          </TabsTrigger>
          <TabsTrigger 
            value="rapportage"
            className="data-[state=active]:bg-blue-500 data-[state=active]:text-white flex items-center gap-2"
          >
            <BarChart3 className="h-4 w-4" />
            Rapportage
          </TabsTrigger>
        </TabsList>

        <TabsContent value="droogijs" className="mt-6">
          <DryIcePlanning 
            onDataChanged={handleDataChanged} 
            location={selectedLocation}
          />
        </TabsContent>

        <TabsContent value="gascilinders" className="mt-6">
          <GasCylinderPlanning 
            onDataChanged={handleDataChanged} 
            location={selectedLocation}
          />
        </TabsContent>

        <TabsContent value="rapportage" className="mt-6">
          <ProductionReports refreshKey={refreshKey} onDataChanged={handleDataChanged} location={selectedLocation} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
