import { PageLayout } from "@/components/layout/PageLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Factory, Truck, Database, Users, AlertTriangle } from "lucide-react";
import { useGasFlowPredictor } from "@/hooks/useGasFlowPredictor";
import { GasFlowProductionTab } from "@/components/dashboard/GasFlowProductionTab";
import { GasFlowLogisticsTab } from "@/components/dashboard/GasFlowLogisticsTab";
import { GasFlowStockMonitorTab } from "@/components/dashboard/GasFlowStockMonitorTab";
import { GasFlowDriversTab } from "@/components/dashboard/GasFlowDriversTab";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

export default function GasFlowOptimizerPage() {
  const { data, isLoading, error } = useGasFlowPredictor();
  const diag = data?._diagnostics;

  return (
    <PageLayout title="GasFlow Optimizer">
      <div className="flex-1 space-y-4 pt-6">
        {!isLoading && !error && diag && (
          <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 text-xs px-3 py-2 rounded-md border ${
            diag.afnameRows === 0 || diag.voorraadRows === 0
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-muted/50 border-border text-muted-foreground'
          }`}>
            {(diag.afnameRows === 0 || diag.voorraadRows === 0) && (
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            )}
            <span>Afname: <strong>{diag.afnameRows.toLocaleString('nl-NL')} rijen</strong></span>
            <span className="text-border">·</span>
            <span>Voorraad: <strong>{diag.voorraadRows.toLocaleString('nl-NL')} rijen</strong></span>
            {diag.lastAfnameDate && (
              <>
                <span className="text-border">·</span>
                <span>Meest recente Afname: <strong>{format(diag.lastAfnameDate, 'd MMM yyyy', { locale: nl })}</strong></span>
              </>
            )}
            {!diag.lastAfnameDate && diag.afnameRows > 0 && (
              <>
                <span className="text-border">·</span>
                <span className="text-amber-600">Geen geldige datums gevonden in Afname</span>
              </>
            )}
          </div>
        )}
        <Tabs defaultValue="productie" className="space-y-4">
          <TabsList className="bg-muted">
            <TabsTrigger value="productie" className="flex items-center gap-2">
              <Factory className="h-4 w-4" />
              <span className="hidden sm:inline">De Vul-lijst (Productie)</span>
              <span className="sm:hidden">Productie</span>
            </TabsTrigger>
            <TabsTrigger value="logistiek" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Rittenplanning (Logistiek)</span>
              <span className="sm:hidden">Logistiek</span>
            </TabsTrigger>
            <TabsTrigger value="voorraad" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Voorraad-Monitor</span>
              <span className="sm:hidden">Voorraad</span>
            </TabsTrigger>
            <TabsTrigger value="chauffeurs" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Chauffeurs</span>
              <span className="sm:hidden">Chauffeurs</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="productie" className="space-y-4">
            <GasFlowProductionTab data={data} isLoading={isLoading} error={error} />
          </TabsContent>

          <TabsContent value="logistiek" className="space-y-4">
            <GasFlowLogisticsTab data={data} isLoading={isLoading} error={error} />
          </TabsContent>

          <TabsContent value="voorraad" className="space-y-4">
            <GasFlowStockMonitorTab data={data} isLoading={isLoading} error={error} />
          </TabsContent>

          <TabsContent value="chauffeurs" className="space-y-4">
            <GasFlowDriversTab data={data} isLoading={isLoading} error={error} />
          </TabsContent>
        </Tabs>
      </div>
    </PageLayout>
  );
}
