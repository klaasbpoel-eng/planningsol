import { useState, useMemo } from "react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle2, Clock, Search, MapPin, Factory, ArrowLeftRight } from "lucide-react";
import type { GasFlowPrediction } from "@/hooks/useGasFlowPredictor";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function GasFlowProductionTab({ data, isLoading, error }: { data: any, isLoading: boolean, error: any }) {
  const [selectedLocation, setSelectedLocation] = useState<string>("Alle");
  const [searchQuery, setSearchQuery] = useState("");

  const allPredictions = useMemo(
    () => (!isLoading && !error ? (data?.predictions || []) : []) as GasFlowPrediction[],
    [data, isLoading, error]
  );

  const filteredPredictions = useMemo(() => {
    return allPredictions.filter(p => {
      const matchLoc = selectedLocation === "Alle" || p.location === selectedLocation;
      const matchSearch = p.product.toLowerCase().includes(searchQuery.toLowerCase());
      return matchLoc && matchSearch;
    });
  }, [allPredictions, selectedLocation, searchQuery]);

  // T1-B: lookup voor depotbalans — vind zelfde product+cap bij ander depot
  const predictionByKey = useMemo(() => {
    const map = new Map<string, GasFlowPrediction>();
    allPredictions.forEach(p => map.set(`${p.product}__${p.capacityPerUnit}__${p.location}`, p));
    return map;
  }, [allPredictions]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-red-500/50 bg-red-500/10">
        <CardHeader>
          <CardTitle className="text-red-500">Error Loading Predictions</CardTitle>
          <CardDescription className="text-red-400">{error.message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  // Derived metrics
  const totalKritiek = filteredPredictions.filter(p => p.status === 'Kritiek').length;
  const totalActie = filteredPredictions.filter(p => p.status === 'Actie').length;
  const totalDeficit = filteredPredictions.reduce((sum, p) => sum + (p.deficit > 0 ? p.deficit : 0), 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-red-500/5 border-red-500/20">
          <CardHeader className="py-4">
            <CardTitle className="text-red-600 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4"/> Kritieke Tekorten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700">{totalKritiek} <span className="text-sm font-normal text-red-600/70">producten</span></div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-500/5 border-yellow-500/20">
          <CardHeader className="py-4">
            <CardTitle className="text-yellow-600 flex items-center gap-2 text-sm"><Clock className="w-4 h-4"/> Actie Vereist (&lt;10d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-700">{totalActie} <span className="text-sm font-normal text-yellow-600/70">producten</span></div>
          </CardContent>
        </Card>
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardHeader className="py-4">
            <CardTitle className="text-blue-600 flex items-center gap-2 text-sm"><Factory className="w-4 h-4"/> Totaal Bijvullen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">+{Math.round(totalDeficit).toLocaleString()} <span className="text-sm font-normal text-blue-600/70">stuks</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div>
            <CardTitle>De Vul-lijst</CardTitle>
            <CardDescription>Overzicht van benodigde vulcapaciteit op basis van voorspelde vraag.</CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek product..."
                className="pl-8"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Tabs defaultValue="Alle" value={selectedLocation} onValueChange={setSelectedLocation} className="w-full sm:w-auto">
              <TabsList className="w-full">
                <TabsTrigger value="Alle" className="flex-1">Alle</TabsTrigger>
                <TabsTrigger value="Tilburg" className="flex-1">Tilburg</TabsTrigger>
                <TabsTrigger value="Emmen" className="flex-1">Emmen</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {filteredPredictions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
              <CheckCircle2 className="w-12 h-12 mb-2 text-green-500/50" />
              <p>Geen productie acties nodig voor deze selectie.</p>
            </div>
          ) : (
            <div className="rounded-md border border-border/50 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50 whitespace-nowrap">
                  <TableRow>
                    <TableHead>Prioriteit</TableHead>
                    <TableHead>Locatie</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Capaciteit</TableHead>
                    <TableHead className="text-right">Voorraad (st)</TableHead>
                    <TableHead className="text-right">Vraag (st)</TableHead>
                    <TableHead className="text-right">Bijvullen (st)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPredictions.map((p) => (
                    <TableRow key={`${p.product}_${p.location}_${p.capacityPerUnit}`} className={p.status === 'Kritiek' ? 'bg-red-500/5' : ''}>
                      <TableCell>
                        {p.status === 'Kritiek' && <Badge variant="destructive" className="flex w-max items-center gap-1"><AlertCircle className="w-3 h-3" /> Kritiek</Badge>}
                        {p.status === 'Actie' && <Badge variant="secondary" className="bg-yellow-500/10 text-yellow-600 hover:bg-yellow-500/20 flex w-max items-center gap-1"><Clock className="w-3 h-3" /> Let op (&lt;10d)</Badge>}
                        {p.status === 'OK' && <Badge variant="outline" className="text-green-500 border-green-200 bg-green-500/5 flex w-max items-center gap-1"><CheckCircle2 className="w-3 h-3" /> OK</Badge>}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-muted-foreground font-normal bg-background"><MapPin className="w-3 h-3 mr-1"/>{p.location}</Badge>
                      </TableCell>
                      <TableCell className="font-medium text-primary">
                        {p.product}
                        {p.status === 'Kritiek' && (() => {
                          const altLoc = p.location === 'Tilburg' ? 'Emmen' : p.location === 'Emmen' ? 'Tilburg' : null;
                          const alt = altLoc ? predictionByKey.get(`${p.product}__${p.capacityPerUnit}__${altLoc}`) : null;
                          if (!alt || alt.currentStock <= 0) return null;
                          return (
                            <div className="mt-1">
                              <Badge variant="outline" className="text-blue-600 border-blue-200 bg-blue-50 text-[10px] gap-1">
                                <ArrowLeftRight className="w-2.5 h-2.5" />{altLoc}: {Math.round(alt.currentStock).toLocaleString()} st beschikbaar
                              </Badge>
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">{p.capacityPerUnit} L</TableCell>
                      <TableCell className="text-right font-mono text-sm">{Math.round(p.currentStock).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">
                        {p.status === 'Actie'
                          ? <span title={`7d: ${Math.round(p.predictedDemand7Days)} st · 10d: ${Math.round(p.predictedDemand10Days)} st`}>{Math.round(p.predictedDemand10Days)} <span className="text-[10px] text-muted-foreground/60">10d</span></span>
                          : <span title={`7d: ${Math.round(p.predictedDemand7Days)} st`}>{Math.round(p.predictedDemand7Days)} <span className="text-[10px] text-muted-foreground/60">7d</span></span>
                        }
                      </TableCell>
                      <TableCell className={`text-right font-bold text-sm ${p.deficit > 0 ? 'text-red-500' : 'text-green-500'}`}>
                        {p.deficit > 0 ? `+${p.deficit.toLocaleString()}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
