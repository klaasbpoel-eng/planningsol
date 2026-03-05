import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  FileSpreadsheet,
  FileText,
  Building2,
  Cylinder,
  Snowflake,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  Loader2,
  CalendarIcon,
  Gauge,
  BarChart3,
  Ruler,
  Settings2,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { nl } from "date-fns/locale";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { exportToExcel, exportToPDF } from "@/lib/export-utils";

interface MonthlyReportProps {
  hideDigital?: boolean;
}

interface GasTypeItem {
  name: string;
  color: string;
  count: number;
}

interface SizeItem {
  size: string;
  count: number;
}

interface LocationKPI {
  location: string;
  label: string;
  totalCylinders: number;
  cylinderOrders: number;
  completedCylinders: number;
  efficiencyRate: number;
  avgCylindersPerOrder: number;
  totalDryIceKg: number;
  dryIceOrders: number;
  topCustomers: { name: string; cylinders: number; dryIceKg: number }[];
  gasTypeDistribution: GasTypeItem[];
  sizeDistribution: SizeItem[];
}

interface SectionToggles {
  cylinders: boolean;
  efficiency: boolean;
  avgPerOrder: boolean;
  gasTypes: boolean;
  sizeDistribution: boolean;
  dryIce: boolean;
  topCustomers: boolean;
}

const DEFAULT_TOGGLES: SectionToggles = {
  cylinders: true,
  efficiency: true,
  avgPerOrder: true,
  gasTypes: true,
  sizeDistribution: true,
  dryIce: true,
  topCustomers: true,
};

const TOGGLE_CONFIG: { key: keyof SectionToggles; label: string; icon: React.ReactNode }[] = [
  { key: "cylinders", label: "Cilinders", icon: <Cylinder className="h-3 w-3" /> },
  { key: "efficiency", label: "Efficiëntie", icon: <Gauge className="h-3 w-3" /> },
  { key: "avgPerOrder", label: "Gem. per order", icon: <BarChart3 className="h-3 w-3" /> },
  { key: "gasTypes", label: "Gassoorten", icon: <BarChart3 className="h-3 w-3" /> },
  { key: "sizeDistribution", label: "Grootteverdeling", icon: <Ruler className="h-3 w-3" /> },
  { key: "dryIce", label: "Droogijs", icon: <Snowflake className="h-3 w-3" /> },
  { key: "topCustomers", label: "Top 5 klanten", icon: <Users className="h-3 w-3" /> },
];

export function MonthlyReport({ hideDigital = false }: MonthlyReportProps) {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return format(now, "yyyy-MM");
  });
  const [toggles, setToggles] = useState<SectionToggles>(DEFAULT_TOGGLES);
  const [showSettings, setShowSettings] = useState(false);
  const [trendMode, setTrendMode] = useState<"prev_month" | "prev_year">("prev_month");

  const [emmenData, setEmmenData] = useState<LocationKPI | null>(null);
  const [tilburgData, setTilburgData] = useState<LocationKPI | null>(null);
  const [prevEmmenData, setPrevEmmenData] = useState<LocationKPI | null>(null);
  const [prevTilburgData, setPrevTilburgData] = useState<LocationKPI | null>(null);
  const [exporting, setExporting] = useState(false);

  const monthDate = useMemo(() => new Date(selectedMonth + "-01"), [selectedMonth]);
  const fromDate = useMemo(() => format(startOfMonth(monthDate), "yyyy-MM-dd"), [monthDate]);
  const toDate = useMemo(() => format(endOfMonth(monthDate), "yyyy-MM-dd"), [monthDate]);
  const prevMonthDate = useMemo(() => subMonths(monthDate, trendMode === "prev_year" ? 12 : 1), [monthDate, trendMode]);
  const prevFromDate = useMemo(() => format(startOfMonth(prevMonthDate), "yyyy-MM-dd"), [prevMonthDate]);
  const prevToDate = useMemo(() => format(endOfMonth(prevMonthDate), "yyyy-MM-dd"), [prevMonthDate]);

  const monthOptions = useMemo(() => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = subMonths(now, i);
      options.push({
        value: format(d, "yyyy-MM"),
        label: format(d, "MMMM yyyy", { locale: nl }),
      });
    }
    return options;
  }, []);

  const fetchSizeDistribution = async (from: string, to: string, location: string): Promise<SizeItem[]> => {
    const { data, error } = await supabase
      .from("gas_cylinder_orders")
      .select("cylinder_size, cylinder_count")
      .gte("scheduled_date", from)
      .lte("scheduled_date", to)
      .eq("location", location as any)
      .neq("status", "cancelled");

    if (error || !data) return [];

    const sizeMap = new Map<string, number>();
    data.forEach((row: any) => {
      const size = row.cylinder_size || "medium";
      sizeMap.set(size, (sizeMap.get(size) || 0) + (Number(row.cylinder_count) || 0));
    });

    return Array.from(sizeMap.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => b.count - a.count);
  };

  const fetchLocationData = async (
    location: string,
    label: string,
    from: string,
    to: string,
  ): Promise<LocationKPI> => {
    const [effRes, dryIceEffRes, customerRes, gasTypeRes, sizeRes] = await Promise.all([
      api.reports.getProductionEfficiency(from, to, location, hideDigital).catch(() => []),
      api.reports.getDryIceEfficiency(from, to, location).catch(() => []),
      api.reports.getCustomerTotals(from, to, location, hideDigital).catch(() => []),
      api.reports.getGasTypeDistribution(from, to, location, hideDigital).catch(() => []),
      fetchSizeDistribution(from, to, location),
    ]);

    const eff = (effRes as any)?.[0] || {};
    const dryIceEff = (dryIceEffRes as any)?.[0] || {};
    const customers = ((customerRes as any) || [])
      .sort((a: any, b: any) => (b.total_cylinders || 0) - (a.total_cylinders || 0))
      .slice(0, 5)
      .map((c: any) => ({
        name: c.customer_name || "Onbekend",
        cylinders: Number(c.total_cylinders) || 0,
        dryIceKg: Number(c.total_dry_ice_kg) || 0,
      }));

    const gasTypes = ((gasTypeRes as any) || [])
      .slice(0, 5)
      .map((g: any) => ({
        name: g.gas_type_name || "Onbekend",
        color: g.gas_type_color || "#3b82f6",
        count: Number(g.total_cylinders) || 0,
      }));

    const totalCyl = Number(eff.total_cylinders) || 0;
    const cylOrders = Number(eff.total_orders) || 0;

    return {
      location,
      label,
      totalCylinders: totalCyl,
      cylinderOrders: cylOrders,
      completedCylinders: Number(eff.completed_cylinders) || 0,
      efficiencyRate: Number(eff.efficiency_rate) || 0,
      avgCylindersPerOrder: cylOrders > 0 ? Math.round((totalCyl / cylOrders) * 10) / 10 : 0,
      totalDryIceKg: Number(dryIceEff.total_kg) || 0,
      dryIceOrders: Number(dryIceEff.total_orders) || 0,
      topCustomers: customers,
      gasTypeDistribution: gasTypes,
      sizeDistribution: sizeRes,
    };
  };

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [emmen, tilburg, prevEmmen, prevTilburg] = await Promise.all([
          fetchLocationData("sol_emmen", "SOL Emmen", fromDate, toDate),
          fetchLocationData("sol_tilburg", "SOL Tilburg", fromDate, toDate),
          fetchLocationData("sol_emmen", "SOL Emmen", prevFromDate, prevToDate),
          fetchLocationData("sol_tilburg", "SOL Tilburg", prevFromDate, prevToDate),
        ]);
        setEmmenData(emmen);
        setTilburgData(tilburg);
        setPrevEmmenData(prevEmmen);
        setPrevTilburgData(prevTilburg);
      } catch (err) {
        console.error("Error loading monthly report:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fromDate, toDate, prevFromDate, prevToDate, hideDigital]);

  const totalData = useMemo((): LocationKPI | null => {
    if (!emmenData || !tilburgData) return null;
    const customerMap = new Map<string, { cylinders: number; dryIceKg: number }>();
    [...emmenData.topCustomers, ...tilburgData.topCustomers].forEach((c) => {
      const existing = customerMap.get(c.name) || { cylinders: 0, dryIceKg: 0 };
      customerMap.set(c.name, {
        cylinders: existing.cylinders + c.cylinders,
        dryIceKg: existing.dryIceKg + c.dryIceKg,
      });
    });
    const mergedCustomers = Array.from(customerMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.cylinders - a.cylinders)
      .slice(0, 5);

    // Merge gas type distribution
    const gasMap = new Map<string, { color: string; count: number }>();
    [...emmenData.gasTypeDistribution, ...tilburgData.gasTypeDistribution].forEach((g) => {
      const existing = gasMap.get(g.name) || { color: g.color, count: 0 };
      gasMap.set(g.name, { color: existing.color, count: existing.count + g.count });
    });
    const mergedGas = Array.from(gasMap.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Merge size distribution
    const sizeMap = new Map<string, number>();
    [...emmenData.sizeDistribution, ...tilburgData.sizeDistribution].forEach((s) => {
      sizeMap.set(s.size, (sizeMap.get(s.size) || 0) + s.count);
    });
    const mergedSizes = Array.from(sizeMap.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => b.count - a.count);

    const totalCyl = emmenData.totalCylinders + tilburgData.totalCylinders;
    const totalOrders = emmenData.cylinderOrders + tilburgData.cylinderOrders;

    return {
      location: "all",
      label: "Totaal",
      totalCylinders: totalCyl,
      cylinderOrders: totalOrders,
      completedCylinders: emmenData.completedCylinders + tilburgData.completedCylinders,
      efficiencyRate: Math.round(
        ((emmenData.completedCylinders + tilburgData.completedCylinders) /
          Math.max(totalCyl, 1)) * 100
      ),
      avgCylindersPerOrder: totalOrders > 0 ? Math.round((totalCyl / totalOrders) * 10) / 10 : 0,
      totalDryIceKg: emmenData.totalDryIceKg + tilburgData.totalDryIceKg,
      dryIceOrders: emmenData.dryIceOrders + tilburgData.dryIceOrders,
      topCustomers: mergedCustomers,
      gasTypeDistribution: mergedGas,
      sizeDistribution: mergedSizes,
    };
  }, [emmenData, tilburgData]);

  const prevTotalData = useMemo((): LocationKPI | null => {
    if (!prevEmmenData || !prevTilburgData) return null;
    const totalCyl = prevEmmenData.totalCylinders + prevTilburgData.totalCylinders;
    const totalOrders = prevEmmenData.cylinderOrders + prevTilburgData.cylinderOrders;
    return {
      location: "all",
      label: "Totaal",
      totalCylinders: totalCyl,
      cylinderOrders: totalOrders,
      completedCylinders: prevEmmenData.completedCylinders + prevTilburgData.completedCylinders,
      efficiencyRate: 0,
      avgCylindersPerOrder: totalOrders > 0 ? Math.round((totalCyl / totalOrders) * 10) / 10 : 0,
      totalDryIceKg: prevEmmenData.totalDryIceKg + prevTilburgData.totalDryIceKg,
      dryIceOrders: prevEmmenData.dryIceOrders + prevTilburgData.dryIceOrders,
      topCustomers: [],
      gasTypeDistribution: [],
      sizeDistribution: [],
    };
  }, [prevEmmenData, prevTilburgData]);

  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const TrendBadge = ({ current, previous }: { current: number; previous: number }) => {
    const trend = calcTrend(current, previous);
    if (trend === 0) return <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><Minus className="h-3 w-3" />0%</span>;
    if (trend > 0) return <span className="inline-flex items-center gap-0.5 text-[11px] text-green-600"><TrendingUp className="h-3 w-3" />+{trend}%</span>;
    return <span className="inline-flex items-center gap-0.5 text-[11px] text-red-500"><TrendingDown className="h-3 w-3" />{trend}%</span>;
  };

  const SIZE_LABELS: Record<string, string> = {
    small: "Klein",
    medium: "Medium",
    large: "Groot",
    bundle: "Bundel",
  };

  const buildExportRows = () => {
    if (!emmenData || !tilburgData || !totalData) return [];
    const locations = [
      { ...emmenData, prev: prevEmmenData },
      { ...tilburgData, prev: prevTilburgData },
      { ...totalData, prev: prevTotalData },
    ];
    return locations.map((loc) => {
      const row: Record<string, any> = { locatie: loc.label };
      if (toggles.cylinders) {
        row.cilinder_orders = loc.cylinderOrders;
        row.totaal_cilinders = loc.totalCylinders;
        row.trend_cilinders = loc.prev ? `${calcTrend(loc.totalCylinders, loc.prev.totalCylinders)}%` : "–";
      }
      if (toggles.efficiency) {
        row.efficientie = `${loc.efficiencyRate}%`;
      }
      if (toggles.avgPerOrder) {
        row.gem_per_order = loc.avgCylindersPerOrder;
      }
      if (toggles.gasTypes) {
        loc.gasTypeDistribution.slice(0, 3).forEach((g, i) => {
          row[`gassoort_${i + 1}`] = g.name;
          row[`gassoort_${i + 1}_cilinders`] = g.count;
        });
      }
      if (toggles.sizeDistribution) {
        loc.sizeDistribution.forEach((s) => {
          row[`grootte_${s.size}`] = s.count;
        });
      }
      if (toggles.dryIce) {
        row.droogijs_orders = loc.dryIceOrders;
        row.droogijs_kg = loc.totalDryIceKg;
      }
      if (toggles.topCustomers) {
        loc.topCustomers.slice(0, 3).forEach((c, i) => {
          row[`top_klant_${i + 1}`] = c.name;
          row[`top_klant_${i + 1}_cilinders`] = c.cylinders;
        });
      }
      return row;
    });
  };

  const buildExportColumns = () => {
    const cols: { header: string; key: string; width: number }[] = [
      { header: "Locatie", key: "locatie", width: 14 },
    ];
    if (toggles.cylinders) {
      cols.push({ header: "Cil. Orders", key: "cilinder_orders", width: 12 });
      cols.push({ header: "Totaal Cil.", key: "totaal_cilinders", width: 12 });
      cols.push({ header: trendMode === "prev_year" ? "Trend (jr)" : "Trend (mnd)", key: "trend_cilinders", width: 10 });
    }
    if (toggles.efficiency) {
      cols.push({ header: "Efficiëntie", key: "efficientie", width: 12 });
    }
    if (toggles.avgPerOrder) {
      cols.push({ header: "Gem./Order", key: "gem_per_order", width: 12 });
    }
    if (toggles.gasTypes) {
      for (let i = 1; i <= 3; i++) {
        cols.push({ header: `Gas ${i}`, key: `gassoort_${i}`, width: 16 });
        cols.push({ header: `#${i} Cil.`, key: `gassoort_${i}_cilinders`, width: 8 });
      }
    }
    if (toggles.dryIce) {
      cols.push({ header: "Droogijs Orders", key: "droogijs_orders", width: 14 });
      cols.push({ header: "Droogijs (kg)", key: "droogijs_kg", width: 12 });
    }
    if (toggles.topCustomers) {
      for (let i = 1; i <= 3; i++) {
        cols.push({ header: `Top ${i}`, key: `top_klant_${i}`, width: 20 });
        cols.push({ header: `#${i} Cil.`, key: `top_klant_${i}_cilinders`, width: 8 });
      }
    }
    return cols;
  };

  const exportData = {
    title: `Maandrapport ${format(monthDate, "MMMM yyyy", { locale: nl })}`,
    subtitle: "Productie overzicht per locatie",
    columns: buildExportColumns(),
    rows: buildExportRows(),
    dateRange: { from: startOfMonth(monthDate), to: endOfMonth(monthDate) },
  };

  const handleExportExcel = () => {
    setExporting(true);
    try {
      exportToExcel(exportData, `maandrapport-${selectedMonth}.xlsx`);
      toast.success("Excel rapport gedownload");
    } catch { toast.error("Fout bij exporteren"); }
    finally { setExporting(false); }
  };

  const handleExportPDF = () => {
    setExporting(true);
    try {
      exportToPDF(exportData, `maandrapport-${selectedMonth}.pdf`);
      toast.success("PDF rapport gedownload");
    } catch { toast.error("Fout bij exporteren"); }
    finally { setExporting(false); }
  };

  const LocationColumn = ({
    data,
    prevData,
    color,
  }: {
    data: LocationKPI;
    prevData: LocationKPI | null;
    color: string;
  }) => {
    const totalGas = data.gasTypeDistribution.reduce((sum, g) => sum + g.count, 0);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Building2 className={`h-4 w-4 ${color}`} />
          <h3 className="font-semibold text-sm">{data.label}</h3>
          {data.label === "Totaal" && (
            <Badge variant="outline" className="text-[10px] h-5">Gecombineerd</Badge>
          )}
        </div>

        {/* Cylinder KPIs */}
        {toggles.cylinders && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Cylinder className="h-3 w-3" />
              Cilinders
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/30 rounded-lg p-2.5">
                <div className="text-lg font-bold">{formatNumber(data.totalCylinders, 0)}</div>
                <div className="text-[11px] text-muted-foreground">Gevuld</div>
                {prevData && <TrendBadge current={data.totalCylinders} previous={prevData.totalCylinders} />}
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5">
                <div className="text-lg font-bold">{formatNumber(data.cylinderOrders, 0)}</div>
                <div className="text-[11px] text-muted-foreground">Orders</div>
                {prevData && <TrendBadge current={data.cylinderOrders} previous={prevData.cylinderOrders} />}
              </div>
            </div>
          </div>
        )}

        {/* Efficiency */}
        {toggles.efficiency && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Gauge className="h-3 w-3" />
              Voltooiingsgraad
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold">{data.efficiencyRate}%</span>
                <span className="text-[11px] text-muted-foreground">
                  {formatNumber(data.completedCylinders, 0)} / {formatNumber(data.totalCylinders, 0)}
                </span>
              </div>
              <Progress value={data.efficiencyRate} className="h-2" />
            </div>
          </div>
        )}

        {/* Average per order */}
        {toggles.avgPerOrder && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <BarChart3 className="h-3 w-3" />
              Gem. cilinders per order
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5">
              <div className="text-lg font-bold">{data.avgCylindersPerOrder}</div>
              <div className="text-[11px] text-muted-foreground">cilinders/order</div>
              {prevData && <TrendBadge current={data.avgCylindersPerOrder} previous={prevData.avgCylindersPerOrder} />}
            </div>
          </div>
        )}

        {/* Gas Type Distribution */}
        {toggles.gasTypes && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <BarChart3 className="h-3 w-3" />
              Top gassoorten
            </div>
            <div className="space-y-1.5">
              {data.gasTypeDistribution.length > 0 ? data.gasTypeDistribution.slice(0, 5).map((g) => {
                const pct = totalGas > 0 ? Math.round((g.count / totalGas) * 100) : 0;
                return (
                  <div key={g.name} className="space-y-0.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1.5 truncate">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: g.color }}
                        />
                        <span className="truncate">{g.name}</span>
                      </span>
                      <span className="font-mono font-medium shrink-0 ml-2">
                        {formatNumber(g.count, 0)} ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-muted/50 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: g.color }}
                      />
                    </div>
                  </div>
                );
              }) : (
                <p className="text-xs text-muted-foreground italic px-2">Geen data</p>
              )}
            </div>
          </div>
        )}

        {/* Size Distribution */}
        {toggles.sizeDistribution && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Ruler className="h-3 w-3" />
              Cilindergrootte
            </div>
            <div className="flex flex-wrap gap-1.5">
              {data.sizeDistribution.length > 0 ? data.sizeDistribution.map((s) => (
                <Badge key={s.size} variant="secondary" className="text-[11px] font-normal">
                  {SIZE_LABELS[s.size] || s.size}: {formatNumber(s.count, 0)}
                </Badge>
              )) : (
                <p className="text-xs text-muted-foreground italic px-2">Geen data</p>
              )}
            </div>
          </div>
        )}

        {/* Dry Ice KPIs */}
        {toggles.dryIce && (data.location === "sol_emmen" || data.location === "all") && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Snowflake className="h-3 w-3" />
              Droogijs
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/30 rounded-lg p-2.5">
                <div className="text-lg font-bold">{formatNumber(data.totalDryIceKg, 0)} <span className="text-xs font-normal">kg</span></div>
                <div className="text-[11px] text-muted-foreground">Geproduceerd</div>
              </div>
              <div className="bg-muted/30 rounded-lg p-2.5">
                <div className="text-lg font-bold">{formatNumber(data.dryIceOrders, 0)}</div>
                <div className="text-[11px] text-muted-foreground">Orders</div>
              </div>
            </div>
          </div>
        )}

        {/* Top Customers */}
        {toggles.topCustomers && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Users className="h-3 w-3" />
              Top 5 klanten
            </div>
            <div className="space-y-1">
              {data.topCustomers.length > 0 ? data.topCustomers.map((c, i) => (
                <div key={c.name} className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/30">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className={`font-bold w-4 text-center ${i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-600" : "text-muted-foreground"}`}>
                      {i + 1}
                    </span>
                    <span className="truncate">{c.name}</span>
                  </span>
                  <span className="font-mono font-medium shrink-0 ml-2">{formatNumber(c.cylinders, 0)}</span>
                </div>
              )) : (
                <p className="text-xs text-muted-foreground italic px-2">Geen data</p>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Maandrapport
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              Overzicht van KPI's per locatie — vergelijking t.o.v. {trendMode === "prev_year" ? "dezelfde maand vorig jaar" : "vorige maand"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={trendMode} onValueChange={(v) => setTrendMode(v as "prev_month" | "prev_year")}>
              <SelectTrigger className="w-[190px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="prev_month">t.o.v. vorige maand</SelectItem>
                <SelectItem value="prev_year">t.o.v. vorig jaar</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showSettings ? "default" : "outline"}
              size="sm"
              onClick={() => setShowSettings(!showSettings)}
              className="gap-1.5"
            >
              <Settings2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Secties</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              disabled={exporting || !emmenData}
              className="gap-1.5"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Excel</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportPDF}
              disabled={exporting || !emmenData}
              className="gap-1.5"
            >
              <FileText className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
          </div>
        </div>

        {/* Section toggles */}
        {showSettings && (
          <div className="mt-4 p-3 bg-muted/30 rounded-lg border">
            <p className="text-xs font-medium text-muted-foreground mb-2.5 uppercase tracking-wider">Toon/verberg secties</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
              {TOGGLE_CONFIG.map(({ key, label, icon }) => (
                <div key={key} className="flex items-center gap-2">
                  <Switch
                    id={`toggle-${key}`}
                    checked={toggles[key]}
                    onCheckedChange={(checked) =>
                      setToggles((prev) => ({ ...prev, [key]: checked }))
                    }
                    className="scale-[0.85]"
                  />
                  <Label htmlFor={`toggle-${key}`} className="text-xs flex items-center gap-1 cursor-pointer">
                    {icon}
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {emmenData && tilburgData && totalData ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="border rounded-lg p-4 border-blue-500/20">
              <LocationColumn data={emmenData} prevData={prevEmmenData} color="text-blue-500" />
            </div>
            <div className="border rounded-lg p-4 border-sky-400/20">
              <LocationColumn data={tilburgData} prevData={prevTilburgData} color="text-sky-400" />
            </div>
            <div className="border rounded-lg p-4 border-primary/20 bg-primary/[0.02]">
              <LocationColumn data={totalData} prevData={prevTotalData} color="text-primary" />
            </div>
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-12">Geen data beschikbaar</p>
        )}
      </CardContent>
    </Card>
  );
}
