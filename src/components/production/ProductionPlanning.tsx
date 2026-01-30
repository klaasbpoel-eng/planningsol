import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Snowflake, Cylinder, Package, TrendingUp, BarChart3 } from "lucide-react";
import { DryIcePlanning } from "./DryIcePlanning";
import { GasCylinderPlanning } from "./GasCylinderPlanning";
import { ProductionReports } from "./ProductionReports";
import { TopCustomersWidget } from "./TopCustomersWidget";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export function ProductionPlanning() {
  const [activeTab, setActiveTab] = useState("droogijs");
  const [dryIceToday, setDryIceToday] = useState(0);
  const [cylindersToday, setCylindersToday] = useState(0);
  const [weekOrders, setWeekOrders] = useState(0);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    
    // Fetch dry ice orders for today
    const { data: dryIceData } = await supabase
      .from("dry_ice_orders")
      .select("quantity_kg")
      .eq("scheduled_date", today)
      .neq("status", "cancelled");
    
    if (dryIceData) {
      setDryIceToday(dryIceData.reduce((sum, o) => sum + Number(o.quantity_kg), 0));
    }

    // Fetch cylinder orders for today
    const { data: cylinderData } = await supabase
      .from("gas_cylinder_orders")
      .select("cylinder_count")
      .eq("scheduled_date", today)
      .neq("status", "cancelled");
    
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

    const { count: cylinderCount } = await supabase
      .from("gas_cylinder_orders")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_date", format(weekStart, "yyyy-MM-dd"))
      .lte("scheduled_date", format(weekEnd, "yyyy-MM-dd"));

    setWeekOrders((dryIceCount || 0) + (cylinderCount || 0));
  };

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="glass-card">
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
        
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Cylinder className="h-4 w-4 text-orange-500" />
              Gascilinders vandaag
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{cylindersToday}</div>
            <p className="text-xs text-muted-foreground">Gepland voor vulling</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Package className="h-4 w-4 text-green-500" />
              Orders deze week
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{weekOrders}</div>
            <p className="text-xs text-muted-foreground">Totaal te verwerken</p>
          </CardContent>
        </Card>
        
        <Card className="glass-card">
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
        <TopCustomersWidget />
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
          <DryIcePlanning />
        </TabsContent>

        <TabsContent value="gascilinders" className="mt-6">
          <GasCylinderPlanning />
        </TabsContent>

        <TabsContent value="rapportage" className="mt-6">
          <ProductionReports />
        </TabsContent>
      </Tabs>
    </div>
  );
}
