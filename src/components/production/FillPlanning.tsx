import { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Calendar,
  CheckCircle2,
  Download,
  Factory,
  Layers,
  MapPin,
  Printer,
  Search,
  Shield,
  SlidersHorizontal,
  TrendingDown,
} from "lucide-react";
import { useGasFlowPredictor } from "@/hooks/useGasFlowPredictor";
import {
  computeFillPlan,
  filterFillPlan,
  type FillPlanDay,
  type FillPlanItem,
  type FillPlanMethod,
  type LocFilter,
  type PackageFilter,
  type SafetyBufferMode,
} from "@/lib/fillPlanning";
import { cn } from "@/lib/utils";
import {
  coveredByStock,
  dayRangeLabel,
  formatLiters,
  shortageAfterDemand,
  summarizeByUnit,
  unitWord,
  type UnitTotals,
} from "@/lib/fillPlanPresentation";

const nl = (n: number) => n.toLocaleString("nl-NL");

function UnitSplit({ t }: { t: UnitTotals }) {
  return (
    <div className="space-y-1">
      <div className="text-2xl font-bold tabular-nums">
        {nl(t.cylinders)} <span className="text-sm font-normal text-muted-foreground">{unitWord(false, t.cylinders)}</span>
      </div>
      {t.bundles > 0 && (
        <div className="text-sm tabular-nums">
          + {nl(t.bundles)} {unitWord(true, t.bundles)}{" "}
          <span className="text-xs text-muted-foreground">(= {nl(t.bundleCylinders)} cilinders)</span>
        </div>
      )}
    </div>
  );
}

const METHOD_LABELS: Record<FillPlanMethod, { label: string; description: string }> = {
  ewma_seasonal: {
    label: "Gewogen + Seizoensfactor (aanbevolen)",
    description:
      "Recente weken wegen zwaarder (EWMA), eenmalige uitschieters worden gedempt en gecorrigeerd met de seizoensfactor van vorig jaar",
  },
  hybrid: {
    label: "Gecombineerd (klant + weekdag)",
    description: "Mix van mediaan klantinterval + 12-weken weekdaggemiddelde (vangt ook losse afnames op)",
  },
  customer_interval: {
    label: "Klantpatronen (mediaan interval)",
    description: "Voorspelt herbestellingen per klant met mediaan interval en recente afname",
  },
  weekday_avg: {
    label: "Weekdaggemiddelde (12 wkn)",
    description: "Gemiddelde historische afname per weekdag (ma–vr) over de afgelopen 12 weken",
  },
};

export function FillPlanning() {
  const { data, isLoading, error } = useGasFlowPredictor();

  // View & filters
  const [view, setView] = useState<"perDag" | "perProduct">("perDag");
  const [loc, setLoc] = useState<LocFilter>("Alle");
  const [packageFilter, setPackageFilter] = useState<PackageFilter>("Alle");
  const [q, setQ] = useState("");

  // Configurable planning parameters
  const [horizonDays, setHorizonDays] = useState<5 | 10 | 15>(5);
  const [safetyBuffer, setSafetyBuffer] = useState<number>(0);
  const [safetyBufferMode, setSafetyBufferMode] = useState<SafetyBufferMode>("units");
  const [method, setMethod] = useState<FillPlanMethod>("ewma_seasonal");
  const [selectedDay, setSelectedDay] = useState<string>("");

  const computed = useMemo(() => {
    const inputs = data?.fillPlanInputs ?? [];
    if (inputs.length === 0) {
      return {
        fillPlan: data?.fillPlan ?? [],
        fillPlanByDay: data?.fillPlanByDay ?? [],
      };
    }
    return computeFillPlan(inputs, {
      horizonDays,
      safetyBuffer,
      safetyBufferMode,
      method,
    });
  }, [data?.fillPlanInputs, data?.fillPlan, data?.fillPlanByDay, horizonDays, safetyBuffer, safetyBufferMode, method]);

  const { fillPlan: filteredFillPlan, fillPlanByDay: filteredByDay } = useMemo(
    () =>
      filterFillPlan(computed.fillPlan, computed.fillPlanByDay, {
        location: loc,
        search: q,
        packageFilter,
      }),
    [computed.fillPlan, computed.fillPlanByDay, loc, q, packageFilter]
  );

  // Keep selectedDay valid when horizon changes
  useEffect(() => {
    if (filteredByDay.length > 0 && !filteredByDay.some((d) => d.date === selectedDay)) {
      setSelectedDay(filteredByDay[0].date);
    }
  }, [filteredByDay, selectedDay]);

  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Dagplanning
    const dayRows = filteredByDay.flatMap((d) =>
      d.items.map((it) => ({
        Datum: d.date,
        Dag: d.dayLabel,
        Product: it.product,
        Verpakking: it.packageType || (it.isBundle ? "Bundel" : "Cilinder"),
        Locatie: it.location,
        Type: it.isBundle ? "Bundel" : "Cilinder",
        "Capaciteit (L)": it.displayCapacityLiters,
        "Voorraad begin dag": it.projectedStockBefore,
        "Verwachte vraag": it.expectedDemand,
        "Bufferdoel": it.safetyTarget,
        Tekort: shortageAfterDemand(it),
        "Bijvullen": it.suggestedFill,
        Eenheid: it.isBundle ? "bundels" : "cilinders",
        Opmerking: "Voorspelling, geen bevestigde orders",
      }))
    );

    const wsDays = XLSX.utils.json_to_sheet(
      dayRows.length > 0
        ? dayRows
        : [{ Melding: `Geen vulacties nodig in de komende ${horizonDays} werkdagen.` }]
    );
    XLSX.utils.book_append_sheet(wb, wsDays, "Dagplanning");

    // Sheet 2: Per product matrix
    const productRows = filteredFillPlan.map((fp) => {
      const row: Record<string, string | number> = {
        Product: fp.product,
        Verpakking: fp.packageType || (fp.isBundle ? "Bundel" : "Cilinder"),
        Locatie: fp.location,
        Type: fp.isBundle ? "Bundel" : "Cilinder",
        "Capaciteit (L)": fp.displayCapacityLiters,
        Startvoorraad: fp.startStock,
      };
      fp.perDay.forEach((d, idx) => {
        const lbl = filteredByDay[idx]?.dayLabel ?? d.date;
        row[`${lbl} (vullen)`] = d.suggestedFill;
        row[`${lbl} (vraag)`] = d.expectedDemand;
      });
      row["Totaal vullen"] = fp.totalSuggestedFill;
      row["Totaal vraag"] = fp.totalExpectedDemand;
      return row;
    });

    const wsProd = XLSX.utils.json_to_sheet(
      productRows.length > 0 ? productRows : [{ Melding: "Geen producten in selectie." }]
    );
    XLSX.utils.book_append_sheet(wb, wsProd, "Per product");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Vulplanning_${loc}_${horizonDays}d_${dateStr}.xlsx`);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-1/3 mb-2" />
          <Skeleton className="h-4 w-1/2" />
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
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

  const grandTotalFill = filteredByDay.reduce((s, d) => s + d.totalSuggestedFill, 0);
  const grandTotalDemand = filteredByDay.reduce((s, d) => s + d.totalExpectedDemand, 0);
  const fillTotals = summarizeByUnit(filteredFillPlan, (f) => f.totalSuggestedFill);
  const demandTotals = summarizeByUnit(filteredFillPlan, (f) => f.totalExpectedDemand);
  const coveredTotals: UnitTotals = {
    cylinders: coveredByStock(demandTotals.cylinders, fillTotals.cylinders),
    bundles: coveredByStock(demandTotals.bundles, fillTotals.bundles),
    bundleCylinders: coveredByStock(demandTotals.bundleCylinders, fillTotals.bundleCylinders),
  };
  const periodLabel = dayRangeLabel(filteredByDay);
  const bufferLabel =
    safetyBuffer <= 0
      ? "geen buffer"
      : safetyBufferMode === "percent"
        ? `buffer ${safetyBuffer}%`
        : safetyBufferMode === "service_level"
          ? `servicegraad ${safetyBuffer}%`
          : `buffer ${safetyBuffer} per product`;
  const productsToFill = filteredFillPlan.filter((fp) => fp.totalSuggestedFill > 0).length;
  const activeDay = filteredByDay.find((d) => d.date === selectedDay) ?? filteredByDay[0];

  return (
    <div className="space-y-4 print-area fill-planning">
      {/* Print-only header */}
      <div className="hidden print:block mb-4 border-b pb-3">
        <h1 className="text-xl font-bold">
          Vulplanning — {loc} ({horizonDays} werkdagen)
        </h1>
        <p className="text-xs text-muted-foreground">
          Afgedrukt op {new Date().toLocaleString("nl-NL")} · Methode: {METHOD_LABELS[method].label} · Buffer:{" "}
          {safetyBuffer} {safetyBufferMode === "percent" ? "%" : "stuks"} · Type: {packageFilter}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-4 pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Factory className="w-4 h-4 text-primary" /> Te vullen ({horizonDays} werkdagen)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UnitSplit t={fillTotals} />
            <p className="text-xs text-muted-foreground mt-1">Advies om voorraad op peil te houden</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4 pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <TrendingDown className="w-4 h-4 text-primary" /> Verwachte vraag
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UnitSplit t={demandTotals} />
            <p className="text-xs text-muted-foreground mt-1">Voorspelde afname, geen bevestigde orders</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4 pb-1">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <CheckCircle2 className="w-4 h-4 text-primary" /> Gedekt door huidige voorraad
            </CardTitle>
          </CardHeader>
          <CardContent>
            <UnitSplit t={coveredTotals} />
            <p className="text-xs text-muted-foreground mt-1">
              Vraag min te vullen · {nl(productsToFill)} {productsToFill === 1 ? "product" : "producten"} met vulactie
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-4">
            <div>
              <CardTitle>
                Vulplanning komende {horizonDays === 5 ? "werkweek" : `${horizonDays} werkdagen`}
              </CardTitle>
              <CardDescription>
                {METHOD_LABELS[method].description}. Dit is een voorspelling; bijvullen wordt geadviseerd zodra de
                verwachte voorraad onder het bufferdoel zakt.
              </CardDescription>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {periodLabel && <Badge variant="secondary" className="font-normal">{periodLabel}</Badge>}
                <Badge variant="outline" className="font-normal">Locatie: {loc}</Badge>
                <Badge variant="outline" className="font-normal">Type: {packageFilter}</Badge>
                <Badge variant="outline" className="font-normal">{bufferLabel}</Badge>
                <Badge variant="outline" className="font-normal">{METHOD_LABELS[method].label.replace(" (aanbevolen)", "")}</Badge>
              </div>
              <details className="mt-3 text-xs text-muted-foreground print:hidden">
                <summary className="cursor-pointer font-medium text-foreground">Hoe lees ik deze cijfers?</summary>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  <li><b>Voorraad begin dag</b>: verwachte volle voorraad aan het begin van die dag. Op de eerste dag is dat de actuele voorraad.</li>
                  <li><b>Verwachte vraag</b>: voorspelde afname op die dag op basis van het verleden, geen bevestigde orders.</li>
                  <li><b>Tekort</b>: hoeveel er na de vraag onder het bufferdoel zou komen; dit verklaart het advies.</li>
                  <li><b>Bijvullen</b>: aantal te vullen op die dag. Bundels tellen apart; één bundel bevat meerdere cilinders.</li>
                  <li><b>Capaciteit</b>: waterinhoud per cilinder, of per bundel bij bundels.</li>
                </ul>
              </details>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0 print:hidden">
              <Button variant="outline" size="sm" onClick={handleExportExcel} className="gap-1.5">
                <Download className="w-4 h-4" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1.5">
                <Printer className="w-4 h-4" /> Printen
              </Button>
            </div>
          </div>

          {/* Primary filters row */}
          <div className="flex flex-col lg:flex-row flex-wrap gap-2 items-stretch lg:items-center justify-between pt-1 print:hidden">
            <div className="flex flex-col sm:flex-row flex-wrap gap-2 items-stretch sm:items-center">
              <div className="relative w-full sm:w-60">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek product of verpakking..."
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

              <Tabs
                value={packageFilter}
                onValueChange={(v) => setPackageFilter(v as PackageFilter)}
                className="w-full sm:w-auto"
              >
                <TabsList className="w-full">
                  <TabsTrigger value="Alle" className="flex-1">Alle types</TabsTrigger>
                  <TabsTrigger value="Cilinders" className="flex-1">Cilinders</TabsTrigger>
                  <TabsTrigger value="Bundels" className="flex-1">Bundels</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Tabs
              value={view}
              onValueChange={(v) => setView(v as "perDag" | "perProduct")}
              className="w-full sm:w-auto"
            >
              <TabsList className="w-full">
                <TabsTrigger value="perDag" className="flex-1">Per dag</TabsTrigger>
                <TabsTrigger value="perProduct" className="flex-1">Per product</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Planning parameters row: Horizon, Safety Buffer, Method */}
          <div className="flex flex-col md:flex-row flex-wrap items-stretch md:items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border/50 print:hidden">
            {/* Horizon */}
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Horizon:
              </Label>
              <Tabs
                value={String(horizonDays)}
                onValueChange={(v) => setHorizonDays(Number(v) as 5 | 10 | 15)}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="5" className="text-xs px-2.5 h-6">5 wkdgn</TabsTrigger>
                  <TabsTrigger value="10" className="text-xs px-2.5 h-6">10 wkdgn</TabsTrigger>
                  <TabsTrigger value="15" className="text-xs px-2.5 h-6">15 wkdgn</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Safety Buffer */}
            <div className="flex items-center gap-2">
              <Label htmlFor="safety-buffer" className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <Shield className="w-3.5 h-3.5" /> Buffer:
              </Label>
              {safetyBufferMode === "service_level" ? (
                <Select
                  value={String(safetyBuffer >= 90 ? safetyBuffer : 95)}
                  onValueChange={(v) => setSafetyBuffer(Number(v))}
                >
                  <SelectTrigger className="h-8 w-24 text-xs font-mono">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="90">90% (z=1,28)</SelectItem>
                    <SelectItem value="95">95% (z=1,65)</SelectItem>
                    <SelectItem value="99">99% (z=2,33)</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  id="safety-buffer"
                  type="number"
                  min={0}
                  max={500}
                  value={safetyBuffer}
                  onChange={(e) => setSafetyBuffer(Math.max(0, Number(e.target.value) || 0))}
                  className="w-20 h-8 text-xs font-mono"
                />
              )}
              <Tabs
                value={safetyBufferMode}
                onValueChange={(v) => {
                  const next = v as SafetyBufferMode;
                  setSafetyBufferMode(next);
                  if (next === "service_level") {
                    setSafetyBuffer(95);
                  } else if (safetyBufferMode === "service_level") {
                    setSafetyBuffer(0);
                  }
                }}
              >
                <TabsList className="h-8">
                  <TabsTrigger value="units" className="text-xs px-2 h-6">stuks</TabsTrigger>
                  <TabsTrigger value="percent" className="text-xs px-2 h-6">%</TabsTrigger>
                  <TabsTrigger value="service_level" className="text-xs px-2 h-6">Service</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            {/* Calculation Method */}
            <div className="flex items-center gap-2 md:ml-auto">
              <Label className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                <SlidersHorizontal className="w-3.5 h-3.5" /> Berekening:
              </Label>
              <Select value={method} onValueChange={(v) => setMethod(v as FillPlanMethod)}>
                <SelectTrigger className="h-8 w-full sm:w-72 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ewma_seasonal">{METHOD_LABELS.ewma_seasonal.label}</SelectItem>
                  <SelectItem value="hybrid">{METHOD_LABELS.hybrid.label}</SelectItem>
                  <SelectItem value="customer_interval">{METHOD_LABELS.customer_interval.label}</SelectItem>
                  <SelectItem value="weekday_avg">{METHOD_LABELS.weekday_avg.label}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {view === "perDag" ? (
            <PerDayView
              days={filteredByDay}
              selectedDay={activeDay?.date ?? ""}
              onSelectDay={setSelectedDay}
              showBufferColumn={safetyBuffer > 0}
              horizonDays={horizonDays}
            />
          ) : (
            <PerProductView
              items={filteredFillPlan}
              dayLabels={filteredByDay.map((d) => d.dayLabel)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function PerDayView({
  days,
  selectedDay,
  onSelectDay,
  showBufferColumn,
  horizonDays,
}: {
  days: FillPlanDay[];
  selectedDay: string;
  onSelectDay: (date: string) => void;
  showBufferColumn: boolean;
  horizonDays: number;
}) {
  const hasAny = days.some((d) => d.items.length > 0);
  if (!hasAny) {
    return (
      <div className="text-center py-10 text-muted-foreground flex flex-col items-center">
        <CheckCircle2 className="w-12 h-12 mb-2 text-emerald-500/60" />
        <p>Geen vulacties nodig in de komende {horizonDays} werkdagen voor deze selectie.</p>
      </div>
    );
  }

  return (
    <Tabs value={selectedDay} onValueChange={onSelectDay} className="w-full">
      <TabsList className="w-full grid grid-cols-5 h-auto gap-1 print:hidden">
        {days.map((d) => (
          <TabsTrigger key={d.date} value={d.date} className="flex flex-col py-2 gap-0.5">
            <span className="text-xs capitalize">{d.dayLabel}</span>
            <span
              className={cn(
                "text-[11px] tabular-nums",
                d.totalSuggestedFill > 0 ? "text-primary font-semibold" : "text-muted-foreground"
              )}
            >
              {d.totalSuggestedFill > 0 ? `+${nl(d.totalSuggestedFill)} te vullen` : "niets te vullen"}
            </span>
          </TabsTrigger>
        ))}
      </TabsList>
      {days.map((d) => (
        <TabsContent key={d.date} value={d.date} className="mt-4">
          <div className="hidden print:block font-semibold text-sm mb-2 capitalize">
            Dagplanning: {d.dayLabel} ({d.date}) — Totaal bijvullen: +{nl(d.totalSuggestedFill)} (cilinders en bundels samen)
          </div>
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
                    <TableHead>Verpakking</TableHead>
                    <TableHead>Locatie</TableHead>
                    <TableHead className="text-right">Capaciteit</TableHead>
                    <TableHead className="text-right">Voorraad begin dag</TableHead>
                    <TableHead className="text-right">Verwachte vraag</TableHead>
                    {showBufferColumn && <TableHead className="text-right">Bufferdoel</TableHead>}
                    <TableHead className="text-right">Tekort</TableHead>
                    <TableHead className="text-right">Bijvullen</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...d.items].sort((x, y) => y.suggestedFill - x.suggestedFill).map((it) => (
                    <TableRow key={`${it.product}_${it.packageType}_${it.location}_${it.capacityPerUnit}_${it.isBundle}`}>
                      <TableCell className="font-medium text-primary">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span>{it.product}</span>
                          {it.isBundle && (
                            <Badge variant="secondary" className="text-[10px] font-normal gap-1 px-1.5 py-0">
                              <Layers className="w-2.5 h-2.5" />
                              Bundel{it.packSize > 1 ? ` (${it.packSize}×)` : ""}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {it.packageType || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal text-muted-foreground bg-background">
                          <MapPin className="w-3 h-3 mr-1" /> {it.location}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {formatLiters(it.displayCapacityLiters)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {nl(it.projectedStockBefore)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {it.expectedDemand.toLocaleString("nl-NL")}
                      </TableCell>
                      {showBufferColumn && (
                        <TableCell className="text-right font-mono text-xs text-muted-foreground">
                          {it.safetyTarget.toLocaleString("nl-NL")}
                        </TableCell>
                      )}
                      <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                        {shortageAfterDemand(it) > 0 ? nl(shortageAfterDemand(it)) : "—"}
                      </TableCell>
                      <TableCell className="text-right font-bold tabular-nums">
                        <div>
                          +{nl(it.suggestedFill)}
                          <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                            {unitWord(it.isBundle, it.suggestedFill)}
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-end gap-4 px-4 py-2 text-sm border-t bg-muted/30 tabular-nums">
                <span className="text-muted-foreground">Totaal {d.dayLabel}:</span>
                {(() => {
                  const t = summarizeByUnit(d.items, (i) => i.suggestedFill);
                  return (
                    <span className="font-semibold">
                      +{nl(t.cylinders)} {unitWord(false, t.cylinders)}
                      {t.bundles > 0 && ` · +${nl(t.bundles)} ${unitWord(true, t.bundles)}`}
                    </span>
                  );
                })()}
              </div>
            </div>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}

function PerProductView({ items, dayLabels }: { items: FillPlanItem[]; dayLabels: string[] }) {
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
            <TableHead>Verpakking</TableHead>
            <TableHead>Locatie</TableHead>
            <TableHead className="text-right">Cap.</TableHead>
            <TableHead className="text-right">Start</TableHead>
            {dayLabels.map((lbl, i) => (
              <TableHead key={i} className="text-right capitalize">
                {lbl}
              </TableHead>
            ))}
            <TableHead className="text-right">Totaal vullen</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((fp) => (
            <TableRow
              key={`${fp.product}_${fp.packageType}_${fp.location}_${fp.capacityPerUnit}_${fp.isBundle}`}
              className={fp.totalSuggestedFill > 0 ? "" : "opacity-60"}
            >
              <TableCell className="font-medium text-primary sticky left-0 bg-background z-10">
                <div className="flex items-center gap-1.5">
                  <span>{fp.product}</span>
                  {fp.isBundle && (
                    <Badge variant="secondary" className="text-[10px] font-normal px-1.5 py-0">
                      Bundel
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                {fp.packageType || "—"}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="font-normal text-muted-foreground bg-background">
                  <MapPin className="w-3 h-3 mr-1" /> {fp.location}
                </Badge>
              </TableCell>
              <TableCell className="text-right font-mono text-xs text-muted-foreground">
                {formatLiters(fp.displayCapacityLiters)}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {fp.startStock.toLocaleString("nl-NL")}
              </TableCell>
              {fp.perDay.map((d, i) => (
                <TableCell key={i} className="text-right font-mono text-xs">
                  <div className="flex flex-col items-end leading-tight">
                    {d.suggestedFill > 0 ? (
                      <span className="font-bold">+{nl(d.suggestedFill)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                    <span
                      className={cn(
                        "text-[10px]",
                        d.expectedDemand > 0 ? "text-muted-foreground" : "text-muted-foreground/60"
                      )}
                    >
                      {d.expectedDemand > 0 ? `vraag ${nl(d.expectedDemand)}` : ""}
                    </span>
                  </div>
                </TableCell>
              ))}
              <TableCell className="text-right font-bold">
                {fp.totalSuggestedFill > 0 ? (
                  <span>+{nl(fp.totalSuggestedFill)} <span className="text-[10px] font-normal text-muted-foreground">{unitWord(fp.isBundle, fp.totalSuggestedFill)}</span></span>
                ) : (
                  <span className="text-emerald-600 inline-flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> OK
                  </span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
