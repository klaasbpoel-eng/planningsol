import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { GasFlowPrediction, DeadStockItem } from "@/hooks/useGasFlowPredictor";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const MAX_CHART_ITEMS = 30;

export function GasFlowStockMonitorTab({ data, isLoading, error }: { data: any, isLoading: boolean, error: any }) {
  const [selectedLocation, setSelectedLocation] = useState<string>("Alle");
  const [showAll, setShowAll] = useState(false);
  const [showDeadStock, setShowDeadStock] = useState(false);

  const predictions = useMemo(
    () => (!isLoading && !error ? (data?.predictions || []) : []) as GasFlowPrediction[],
    [data, isLoading, error]
  );

  const deadStock = useMemo(
    () => (!isLoading && !error ? (data?.deadStock || []) : []) as DeadStockItem[],
    [data, isLoading, error]
  );

  const filteredPredictions = useMemo(() => {
    return predictions.filter(p => selectedLocation === "Alle" || p.location === selectedLocation);
  }, [predictions, selectedLocation]);

  // Default: prioritize Kritiek > Actie > OK, capped at MAX_CHART_ITEMS unless showAll
  const displayPredictions = useMemo(() => {
    if (showAll) return filteredPredictions;
    const critical = filteredPredictions.filter(p => p.status === 'Kritiek');
    const action   = filteredPredictions.filter(p => p.status === 'Actie');
    const ok       = filteredPredictions.filter(p => p.status === 'OK');
    const combined = [...critical, ...action, ...ok];
    return combined.slice(0, MAX_CHART_ITEMS);
  }, [filteredPredictions, showAll]);

  const formatter = (value: number) => new Intl.NumberFormat('nl-NL').format(value);

  const chartData = useMemo(() => displayPredictions.map(p => {
    const base = p.product.length > 26 ? p.product.substring(0, 26) + '…' : p.product;
    const locShort = p.location === 'Tilburg' ? 'TIL' : p.location === 'Emmen' ? 'EMM' : p.location;
    return {
      name: `${base} · ${p.capacityPerUnit}L · ${locShort}`,
      Voorraad: Math.round(p.currentStock),
      Vraag_7_Dagen: Math.round(p.predictedDemand7Days),
      Status: p.status,
      fullProduct: p.product,
      capacityPerUnit: p.capacityPerUnit,
      location: p.location,
    };
  }), [displayPredictions]);

  const hiddenCount = filteredPredictions.length - MAX_CHART_ITEMS;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <Skeleton className="h-[400px] w-full rounded-md" />
        </CardContent>
      </Card>
    );
  }

  if (error) return <div>Fout bij het laden van grafieken...</div>;

  // 38px per row for horizontal bars
  const chartHeight = Math.max(280, chartData.length * 38);

  return (
     <div className="grid grid-cols-1 gap-4">
        <Card>
          <CardHeader className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <CardTitle>Actuele Voorraad vs. Vraag</CardTitle>
              <CardDescription>
                Voorraad (stuks) versus verwachte afname komende 7 dagen.
                {!showAll && hiddenCount > 0 && (
                  <span className="ml-1 text-muted-foreground/70">Top {MAX_CHART_ITEMS} getoond (kritiek eerst).</span>
                )}
              </CardDescription>
            </div>
            <Tabs defaultValue="Alle" value={selectedLocation} onValueChange={setSelectedLocation} className="w-full sm:w-auto shrink-0">
              <TabsList className="w-full">
                <TabsTrigger value="Alle" className="flex-1">Totaal</TabsTrigger>
                <TabsTrigger value="Tilburg" className="flex-1">Tilburg</TabsTrigger>
                <TabsTrigger value="Emmen" className="flex-1">Emmen</TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent>
             {filteredPredictions.length === 0 ? (
               <div className="pt-10 pb-10 flex text-center flex-col items-center">
                 <p className="text-muted-foreground">Geen gegevens beschikbaar voor deze selectie.</p>
               </div>
             ) : (
               <>
                 <div style={{ height: chartHeight }} className="w-full mt-2">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        layout="vertical"
                        data={chartData}
                        margin={{ top: 5, right: 50, left: 10, bottom: 5 }}
                        barCategoryGap="25%"
                      >
                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                        <XAxis
                          type="number"
                          tickFormatter={formatter}
                          tick={{ fontSize: 11 }}
                          label={{ value: 'stuks', position: 'insideBottomRight', offset: -10, style: { fontSize: 11, fill: '#94a3b8' } }}
                        />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={260}
                          tick={{ fontSize: 11 }}
                          tickLine={false}
                        />
                        <Tooltip
                          formatter={(value: number, name: any) => [formatter(value) + ' st', String(name)]}
                          labelFormatter={(_label, payload) => {
                            if (!payload?.length) return _label;
                            const d = payload[0].payload;
                            return `${d.fullProduct} — ${d.capacityPerUnit}L — ${d.location}`;
                          }}
                          cursor={{ fill: 'rgba(0,0,0,0.04)' }}
                          contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                        />
                        <Legend verticalAlign="top" height={36} />
                        <Bar dataKey="Voorraad" name="Nu Op Voorraad" fill="#3b82f6" radius={[0, 4, 4, 0]}>
                          {chartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.Status === 'Kritiek' ? '#ef4444' : entry.Status === 'Actie' ? '#f59e0b' : '#3b82f6'} />
                          ))}
                        </Bar>
                        <Bar dataKey="Vraag_7_Dagen" name="Vraag (7 Dagen)" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                 </div>

                 {filteredPredictions.length > MAX_CHART_ITEMS && (
                   <div className="mt-4 flex justify-center">
                     <Button
                       variant="outline"
                       size="sm"
                       onClick={() => setShowAll(v => !v)}
                       className="gap-2 text-muted-foreground"
                     >
                       {showAll ? (
                         <><ChevronUp className="h-4 w-4" /> Minder tonen</>
                       ) : (
                         <><ChevronDown className="h-4 w-4" /> Alle {filteredPredictions.length} producten tonen</>
                       )}
                     </Button>
                   </div>
                 )}
               </>
             )}
          </CardContent>
        </Card>

        {deadStock.length > 0 && (
          <Card className="border-orange-500/20 bg-orange-500/5">
            <CardHeader className="flex flex-row items-center justify-between gap-4 py-4">
              <div className="flex items-center gap-2">
                <PackageX className="w-5 h-5 text-orange-500" />
                <div>
                  <CardTitle className="text-orange-700 text-base">Slapende Voorraad</CardTitle>
                  <CardDescription className="text-orange-600/70">
                    {deadStock.length} product{deadStock.length !== 1 ? 'en' : ''} op voorraad zonder afname de afgelopen 60 dagen — kandidaat voor overboeking of afschrijving.
                  </CardDescription>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowDeadStock(v => !v)} className="gap-2 shrink-0">
                {showDeadStock ? <><ChevronUp className="h-4 w-4" /> Verberg</> : <><ChevronDown className="h-4 w-4" /> Toon lijst</>}
              </Button>
            </CardHeader>
            {showDeadStock && (
              <CardContent>
                <div className="rounded-md border border-orange-200/50 overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-orange-50/50">
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Locatie</TableHead>
                        <TableHead className="text-right">Capaciteit</TableHead>
                        <TableHead className="text-right">Voorraad (st)</TableHead>
                        <TableHead className="text-right">Laatste afname</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deadStock.map((d, i) => (
                        <TableRow key={i}>
                          <TableCell className="font-medium">{d.product}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-muted-foreground font-normal">{d.location}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono text-sm text-muted-foreground">{d.capacityPerUnit} L</TableCell>
                          <TableCell className="text-right font-mono text-sm font-semibold">{Math.round(d.currentStock).toLocaleString()}</TableCell>
                          <TableCell className="text-right text-sm text-orange-600">
                            {d.daysSinceLastDelivery !== null ? `${d.daysSinceLastDelivery}d geleden` : 'Geen historie'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            )}
          </Card>
        )}
     </div>
  );
}
