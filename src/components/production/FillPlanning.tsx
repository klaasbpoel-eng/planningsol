import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertCircle, Calendar, CheckCircle2, Factory, MapPin, Search, TrendingDown } from "lucide-react";
import { useGasFlowPredictor } from "@/hooks/useGasFlowPredictor";
import { cn } from "@/lib/utils";

type LocFilter = "Alle" | "Emmen" | "Tilburg";

export function FillPlanning() {
  const { data, isLoading, error } = useGasFlowPredictor();
  const [view, setView] = useState<"perDag" | "perProduct">("perDag");
  const [loc, setLoc] = useState<LocFilter>("Alle");
  const [q, setQ] = useState("");

  const fillPlan = data?.fillPlan ?? [];
  const fillPlanByDay = data?.fillPlanByDay ?? [];

  const filteredFillPlan = useMemo(() => {
    return fillPlan.filter(fp => {
      const matchLoc = loc === "Alle" || fp.location === loc;
      const matchQ = q.trim() === "" || fp.product.toLowerCase().includes(q.toLowerCase());
      return matchLoc && matchQ;
    });
  }, [fillPlan, loc, q]);

  const filteredByDay = useMemo(() => {
    return fillPlanByDay.map(d => ({
      ...d,
      items: d.items.filter(it => {
        const matchLoc = loc === "Alle" || it.location === loc;
        const matchQ = q.trim() === "" || it.product.toLowerCase().includes(q.toLowerCase());
        return matchLoc && matchQ;
      }),
    }));
  }, [fillPlanByDay, loc, q]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive/50 bg-destructive/5">
        <CardHeader>
          <CardTitle className="text-destructive">Fout bij laden vulplanning</CardTitle>
          <CardDescription>{(error as Error).message}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const grandTotalFill = filteredByDay.reduce((s, d) => s + d.items.reduce((a, b) => a + b.suggestedFill, 0), 0);
  const grandTotalDemand = filteredByDay.reduce((s, d) => s + d.items.reduce((a, b) => a + b.expectedDemand, 0), 0);
  const productsToFill = filteredFillPlan.filter(fp => fp.totalSuggestedFill > 0).length;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-sm text-blue-600">
              <Factory className="w-4 h-4" /> Totaal te vullen (5 wkdgn)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-700">
              {grandTotalFill.toLocaleString('nl-NL')} <span className="text-sm font-normal text-blue-600/70">stuks</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/20">
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-sm text-amber-600">
              <TrendingDown className="w-4 h-4" /> Verwachte vraag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-amber-700">
              {grandTotalDemand.toLocaleString('nl-NL')} <span className="text-sm font-normal text-amber-600/70">stuks</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-500/5 border-emerald-500/20">
          <CardHeader className="py-4">
            <CardTitle className="flex items-center gap-2 text-sm text-emerald-600">
              <Calendar className="w-4 h-4" /> Producten met vulactie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-700">
              {productsToFill} <span className="text-sm font-normal text-emerald-600/70">producten</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
          <div>
            <CardTitle>Vulplanning komende werkweek</CardTitle>
            <CardDescription>
              Per dag een suggestie van wat gevuld moet worden, op basis van historische afname &amp; huidige voorraad.
              Voorraad rolt per dag mee — vulling vindt alleen plaats wanneer voorraad onder nul dreigt te zakken.
            </CardDescription>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0">
            <div className="relative w-full sm:w-56">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoek product..."
                className="pl-8"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
            <Tabs value={loc} onValueChange={(v) => setLoc(v as LocFilter)} className="w-full sm:w-auto">
              <TabsList className="w-full">
                <TabsTrigger value="Alle" className="flex-1">Alle</TabsTrigger>
                <TabsTrigger value="Emmen" className="flex-1">Emmen</TabsTrigger>
                <TabsTrigger value="Tilburg" className="flex-1">Tilburg</TabsTrigger>
              </TabsList>
            </Tabs>
            <Tabs value={view} onValueChange={(v) => setView(v as "perDag" | "perProduct")} className="w-full sm:w-auto">
              <TabsList className="w-full">
                <TabsTrigger value="perDag" className="flex-1">Per dag</TabsTrigger>
                <TabsTrigger value="perProduct" className="flex-1">Per product</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {view === "perDag" ? (
            <PerDayView days={filteredByDay} />
          ) : (
            <PerProductView items={filteredFillPlan} dayLabels={fillPlanByDay.map(d => d.dayLabel)} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PerDayView({ days }: { days: { date: string; dayLabel: string; totalExpectedDemand: number; totalSuggestedFill: number; items: { product: string; location: string; capacityPerUnit: number; expectedDemand: number; projectedStockBefore: number; suggestedFill: number; }[] }[] }) {
  const hasAny = days.some(d => d.items.length > 0);
  if (!hasAny) {
    return (
      <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
        <CheckCircle2 className="w-12 h-12 mb-2 text-emerald-500/60" />
        <p>Geen vulacties nodig in de komende 5 werkdagen.</p>
      </div>
    );
  }
  return (
    <Tabs defaultValue={days[0]?.date} className="w-full">
      <TabsList className="w-full grid grid-cols-5 h-auto">
        {days.map((d) => (
          <TabsTrigger key={d.date} value={d.date} className="flex flex-col py-2 gap-0.5">
            <span className="text-xs capitalize">{d.dayLabel}</span>
            <span className={cn(
              "text-[10px] font-mono",
              d.totalSuggestedFill > 0 ? "text-blue-600 font-semibold" : "text-muted-foreground"
            )}>
              {d.totalSuggestedFill > 0 ? `+${d.totalSuggestedFill}` : '—'}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {days.map((d) => (
        <TabsContent key={d.date} value={d.date} className="mt-4">
          {d.items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground flex flex-col items-center">
              <CheckCircle2 className="w-10 h-10 mb-2 text-emerald-500/60" />
              <p className="text-sm">Geen vulacties op {d.dayLabel}.</p>
            </div>
          ) : (
            <div className="rounded-md border border-border/50 overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50 whitespace-nowrap">
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Locatie</TableHead>
                    <TableHead className="text-right">Capaciteit</TableHead>
                    <TableHead className="text-right">Voorraad</TableHead>
                    <TableHead className="text-right">Verwachte vraag</TableHead>
                    <TableHead className="text-right">Bijvullen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {d.items.map((it) => (
                    <TableRow key={`${it.product}_${it.location}_${it.capacityPerUnit}`}>
                      <TableCell className="font-medium text-primary">{it.product}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal text-muted-foreground bg-background">
                          <MapPin className="w-3 h-3 mr-1" /> {it.location}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">{it.capacityPerUnit} L</TableCell>
                      <TableCell className="text-right font-mono text-sm">{it.projectedStockBefore.toLocaleString('nl-NL')}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-amber-600">{it.expectedDemand.toLocaleString('nl-NL')}</TableCell>
                      <TableCell className="text-right font-bold text-blue-600">+{it.suggestedFill.toLocaleString('nl-NL')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function PerProductView({ items, dayLabels }: { items: { product: string; location: string; capacityPerUnit: number; startStock: number; totalExpectedDemand: number; totalSuggestedFill: number; perDay: { date: string; expectedDemand: number; projectedStockBefore: number; projectedStockAfter: number; suggestedFill: number; endStock: number; }[] }[]; dayLabels: string[] }) {
  if (items.length === 0) {
    return (
      <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
        <CheckCircle2 className="w-12 h-12 mb-2 text-emerald-500/60" />
        <p>Geen vulplanning beschikbaar voor deze selectie.</p>
      </div>
    );
  }
  return (
    <div className="rounded-md border border-border/50 overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50 whitespace-nowrap">
          <TableRow>
            <TableHead className="sticky left-0 bg-muted/50 z-10">Product</TableHead>
            <TableHead>Locatie</TableHead>
            <TableHead className="text-right">Cap.</TableHead>
            <TableHead className="text-right">Start</TableHead>
            {dayLabels.map((lbl, i) => (
              <TableHead key={i} className="text-right capitalize">{lbl}</TableHead>
            ))}
            <TableHead className="text-right">Totaal vullen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((fp) => (
            <TableRow
              key={`${fp.product}_${fp.location}_${fp.capacityPerUnit}`}
              className={fp.totalSuggestedFill > 0 ? "" : "opacity-60"}
            >
              <TableCell className="font-medium text-primary sticky left-0 bg-background z-10">{fp.product}</TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal text-muted-foreground bg-background">
                  <MapPin className="w-3 h-3 mr-1" /> {fp.location}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">{fp.capacityPerUnit} L</TableCell>
              <TableCell className="text-right font-mono text-sm">{fp.startStock.toLocaleString('nl-NL')}</TableCell>
              {fp.perDay.map((d, i) => (
                <TableCell key={i} className="text-right font-mono text-xs">
                  <div className="flex flex-col items-end leading-tight">
                    {d.suggestedFill > 0 ? (
                      <span className="font-bold text-blue-600">+{d.suggestedFill}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    <span className={cn(
                      "text-[10px]",
                      d.expectedDemand > 0 ? "text-amber-600" : "text-muted-foreground/60"
                    )}>
                      {d.expectedDemand > 0 ? `−${d.expectedDemand}` : ''}
                    </span>
                  </div>
                </TableCell>
              ))}
              <TableCell className="text-right font-bold">
                {fp.totalSuggestedFill > 0 ? (
                  <span className="text-blue-600">+{fp.totalSuggestedFill.toLocaleString('nl-NL')}</span>
                ) : (
                  <span className="text-emerald-600 inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> OK</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}