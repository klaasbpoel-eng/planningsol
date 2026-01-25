import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Snowflake, Cylinder, Package, TrendingUp } from "lucide-react";
import { DryIcePlanning } from "./DryIcePlanning";
import { GasCylinderPlanning } from "./GasCylinderPlanning";

export function ProductionPlanning() {
  const [activeTab, setActiveTab] = useState("droogijs");

  return (
    <div className="space-y-6">
      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-cyan-500" />
              Droogijs vandaag
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0 kg</div>
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
            <div className="text-2xl font-bold">0</div>
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
            <div className="text-2xl font-bold">0</div>
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
      </div>

      {/* Main content tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted/50 backdrop-blur-sm">
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
        </TabsList>

        <TabsContent value="droogijs" className="mt-6">
          <DryIcePlanning />
        </TabsContent>

        <TabsContent value="gascilinders" className="mt-6">
          <GasCylinderPlanning />
        </TabsContent>
      </Tabs>
    </div>
  );
}
