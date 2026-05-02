import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DriverStat } from "@/hooks/useGasFlowPredictor";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, TrendingUp, CalendarDays, Package, Activity, Building2 } from "lucide-react";
import { format, subDays } from "date-fns";
import { nl } from "date-fns/locale";

const DAY_LABELS = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];
const DRIVER_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#f97316'];
const PERIODS = [30, 60, 90] as const;

// Geeft YYYY-MM-DD in lokale tijd (voorkomt UTC-verschuiving bij toISOString)
const localDateStr = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function monthLabel(key: string): string {
  try { return format(new Date(key + '-01'), "MMM ''yy", { locale: nl }); }
  catch { return key; }
}

function weekLabel(dateStr: string): string {
  try { return format(new Date(dateStr), 'd MMM', { locale: nl }); }
  catch { return dateStr; }
}

const numFmt = (v: number) => new Intl.NumberFormat('nl-NL').format(v);

// Heatmap color based on intensity (0–1 ratio)
function heatColor(ratio: number): string {
  if (ratio === 0) return '#f1f5f9';           // slate-100 — geen levering
  if (ratio < 0.25) return '#bfdbfe';          // blue-200
  if (ratio < 0.5)  return '#60a5fa';          // blue-400
  if (ratio < 0.75) return '#2563eb';          // blue-600
  return '#1e3a8a';                            // blue-900
}

// Build a calendar grid — 12-week rolling or full year if year is passed
function CalendarHeatmap({ days, maxCyl, year }: { days: DriverStat['recentDays']; maxCyl: number; year?: number | null }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let gridStart: Date;
  let gridEnd: Date;

  if (year) {
    // Full year: align start to the Monday of the week containing Jan 1
    gridStart = new Date(year, 0, 1);
    const dow = (gridStart.getDay() + 6) % 7; // Mon=0
    gridStart.setDate(gridStart.getDate() - dow);
    gridEnd = year === today.getFullYear() ? today : new Date(year, 11, 31);
  } else {
    // Last 12 weeks
    const todayDow = (today.getDay() + 6) % 7;
    const monday = new Date(today);
    monday.setDate(monday.getDate() - todayDow);
    gridStart = new Date(monday);
    gridStart.setDate(gridStart.getDate() - 11 * 7);
    gridEnd = today;
  }

  // Align gridEnd to Sunday so we always have complete weeks
  const endDow = (gridEnd.getDay() + 6) % 7;
  const alignedEnd = new Date(gridEnd);
  alignedEnd.setDate(alignedEnd.getDate() + (6 - endDow));

  const dayMap = new Map(days.map(d => [d.date, d]));

  // Build flat day list
  type DayCell = { date: string; cylinders: number; customers: number; future: boolean; outOfRange: boolean };
  const allDays: DayCell[] = [];
  const cur = new Date(gridStart);
  while (cur <= alignedEnd) {
    const dateStr = localDateStr(cur);
    const entry = dayMap.get(dateStr);
    allDays.push({
      date: dateStr,
      cylinders: entry?.cylinders ?? 0,
      customers: entry?.customers ?? 0,
      future: cur > today,
      outOfRange: cur > gridEnd,
    });
    cur.setDate(cur.getDate() + 1);
  }

  // Group into weeks of 7 days
  const weeks: DayCell[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex gap-px" style={{ minWidth: weeks.length * 16 }}>
        {/* Weekdag labels */}
        <div className="flex flex-col gap-px mr-1">
          {DAY_LABELS.map(l => (
            <div key={l} className="text-[9px] text-muted-foreground w-5 h-3.5 flex items-center justify-end pr-1 leading-none">{l}</div>
          ))}
        </div>
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-px">
            {week.map((day, di) => {
              const ratio = maxCyl > 0 ? day.cylinders / maxCyl : 0;
              const invisible = day.future || day.outOfRange;
              const color = invisible ? 'transparent' : heatColor(ratio);
              const title = invisible ? '' : `${day.date}: ${day.cylinders > 0 ? numFmt(day.cylinders) + ' st, ' + day.customers + ' klant(en)' : 'geen levering'}`;
              return (
                <div
                  key={di}
                  title={title}
                  className="w-3.5 h-3.5 rounded-[2px] cursor-default"
                  style={{ backgroundColor: color, border: invisible ? 'none' : '1px solid rgba(0,0,0,0.04)' }}
                />
              );
            })}
            {/* Month label at start of each month */}
            <div className="text-[8px] text-muted-foreground/50 h-3 leading-none truncate" style={{ width: 14 }}>
              {(week[0]?.date.slice(8) === '01' || wi === 0) && week[0]?.date
                ? format(new Date(week[0].date), 'MMM', { locale: nl })
                : ''}
            </div>
          </div>
        ))}
      </div>
      {/* Legenda */}
      <div className="flex items-center gap-1.5 mt-2">
        <span className="text-[9px] text-muted-foreground">Minder</span>
        {[0, 0.15, 0.4, 0.65, 0.9].map((r, i) => (
          <div key={i} className="w-3 h-3 rounded-[2px]" style={{ backgroundColor: heatColor(r), border: '1px solid rgba(0,0,0,0.06)' }} />
        ))}
        <span className="text-[9px] text-muted-foreground">Meer</span>
      </div>
    </div>
  );
}

export function GasFlowDriversTab({ data, isLoading, error }: { data: any; isLoading: boolean; error: any }) {
  const driverStats = useMemo(
    () => (!isLoading && !error ? (data?.driverStats || []) : []) as DriverStat[],
    [data, isLoading, error]
  );
  const depotTotalByYear = useMemo(
    () => (!isLoading && !error ? (data?.depotTotalByYear as Map<number, number> | undefined) : undefined),
    [data, isLoading, error]
  );

  const [selectedDriver, setSelectedDriver] = useState<string>("");
  const [dagPeriod, setDagPeriod] = useState<30 | 60 | 90>(30);
  const [disabledDrivers, setDisabledDrivers] = useState<Set<string>>(new Set());
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [excludeDepots, setExcludeDepots] = useState(false);

  const toggleDriver = (driver: string) => {
    setDisabledDrivers(prev => {
      const next = new Set(prev);
      if (next.has(driver)) next.delete(driver); else next.add(driver);
      return next;
    });
  };

  // Alleen zichtbare (niet-uitgeschakelde) chauffeurs voor statistieken
  const visibleStats = useMemo(
    () => driverStats.filter(d => !disabledDrivers.has(d.driver)),
    [driverStats, disabledDrivers]
  );

  const active = useMemo(() => {
    const target = selectedDriver || visibleStats[0]?.driver || "";
    return visibleStats.find(d => d.driver === target) ?? visibleStats[0] ?? null;
  }, [visibleStats, selectedDriver]);

  // Beschikbare jaren over alle zichtbare chauffeurs
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    visibleStats.forEach(d => d.perYear.forEach(py => years.add(py.year)));
    return Array.from(years).sort((a, b) => b - a); // nieuwste eerst
  }, [visibleStats]);

  // Reset selectedYear als het niet meer beschikbaar is
  const safeYear = availableYears.includes(selectedYear ?? -1) ? selectedYear : null;

  // Weergavedata voor de actieve chauffeur (jaar-specifiek of volledig)
  const activeDisplayData = useMemo(() => {
    if (!active) return null;
    if (safeYear !== null) {
      const py = active.perYear.find(py => py.year === safeYear);
      if (py) return { ...py, recentDays: py.allDays, driver: active.driver };
    }
    return active;
  }, [active, safeYear]);

  // KPI-bron: per-jaar aggregaten over zichtbare chauffeurs voor totaalkaarten + ranglijst
  // Depot-cilinders worden afgetrokken als excludeDepots actief is
  const kpiSource = useMemo(() => {
    return visibleStats.map(d => {
      if (safeYear !== null) {
        const py = d.perYear.find(py => py.year === safeYear);
        if (py) {
          const net = py.totalCylinders - (excludeDepots ? (py.totalDepotCylinders ?? 0) : 0);
          return { ...d, totalCylinders: net, avgCylindersPerDay: Math.round(net / py.totalDeliveryDays) };
        }
      }
      const net = d.totalCylinders - (excludeDepots ? d.totalDepotCylinders : 0);
      return { ...d, totalCylinders: net, avgCylindersPerDay: Math.round(net / d.totalDeliveryDays) };
    }).sort((a, b) => b.totalCylinders - a.totalCylinders);
  }, [visibleStats, safeYear, excludeDepots]);

  // Daily chart data — year mode: monthly bars; rolling mode: daily bars with zeros
  const dailyChartData = useMemo(() => {
    if (!activeDisplayData) return [];
    if (safeYear !== null) {
      // Year mode: use monthly totals for the selected year
      return activeDisplayData.monthlyTotals.map(m => ({
        date: m.month,
        label: monthLabel(m.month),
        Cilinders: m.cylinders,
        Klanten: 0,
      }));
    }
    // Rolling mode: fill zeros for days without delivery
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = subDays(today, dagPeriod - 1);
    const dayMap = new Map(activeDisplayData.recentDays.map(d => [d.date, d]));
    const result: { date: string; label: string; Cilinders: number; Klanten: number }[] = [];
    const cur = new Date(cutoff);
    while (cur <= today) {
      const dateStr = localDateStr(cur);
      const d = dayMap.get(dateStr);
      result.push({
        date: dateStr,
        label: format(cur, 'd/M'),
        Cilinders: d?.cylinders ?? 0,
        Klanten: d?.customers ?? 0,
      });
      cur.setDate(cur.getDate() + 1);
    }
    return result;
  }, [activeDisplayData, dagPeriod, safeYear]);

  // Heatmap max for color scaling
  const heatmapMax = useMemo(() =>
    activeDisplayData ? Math.max(1, ...activeDisplayData.recentDays.map(d => d.cylinders)) : 1,
    [activeDisplayData]
  );

  // Weekly chart data
  const weeklyChartData = useMemo(() => {
    if (!activeDisplayData) return [];
    return activeDisplayData.weeklyTotals.map(w => ({
      ...w,
      label: weekLabel(w.week),
      fullLabel: `Week van ${format(new Date(w.week), 'd MMM yyyy', { locale: nl })}`,
    }));
  }, [activeDisplayData]);

  const dotwData = activeDisplayData
    ? DAY_LABELS.map((day, i) => ({ day, Cilinders: activeDisplayData.dayOfWeekTotals[i] ?? 0 }))
    : [];

  const rankingData = kpiSource.map((d, i) => ({
    name: d.driver.length > 20 ? d.driver.substring(0, 20) + '…' : d.driver,
    fullName: d.driver,
    Cilinders: d.totalCylinders,
    colorIdx: i,
  }));

  const yearLabel = safeYear !== null ? `${safeYear}` : 'laatste 12 maanden';

  if (isLoading) {
    return (
      <Card>
        <CardContent className="pt-6 space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  if (error) return <div className="text-red-500 text-sm">Fout bij laden chauffeurstatistieken.</div>;

  if (driverStats.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 flex flex-col items-center text-muted-foreground">
          <Users className="w-10 h-10 mb-2 opacity-40" />
          <p>Geen chauffeurdata beschikbaar (controleer Username-veld in Afname).</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Chauffeur + jaar filter */}
      <Card className="bg-muted/30">
        <CardHeader className="py-3 pb-2">
          <div className="flex items-center justify-between gap-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-muted-foreground" />
              Filters
              {disabledDrivers.size > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {visibleStats.length}/{driverStats.length} chauffeurs
                </Badge>
              )}
              {safeYear !== null && (
                <Badge variant="secondary" className="text-xs">
                  {safeYear}
                </Badge>
              )}
              {excludeDepots && (
                <Badge variant="secondary" className="text-xs bg-orange-100 text-orange-700 border-orange-200">
                  excl. depot
                </Badge>
              )}
            </CardTitle>
            {disabledDrivers.size > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => setDisabledDrivers(new Set())}>
                Alles tonen
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pb-3 pt-0 space-y-3">
          {/* Chauffeur chips */}
          <div className="flex flex-wrap gap-2">
            {driverStats.map((d, i) => {
              const isDisabled = disabledDrivers.has(d.driver);
              return (
                <button
                  key={d.driver}
                  onClick={() => toggleDriver(d.driver)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    isDisabled
                      ? 'bg-muted text-muted-foreground border-border opacity-50 line-through'
                      : 'bg-background border-border hover:border-primary/50 shadow-sm'
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: isDisabled ? '#94a3b8' : DRIVER_COLORS[i % DRIVER_COLORS.length] }}
                  />
                  {d.driver}
                </button>
              );
            })}
          </div>
          {/* Depot leveringen filter */}
          {(() => {
            // Gebruik de globale depot-teller (telt ook rijen zonder chauffeur)
            let totalDepotCyls: number;
            if (depotTotalByYear) {
              if (safeYear !== null) {
                totalDepotCyls = depotTotalByYear.get(safeYear) ?? 0;
              } else {
                totalDepotCyls = Array.from(depotTotalByYear.values()).reduce((s, v) => s + v, 0);
              }
            } else {
              // Fallback: som van chauffeur-specifieke depot-totalen
              totalDepotCyls = visibleStats.reduce((s, d) => {
                if (safeYear !== null) {
                  const py = d.perYear.find(py => py.year === safeYear);
                  return s + (py?.totalDepotCylinders ?? 0);
                }
                return s + d.totalDepotCylinders;
              }, 0);
            }
            return (
              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground shrink-0">Depots:</span>
                <button
                  onClick={() => setExcludeDepots(v => !v)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    excludeDepots
                      ? 'bg-orange-500 text-white border-orange-500'
                      : 'bg-background border-border hover:border-orange-400'
                  }`}
                >
                  <Building2 className="w-3 h-3" />
                  {excludeDepots ? 'Depot-leveringen uitgesloten' : 'Depot-leveringen inbegrepen'}
                </button>
                {totalDepotCyls > 0 && (
                  <span className="text-[10px] text-muted-foreground">
                    {excludeDepots ? `−${numFmt(totalDepotCyls)} st depot` : `${numFmt(totalDepotCyls)} st depot in totaal`}
                  </span>
                )}
              </div>
            );
          })()}

          {/* Jaar filter — alleen tonen als er meer dan 1 jaar beschikbaar is */}
          {availableYears.length > 1 && (
            <div className="flex items-center gap-2 pt-1">
              <span className="text-xs text-muted-foreground shrink-0">Jaar:</span>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedYear(null)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                    safeYear === null
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background border-border hover:border-primary/50'
                  }`}
                >
                  Alle jaren
                </button>
                {availableYears.map(year => (
                  <button
                    key={year}
                    onClick={() => setSelectedYear(year)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
                      safeYear === year
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-background border-border hover:border-primary/50'
                    }`}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-blue-500/5 border-blue-500/20">
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-blue-600 text-xs flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Actieve Chauffeurs</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-bold text-blue-700">{kpiSource.length}</div>
            {disabledDrivers.size > 0 && <div className="text-[10px] text-muted-foreground">van {driverStats.length} totaal</div>}
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/20">
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-green-600 text-xs flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" />
              {safeYear !== null ? `Totaal Cilinders (${safeYear})` : 'Totaal Cilinders (alles)'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-bold text-green-700">{numFmt(kpiSource.reduce((s, d) => s + d.totalCylinders, 0))}</div>
          </CardContent>
        </Card>
        <Card className="bg-purple-500/5 border-purple-500/20">
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-purple-600 text-xs flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> Gem. per Rijdag</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-2xl font-bold text-purple-700">
              {kpiSource.length > 0 ? numFmt(Math.round(kpiSource.reduce((s, d) => s + d.avgCylindersPerDay, 0) / kpiSource.length)) : '—'}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-orange-500/5 border-orange-500/20">
          <CardHeader className="py-3 pb-1">
            <CardTitle className="text-orange-600 text-xs flex items-center gap-1"><Package className="w-3.5 h-3.5" /> Drukste Chauffeur</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <div className="text-sm font-bold text-orange-700 truncate">{kpiSource[0]?.driver ?? '—'}</div>
            <div className="text-xs text-orange-600/70">{numFmt(kpiSource[0]?.totalCylinders ?? 0)} st</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Ranking chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ranglijst — Cilinders per Chauffeur</CardTitle>
            <CardDescription>Totaal {yearLabel}</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ height: Math.max(200, kpiSource.length * 42) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={rankingData} margin={{ top: 4, right: 40, left: 8, bottom: 4 }} barCategoryGap="20%">
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} horizontal={false} />
                  <XAxis type="number" tickFormatter={numFmt} tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} tickLine={false} />
                  <Tooltip
                    formatter={(v: number) => [numFmt(v) + ' st', 'Cilinders']}
                    labelFormatter={(_l, payload) => payload?.[0]?.payload?.fullName ?? _l}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }}
                  />
                  <Bar dataKey="Cilinders" radius={[0, 4, 4, 0]}>
                    {rankingData.map((entry, i) => (
                      <Cell key={i} fill={DRIVER_COLORS[i % DRIVER_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Driver detail panel */}
        <div className="space-y-4">
          {/* Driver selector */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
              <CardTitle className="text-base">Detail per Chauffeur</CardTitle>
              <Select value={active?.driver ?? ""} onValueChange={setSelectedDriver}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue placeholder="Kies chauffeur" />
                </SelectTrigger>
                <SelectContent>
                  {visibleStats.map(d => (
                    <SelectItem key={d.driver} value={d.driver}>{d.driver}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            {activeDisplayData && (
              <CardContent className="space-y-1 pt-0">
                <div className="flex flex-wrap gap-2 text-xs">
                  <Badge variant="outline">{numFmt(activeDisplayData.totalCylinders)} st totaal</Badge>
                  <Badge variant="outline">{activeDisplayData.totalDeliveryDays} rijdagen</Badge>
                  <Badge variant="outline">~{Math.round(activeDisplayData.avgCylindersPerDay)} st/dag</Badge>
                  <Badge variant="outline">{activeDisplayData.uniqueCustomers} klanten</Badge>
                  <Badge variant="secondary">Laatste rit: {format(activeDisplayData.lastDeliveryDate, 'dd MMM yyyy', { locale: nl })}</Badge>
                </div>
              </CardContent>
            )}
          </Card>

          {/* Monthly trend */}
          {activeDisplayData && (
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">
                  {safeYear !== null ? `Maandelijks Overzicht — ${safeYear}` : 'Maandelijkse Trend (6 maanden)'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ height: 160 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={activeDisplayData.monthlyTotals.map(m => ({ ...m, label: monthLabel(m.month) }))} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="25%">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={numFmt} tick={{ fontSize: 10 }} width={40} />
                      <Tooltip formatter={(v: number) => [numFmt(v) + ' st', 'Cilinders']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="cylinders" name="Cilinders" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Day-of-week pattern */}
          {activeDisplayData && (
            <Card>
              <CardHeader className="pb-1">
                <CardTitle className="text-sm">Rijpatroon — Dag van de Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div style={{ height: 140 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dotwData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                      <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                      <YAxis tickFormatter={numFmt} tick={{ fontSize: 10 }} width={40} />
                      <Tooltip formatter={(v: number) => [numFmt(v) + ' st', 'Cilinders']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                      <Bar dataKey="Cilinders" fill="#10b981" radius={[4, 4, 0, 0]}>
                        {dotwData.map((entry, i) => (
                          <Cell key={i} fill={entry.Cilinders === Math.max(...dotwData.map(d => d.Cilinders)) ? '#10b981' : '#d1fae5'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* ── DAG STATISTIEKEN ── */}
      {activeDisplayData && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 pt-2">
            <Activity className="w-4 h-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">
              {safeYear !== null ? `Jaar Overzicht ${safeYear}` : 'Dag Statistieken'} — {activeDisplayData.driver}
            </h3>
          </div>

          {/* Activiteitskalender heatmap */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">
                {safeYear !== null ? `Activiteitskalender ${safeYear}` : 'Activiteitskalender (12 weken)'}
              </CardTitle>
              <CardDescription className="text-xs">Kleur = aantal geleverde cilinders per dag. Hover voor details.</CardDescription>
            </CardHeader>
            <CardContent>
              <CalendarHeatmap days={activeDisplayData.recentDays} maxCyl={heatmapMax} year={safeYear} />
            </CardContent>
          </Card>

          {/* Dagelijkse tijdlijn + weekoverzicht side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            {/* Dagelijkse tijdlijn (rolling) of maandoverzicht (jaar) — 3/5 width */}
            <Card className="lg:col-span-3">
              <CardHeader className="pb-2 flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-sm">
                    {safeYear !== null ? `Maandoverzicht ${safeYear}` : 'Dagelijkse Tijdlijn'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {safeYear !== null ? 'Cilinders per maand' : 'Cilinders per kalenderdag incl. niet-rijdagen'}
                  </CardDescription>
                </div>
                {safeYear === null && (
                  <div className="flex gap-1 shrink-0">
                    {PERIODS.map(p => (
                      <Button
                        key={p}
                        variant={dagPeriod === p ? "default" : "outline"}
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => setDagPeriod(p)}
                      >
                        {p}d
                      </Button>
                    ))}
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dailyChartData}
                      margin={{ top: 4, right: 8, left: 0, bottom: 4 }}
                      barCategoryGap={safeYear !== null ? "25%" : "10%"}
                    >
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} vertical={false} />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: safeYear !== null ? 11 : 9 }}
                        interval={safeYear !== null ? 0 : (dagPeriod === 30 ? 6 : dagPeriod === 60 ? 13 : 20)}
                        tickLine={false}
                      />
                      <YAxis tickFormatter={numFmt} tick={{ fontSize: 10 }} width={36} />
                      <Tooltip
                        formatter={(v: number, name: string) => [numFmt(v) + (name === 'Cilinders' ? ' st' : ' klanten'), name]}
                        labelFormatter={(label, payload) => payload?.[0]?.payload?.date ?? label}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 11 }}
                      />
                      <Bar dataKey="Cilinders" radius={[2, 2, 0, 0]}>
                        {dailyChartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={entry.Cilinders > 0 ? '#3b82f6' : '#e2e8f0'}
                            opacity={entry.Cilinders > 0 ? 1 : 0.4}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Stats row */}
                <div className="flex gap-4 mt-2 pt-2 border-t">
                  {(() => {
                    const activeDays = dailyChartData.filter(d => d.Cilinders > 0);
                    const total = activeDays.reduce((s, d) => s + d.Cilinders, 0);
                    const max = activeDays.length > 0 ? Math.max(...activeDays.map(d => d.Cilinders)) : 0;
                    const maxDay = dailyChartData.find(d => d.Cilinders === max);
                    return (
                      <>
                        <div className="text-xs">
                          <div className="text-muted-foreground">{safeYear !== null ? 'Maanden' : 'Rijdagen'}</div>
                          <div className="font-semibold">{safeYear !== null ? `${activeDays.length} / 12` : `${activeDays.length} / ${dagPeriod}`}</div>
                        </div>
                        <div className="text-xs">
                          <div className="text-muted-foreground">Totaal</div>
                          <div className="font-semibold">{numFmt(total)} st</div>
                        </div>
                        <div className="text-xs">
                          <div className="text-muted-foreground">{safeYear !== null ? 'Gem./maand' : 'Gem./rijdag'}</div>
                          <div className="font-semibold">{activeDays.length > 0 ? numFmt(Math.round(total / activeDays.length)) : '—'} st</div>
                        </div>
                        <div className="text-xs">
                          <div className="text-muted-foreground">{safeYear !== null ? 'Drukste maand' : 'Drukste dag'}</div>
                          <div className="font-semibold">{max > 0 ? `${numFmt(max)} st (${maxDay?.date ?? ''})` : '—'}</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>

            {/* Weekoverzicht — 2/5 width */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Weekoverzicht {safeYear !== null ? safeYear : '(12 weken)'}</CardTitle>
                <CardDescription className="text-xs">Totaal cilinders per werkweek</CardDescription>
              </CardHeader>
              <CardContent>
                <div style={{ height: 180 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={weeklyChartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }} barCategoryGap="20%">
                      <CartesianGrid strokeDasharray="3 3" opacity={0.3} vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} interval={safeYear !== null ? Math.floor(weeklyChartData.length / 8) : 1} />
                      <YAxis tickFormatter={numFmt} tick={{ fontSize: 10 }} width={36} />
                      <Tooltip
                        formatter={(v: number, name: string) => [numFmt(v) + (name === 'cylinders' ? ' st' : ' dagen'), name === 'cylinders' ? 'Cilinders' : 'Rijdagen']}
                        labelFormatter={(_l, payload) => payload?.[0]?.payload?.fullLabel ?? _l}
                        contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 11 }}
                      />
                      <Bar dataKey="cylinders" name="cylinders" radius={[3, 3, 0, 0]}>
                        {weeklyChartData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={i === weeklyChartData.length - 1 ? '#8b5cf6' : '#a78bfa'}
                            opacity={0.85 + (i / weeklyChartData.length) * 0.15}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                {/* Rijdagen per week mini stat */}
                <div className="mt-2 pt-2 border-t flex gap-4 text-xs">
                  {(() => {
                    const avgDays = weeklyChartData.length > 0
                      ? (weeklyChartData.reduce((s, w) => s + w.days, 0) / weeklyChartData.length).toFixed(1)
                      : '—';
                    const maxW = weeklyChartData.length > 0 ? Math.max(...weeklyChartData.map(w => w.cylinders)) : 0;
                    return (
                      <>
                        <div>
                          <div className="text-muted-foreground">Gem. rijdagen/week</div>
                          <div className="font-semibold">{avgDays}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Drukste week</div>
                          <div className="font-semibold">{numFmt(maxW)} st</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Top products & customers */}
      {activeDisplayData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top 5 Producten</CardTitle>
              <CardDescription className="text-xs">{activeDisplayData.driver} — {yearLabel}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeDisplayData.topProducts.map((p, i) => {
                const pct = activeDisplayData.totalCylinders > 0 ? Math.round((p.total / activeDisplayData.totalCylinders) * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" title={p.product}>{p.product}</div>
                      <div className="h-1.5 bg-muted rounded-full mt-0.5">
                        <div className="h-full rounded-full bg-blue-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">{numFmt(p.total)} st ({pct}%)</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Top 5 Klanten</CardTitle>
              <CardDescription className="text-xs">{activeDisplayData.driver} — meeste cilinders afgenomen</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {activeDisplayData.topCustomers.map((c, i) => {
                const pct = activeDisplayData.totalCylinders > 0 ? Math.round((c.total / activeDisplayData.totalCylinders) * 100) : 0;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="text-xs text-muted-foreground w-4 shrink-0">{i + 1}.</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium truncate" title={c.customer}>{c.customer}</div>
                      <div className="h-1.5 bg-muted rounded-full mt-0.5">
                        <div className="h-full rounded-full bg-green-400" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground shrink-0">{numFmt(c.total)} st ({pct}%)</div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
