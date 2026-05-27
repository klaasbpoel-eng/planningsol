import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TrendingUp, TrendingDown, Users, Flame, Container, ChevronDown, ChevronUp, ArrowUpDown, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn, formatNumber, normalizeDatum } from "@/lib/utils";
import { buildDigitalProductNames } from "@/lib/gasTypeUtils";
import { format, subYears, differenceInCalendarDays } from "date-fns";
import { nl } from "date-fns/locale";

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface YoYInsightsProps {
  location: ProductionLocation;
  refreshKey?: number;
  dateRange?: { from: Date; to: Date };
  year?: number;
  hideDigital?: boolean;
  hasDigitalTypes?: boolean;
}

interface Row {
  Datum: string;
  Locatie: string;
  Product: string;
  Capaciteit: number | string | null;
  Aantal: number;
  Klant: string;
}

interface DeltaRow {
  key: string;
  label: string;
  current: number;
  previous: number;
  delta: number;
  pct: number;
}

type SortMode = "pct" | "abs";

const MIN_VOLUME_DEFAULT = 50;

function bucketCapacity(cap: number | string | null | undefined): string {
  const n = Number(cap);
  if (!isFinite(n) || n <= 0) return "Onbekend";
  if (n <= 5) return "≤ 5L";
  if (n <= 10) return "10L";
  if (n <= 20) return "20L";
  if (n <= 50) return "50L";
  return `${n}L (bundel)`;
}

function buildDelta(
  curr: Map<string, number>,
  prev: Map<string, number>,
): DeltaRow[] {
  const keys = new Set<string>([...curr.keys(), ...prev.keys()]);
  const out: DeltaRow[] = [];
  for (const k of keys) {
    const c = curr.get(k) || 0;
    const p = prev.get(k) || 0;
    const d = c - p;
    const pct = p > 0 ? (d / p) * 100 : c > 0 ? 100 : 0;
    out.push({ key: k, label: k, current: c, previous: p, delta: d, pct });
  }
  return out;
}

export function YoYInsights({
  location,
  refreshKey = 0,
  dateRange,
  year,
  hideDigital = false,
  hasDigitalTypes = false,
}: YoYInsightsProps) {
  const [loading, setLoading] = useState(true);
  const [rowsCurrent, setRowsCurrent] = useState<Row[]>([]);
  const [rowsPrevious, setRowsPrevious] = useState<Row[]>([]);
  const [isExpanded, setIsExpanded] = useState(true);
  const [tab, setTab] = useState<"klanten" | "gas" | "capaciteit">("klanten");
  const [sortMode, setSortMode] = useState<SortMode>("abs");
  const [search, setSearch] = useState("");
  const [minVol, setMinVol] = useState<number>(MIN_VOLUME_DEFAULT);
  const [showAll, setShowAll] = useState(false);
  const [periodMode, setPeriodMode] = useState<"ytd" | "selection" | "full">(
    dateRange ? "selection" : "ytd",
  );

  // Switch to "selection" automatically when the page-level dateRange changes
  useEffect(() => {
    if (dateRange) setPeriodMode("selection");
  }, [dateRange?.from?.getTime(), dateRange?.to?.getTime()]);

  // Determine current period based on mode
  const today = new Date();
  const baseYear = year ?? today.getFullYear();
  let currentFrom: Date;
  let currentTo: Date;
  if (periodMode === "selection" && dateRange) {
    currentFrom = dateRange.from;
    currentTo = dateRange.to;
  } else if (periodMode === "full") {
    currentFrom = new Date(baseYear, 0, 1);
    currentTo = new Date(baseYear, 11, 31);
  } else {
    // YTD: 1 jan t/m vandaag
    currentFrom = new Date(baseYear, 0, 1);
    currentTo = today;
  }
  const prevFrom = subYears(currentFrom, 1);
  const prevTo = subYears(currentTo, 1);

  const fromDate = format(currentFrom, "yyyy-MM-dd");
  const toDate = format(currentTo, "yyyy-MM-dd");
  const prevFromDate = format(prevFrom, "yyyy-MM-dd");
  const prevToDate = format(prevTo, "yyyy-MM-dd");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const locationParam = location === "all" ? null : location;
        const digitalNames = hideDigital ? await buildDigitalProductNames() : new Set<string>();

        // Load gas_packages mapping for bundle expansion
        const { data: pkgRows } = await (supabase as any)
          .from("gas_packages")
          .select("bundle_capacity_liters, cylinders_per_pack, single_cylinder_liters, is_active");
        const pkgMap = new Map<number, { mult: number; unitCap: number }>();
        for (const p of pkgRows || []) {
          if (p.is_active === false) continue;
          const cap = Number(p.bundle_capacity_liters);
          const mult = Math.max(1, Number(p.cylinders_per_pack) || 1);
          const unitCap = Math.max(1, Number(p.single_cylinder_liters) || 50);
          if (cap > 0) pkgMap.set(cap, { mult, unitCap });
        }

        const fetchRange = async (f: string, t: string): Promise<Row[]> => {
          const fy = parseInt(f.substring(0, 4));
          const ty = parseInt(t.substring(0, 4));
          const years = Array.from({ length: ty - fy + 1 }, (_, i) => fy + i);
          const all: Row[] = [];
          for (const yr of years) {
            const PAGE = 1000;
            const { count } = await (supabase.from("Productie" as never) as any)
              .select("*", { count: "exact", head: true })
              .eq("Jaar", yr);
            const total = count || 0;
            if (!total) continue;
            const numPages = Math.ceil(total / PAGE);
            const results = await Promise.all(
              Array.from({ length: numPages }, (_, i) =>
                (supabase.from("Productie" as never) as any)
                  .select("Datum,Locatie,Product,Capaciteit,Aantal,Klant")
                  .eq("Jaar", yr)
                  .order("id")
                  .range(i * PAGE, (i + 1) * PAGE - 1),
              ),
            );
            for (const { data } of results) if (data) all.push(...(data as Row[]));
          }
          return all.filter((row) => {
            const iso = normalizeDatum(row.Datum);
            if (!iso || iso < f || iso > t) return false;
            if (locationParam) {
              const loc = row.Locatie?.toLowerCase().includes("emmen") ? "sol_emmen" : "sol_tilburg";
              if (loc !== locationParam) return false;
            }
            if (digitalNames.size > 0 && digitalNames.has(row.Product)) return false;
            return true;
          });
        };

        // Apply bundle expansion to capacity + quantity
        const expand = (rows: Row[]): Row[] =>
          rows.map((r) => {
            const rawCap = Number(r.Capaciteit);
            const aantal = Number(r.Aantal) || 0;
            const m = pkgMap.get(rawCap);
            if (!m) return { ...r, Aantal: aantal, Capaciteit: rawCap };
            return { ...r, Capaciteit: m.unitCap, Aantal: aantal * m.mult };
          });

        const [curr, prev] = await Promise.all([
          fetchRange(fromDate, toDate),
          fetchRange(prevFromDate, prevToDate),
        ]);
        if (cancelled) return;
        setRowsCurrent(expand(curr));
        setRowsPrevious(expand(prev));
      } catch (e) {
        console.error("[YoYInsights] fetch error", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, refreshKey, fromDate, toDate, hideDigital]);

  // Aggregations
  const agg = useMemo(() => {
    const groupBy = (rows: Row[], pick: (r: Row) => string) => {
      const m = new Map<string, number>();
      for (const r of rows) {
        const k = pick(r) || "Onbekend";
        m.set(k, (m.get(k) || 0) + (Number(r.Aantal) || 0));
      }
      return m;
    };
    return {
      klanten: {
        curr: groupBy(rowsCurrent, (r) => r.Klant),
        prev: groupBy(rowsPrevious, (r) => r.Klant),
      },
      gas: {
        curr: groupBy(rowsCurrent, (r) => r.Product),
        prev: groupBy(rowsPrevious, (r) => r.Product),
      },
      capaciteit: {
        curr: groupBy(rowsCurrent, (r) => bucketCapacity(r.Capaciteit)),
        prev: groupBy(rowsPrevious, (r) => bucketCapacity(r.Capaciteit)),
      },
    };
  }, [rowsCurrent, rowsPrevious]);

  const totals = useMemo(() => {
    const sum = (m: Map<string, number>) => Array.from(m.values()).reduce((a, b) => a + b, 0);
    const c = sum(agg.klanten.curr);
    const p = sum(agg.klanten.prev);
    return { c, p, delta: c - p, pct: p > 0 ? ((c - p) / p) * 100 : 0 };
  }, [agg]);

  const active = agg[tab];
  const deltas = useMemo(() => {
    const d = buildDelta(active.curr, active.prev);
    // For capacity tab keep all buckets; for others apply min volume filter
    const filtered = tab === "capaciteit"
      ? d
      : d.filter((row) => Math.max(row.current, row.previous) >= minVol);
    const searched = search
      ? filtered.filter((r) => r.label.toLowerCase().includes(search.toLowerCase()))
      : filtered;
    return searched;
  }, [active, tab, minVol, search]);

  const risers = useMemo(() => {
    const positive = deltas.filter((d) => d.delta > 0);
    return [...positive].sort((a, b) =>
      sortMode === "pct" ? b.pct - a.pct : b.delta - a.delta,
    );
  }, [deltas, sortMode]);

  const fallers = useMemo(() => {
    const negative = deltas.filter((d) => d.delta < 0);
    return [...negative].sort((a, b) =>
      sortMode === "pct" ? a.pct - b.pct : a.delta - b.delta,
    );
  }, [deltas, sortMode]);

  const periodDays = Math.max(1, differenceInCalendarDays(currentTo, currentFrom) + 1);
  const periodLabel = dateRange
    ? `${format(currentFrom, "d MMM yyyy", { locale: nl })} - ${format(currentTo, "d MMM yyyy", { locale: nl })}`
    : `${currentFrom.getFullYear()}`;
  const prevPeriodLabel = dateRange
    ? `${format(prevFrom, "d MMM yyyy", { locale: nl })} - ${format(prevTo, "d MMM yyyy", { locale: nl })}`
    : `${prevFrom.getFullYear()}`;

  const formatPct = (p: number) => {
    if (!isFinite(p)) return "—";
    if (p > 999) return ">+999%";
    if (p < -999) return "<-999%";
    return `${p >= 0 ? "+" : ""}${p.toFixed(0)}%`;
  };

  const renderRow = (r: DeltaRow, kind: "up" | "down") => {
    const positive = kind === "up";
    const maxBar = Math.max(r.current, r.previous, 1);
    return (
      <div
        key={r.key}
        className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm truncate">{r.label}</p>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
            <span>{formatNumber(r.previous, 0)}</span>
            <span>→</span>
            <span className="text-foreground font-medium">{formatNumber(r.current, 0)}</span>
          </div>
          <div className="mt-1.5 flex gap-1 h-1 rounded-full overflow-hidden bg-muted/40">
            <div
              className="bg-muted-foreground/40"
              style={{ width: `${(r.previous / maxBar) * 100}%` }}
            />
          </div>
          <div className="mt-1 flex gap-1 h-1.5 rounded-full overflow-hidden bg-muted/40">
            <div
              className={positive ? "bg-success" : "bg-destructive"}
              style={{ width: `${(r.current / maxBar) * 100}%` }}
            />
          </div>
        </div>
        <div className="text-right shrink-0">
          <Badge
            variant={positive ? "default" : "destructive"}
            className={cn(
              "text-xs font-semibold",
              positive && "bg-success text-success-foreground hover:bg-success/90",
            )}
          >
            {positive ? (
              <TrendingUp className="h-3 w-3 mr-1" />
            ) : (
              <TrendingDown className="h-3 w-3 mr-1" />
            )}
            {formatPct(r.pct)}
          </Badge>
          <p className={cn("text-[11px] mt-1", positive ? "text-success" : "text-destructive")}>
            {r.delta >= 0 ? "+" : ""}
            {formatNumber(r.delta, 0)}
          </p>
        </div>
      </div>
    );
  };

  const topN = showAll ? 1000 : 5;

  return (
    <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
      <Card className="glass-card overflow-hidden">
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-lg flex items-center gap-2 flex-wrap">
                  <ArrowUpDown className="h-5 w-5 text-primary" />
                  YoY Vergelijking
                  <Badge variant="outline" className="text-xs">
                    {periodLabel} vs {prevPeriodLabel}
                  </Badge>
                  {hideDigital && hasDigitalTypes && (
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0 border-sky-400/40 text-sky-500 bg-sky-400/10 font-normal"
                    >
                      Alleen fysiek
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Verschillen t.o.v. dezelfde periode vorig jaar — op klant, gassoort en capaciteit
                </CardDescription>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {!loading && (
                  <div className="text-right">
                    <p className="text-lg font-bold">
                      {formatNumber(totals.c, 0)}{" "}
                      <span className="text-xs text-muted-foreground font-normal">
                        vs {formatNumber(totals.p, 0)}
                      </span>
                    </p>
                    <Badge
                      variant={totals.delta >= 0 ? "default" : "destructive"}
                      className={cn(
                        "text-xs",
                        totals.delta >= 0 && "bg-success text-success-foreground hover:bg-success/90",
                      )}
                    >
                      {totals.delta >= 0 ? (
                        <TrendingUp className="h-3 w-3 mr-1" />
                      ) : (
                        <TrendingDown className="h-3 w-3 mr-1" />
                      )}
                      {formatPct(totals.pct)} ({totals.delta >= 0 ? "+" : ""}
                      {formatNumber(totals.delta, 0)})
                    </Badge>
                  </div>
                )}
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  {isExpanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <div className="flex flex-wrap items-center gap-3 justify-between">
                <TabsList className="bg-muted">
                  <TabsTrigger value="klanten" className="gap-2">
                    <Users className="h-4 w-4" />
                    Klanten
                  </TabsTrigger>
                  <TabsTrigger value="gas" className="gap-2">
                    <Flame className="h-4 w-4" />
                    Gassoort
                  </TabsTrigger>
                  <TabsTrigger value="capaciteit" className="gap-2">
                    <Container className="h-4 w-4" />
                    Capaciteit
                  </TabsTrigger>
                </TabsList>
                <div className="flex items-center gap-2 flex-wrap">
                  {tab !== "capaciteit" && (
                    <>
                      <div className="relative">
                        <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          value={search}
                          onChange={(e) => setSearch(e.target.value)}
                          placeholder="Zoek..."
                          className="h-8 w-40 pl-7 text-xs"
                        />
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span>Min:</span>
                        <Input
                          type="number"
                          value={minVol}
                          onChange={(e) => setMinVol(Math.max(0, Number(e.target.value) || 0))}
                          className="h-8 w-16 text-xs"
                        />
                      </div>
                    </>
                  )}
                  <div className="flex rounded-md border bg-muted/30 text-xs">
                    <button
                      type="button"
                      onClick={() => setSortMode("abs")}
                      className={cn(
                        "px-2 py-1 rounded-l-md transition-colors",
                        sortMode === "abs"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      Δ abs
                    </button>
                    <button
                      type="button"
                      onClick={() => setSortMode("pct")}
                      className={cn(
                        "px-2 py-1 rounded-r-md transition-colors",
                        sortMode === "pct"
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted",
                      )}
                    >
                      Δ %
                    </button>
                  </div>
                </div>
              </div>

              <TabsContent value={tab} className="mt-4">
                {loading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : deltas.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Geen vergelijkbare data in deze periode
                  </p>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingUp className="h-4 w-4 text-success" />
                        <h4 className="text-sm font-semibold">
                          Top stijgers{" "}
                          <span className="text-xs text-muted-foreground font-normal">
                            ({risers.length})
                          </span>
                        </h4>
                      </div>
                      {risers.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2">Geen stijgers</p>
                      ) : (
                        risers.slice(0, topN).map((r) => renderRow(r, "up"))
                      )}
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <TrendingDown className="h-4 w-4 text-destructive" />
                        <h4 className="text-sm font-semibold">
                          Top dalers{" "}
                          <span className="text-xs text-muted-foreground font-normal">
                            ({fallers.length})
                          </span>
                        </h4>
                      </div>
                      {fallers.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic py-2">Geen dalers</p>
                      ) : (
                        fallers.slice(0, topN).map((r) => renderRow(r, "down"))
                      )}
                    </div>
                  </div>
                )}

                {!loading && deltas.length > 10 && (
                  <div className="mt-3 text-center">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowAll((s) => !s)}
                    >
                      {showAll ? "Toon top 5" : `Toon alles (${deltas.length})`}
                    </Button>
                  </div>
                )}

                <p className="text-[11px] text-muted-foreground mt-3 italic">
                  Periode: {periodDays} dagen. Bundels worden uitgesplitst naar individuele
                  cilinders (bv. 800L = 16×50L).
                </p>
              </TabsContent>
            </Tabs>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}