import { useState, useEffect, useMemo } from "react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
  BarChart3,
  Ruler,
  Settings2,
  Target,
  Pencil,
  Check,
} from "lucide-react";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { exportToExcel, exportToPDF } from "@/lib/export-utils";

interface GasTypeItem {
  name: string;
  color: string;
  count: number;
}

interface SizeItem {
  size: string;
  count: number;
}

interface MonthlyBreakdown {
  month: number;
  label: string;
  cylinders: number;
  orders: number;
}

interface YearLocationKPI {
  location: string;
  label: string;
  totalCylinders: number;
  cylinderOrders: number;
  avgCylindersPerOrder: number;
  totalDryIceKg: number;
  dryIceOrders: number;
  topCustomers: { name: string; cylinders: number }[];
  allCustomerNames: string[];
  gasTypeDistribution: GasTypeItem[];
  sizeDistribution: SizeItem[];
  monthlyBreakdown: MonthlyBreakdown[];
}

interface SectionToggles {
  cylinders: boolean;
  monthly: boolean;
  avgPerOrder: boolean;
  gasTypes: boolean;
  sizeDistribution: boolean;
  dryIce: boolean;
  topCustomers: boolean;
  multiYearTrend: boolean;
  newCustomers: boolean;
  targets: boolean;
}

interface YearTrendPoint {
  year: number;
  emmen: number;
  tilburg: number;
  total: number;
}

const DEFAULT_TOGGLES: SectionToggles = {
  cylinders: true,
  monthly: true,
  avgPerOrder: true,
  gasTypes: true,
  sizeDistribution: true,
  dryIce: true,
  topCustomers: true,
  multiYearTrend: true,
  newCustomers: true,
  targets: true,
};

const TOGGLE_CONFIG: { key: keyof SectionToggles; label: string; icon: React.ReactNode }[] = [
  { key: "cylinders", label: "Cilinders", icon: <Cylinder className="h-3 w-3" /> },
  { key: "monthly", label: "Maandoverzicht", icon: <BarChart3 className="h-3 w-3" /> },
  { key: "avgPerOrder", label: "Gem. per order", icon: <BarChart3 className="h-3 w-3" /> },
  { key: "gasTypes", label: "Gassoorten", icon: <BarChart3 className="h-3 w-3" /> },
  { key: "sizeDistribution", label: "Grootteverdeling", icon: <Ruler className="h-3 w-3" /> },
  { key: "dryIce", label: "Droogijs", icon: <Snowflake className="h-3 w-3" /> },
  { key: "topCustomers", label: "Top 5 klanten", icon: <Users className="h-3 w-3" /> },
  { key: "multiYearTrend", label: "Meerjaarse trend", icon: <TrendingUp className="h-3 w-3" /> },
  { key: "newCustomers", label: "Klantbeweging", icon: <Users className="h-3 w-3" /> },
  { key: "targets", label: "Doelstellingen", icon: <Target className="h-3 w-3" /> },
];

const TOGGLES_STORAGE_KEY = "yearly-report-section-toggles";
const MONTH_LABELS = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

const loadToggles = (): SectionToggles => {
  try {
    const stored = localStorage.getItem(TOGGLES_STORAGE_KEY);
    if (stored) return { ...DEFAULT_TOGGLES, ...JSON.parse(stored) };
  } catch {}
  return DEFAULT_TOGGLES;
};

export function YearlyReport() {
  const currentYear = new Date().getFullYear();
  const today = new Date();
  const todayMMDD = `${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const todayDay = today.getDate();
  const todayMonthLabel = MONTH_LABELS[today.getMonth()];
  const todayMonth = today.getMonth() + 1;

  const [selectedYear, setSelectedYear] = useState(String(currentYear));
  const [ytdMode, setYtdMode] = useState(true);
  const [toggles, setToggles] = useState<SectionToggles>(loadToggles);
  const [showSettings, setShowSettings] = useState(false);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const [emmenData, setEmmenData] = useState<YearLocationKPI | null>(null);
  const [tilburgData, setTilburgData] = useState<YearLocationKPI | null>(null);
  const [prevEmmenData, setPrevEmmenData] = useState<YearLocationKPI | null>(null);
  const [prevTilburgData, setPrevTilburgData] = useState<YearLocationKPI | null>(null);
  const [multiYearData, setMultiYearData] = useState<YearTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [targets, setTargets] = useState<{ emmen: number; tilburg: number }>({ emmen: 0, tilburg: 0 });
  const [editingTargets, setEditingTargets] = useState(false);
  const [targetInputs, setTargetInputs] = useState({ emmen: "", tilburg: "" });

  useEffect(() => {
    localStorage.setItem(TOGGLES_STORAGE_KEY, JSON.stringify(toggles));
  }, [toggles]);

  useEffect(() => {
    setYtdMode(parseInt(selectedYear) === currentYear);
  }, [selectedYear]);

  // Reload targets when year changes
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`yearly-targets-${selectedYear}`);
      setTargets(stored ? JSON.parse(stored) : { emmen: 0, tilburg: 0 });
    } catch {
      setTargets({ emmen: 0, tilburg: 0 });
    }
    setEditingTargets(false);
  }, [selectedYear]);

  // Load multi-year trend once on mount (always full-year data)
  useEffect(() => {
    const loadTrend = async () => {
      setTrendLoading(true);
      const years: number[] = [];
      for (let y = currentYear - 4; y <= currentYear; y++) years.push(y);
      try {
        const results = await Promise.all(
          years.map(async (y) => {
            const from = `${y}-01-01`;
            const to = `${y}-12-31`;
            const [emmenRows, tilburgRows] = await Promise.all([
              fetchProductieForPeriod(from, to, "sol_emmen"),
              fetchProductieForPeriod(from, to, "sol_tilburg"),
            ]);
            const emmen = emmenRows.reduce((s: number, r: any) => s + (r.Aantal || 0), 0);
            const tilburg = tilburgRows.reduce((s: number, r: any) => s + (r.Aantal || 0), 0);
            return { year: y, emmen, tilburg, total: emmen + tilburg };
          }),
        );
        setMultiYearData(results);
      } catch (err) {
        console.error("Error loading multi-year trend:", err);
      } finally {
        setTrendLoading(false);
      }
    };
    loadTrend();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const yearOptions = useMemo(() => {
    const options = [];
    for (let y = currentYear; y >= currentYear - 5; y--) {
      options.push({ value: String(y), label: String(y) });
    }
    return options;
  }, [currentYear]);

  const fromDate = `${selectedYear}-01-01`;
  const toDate = ytdMode ? `${selectedYear}-${todayMMDD}` : `${selectedYear}-12-31`;
  const prevYear = String(parseInt(selectedYear) - 1);
  const prevFromDate = `${prevYear}-01-01`;
  const prevToDate = ytdMode ? `${prevYear}-${todayMMDD}` : `${prevYear}-12-31`;

  const parseDatum = (raw: string): string => {
    if (!raw) return "";
    if (raw.includes("T")) return raw.substring(0, 10);
    const p = raw.split("-");
    return p.length === 3 ? `${p[2]}-${p[1]}-${p[0]}` : raw;
  };

  const fetchProductieForPeriod = async (from: string, to: string, locationParam: string): Promise<any[]> => {
    const year = parseInt(from.substring(0, 4));
    const PAGE = 1000;
    let offset = 0;
    const allRows: any[] = [];
    while (true) {
      const { data } = await (supabase.from("Productie" as never) as any)
        .select("Datum,Locatie,Product,Capaciteit,Aantal,Klant")
        .eq("Jaar", year)
        .range(offset, offset + PAGE - 1);
      if (!data || data.length === 0) break;
      allRows.push(...data);
      if (data.length < PAGE) break;
      offset += PAGE;
    }
    return allRows.filter((row: any) => {
      const iso = parseDatum(row.Datum || "");
      if (!iso || iso < from || iso > to) return false;
      const loc = row.Locatie?.toLowerCase().includes("emmen") ? "sol_emmen" : "sol_tilburg";
      return loc === locationParam;
    });
  };

  const fetchLocationData = async (
    location: string,
    label: string,
    from: string,
    to: string,
  ): Promise<YearLocationKPI> => {
    const isTilburg = location === "sol_tilburg";
    const [rows, dryIceEffRes] = await Promise.all([
      fetchProductieForPeriod(from, to, location),
      isTilburg
        ? Promise.resolve([{ total_kg: 0, total_orders: 0 }])
        : api.reports.getDryIceEfficiency(from, to, location).catch(() => [{ total_kg: 0, total_orders: 0 }]),
    ]);

    const totalCyl = rows.reduce((sum, r) => sum + (r.Aantal || 0), 0);
    const cylOrders = rows.length;

    // Monthly breakdown
    const monthlyMap = new Map<number, { cylinders: number; orders: number }>();
    for (let m = 1; m <= 12; m++) monthlyMap.set(m, { cylinders: 0, orders: 0 });
    for (const row of rows) {
      const iso = parseDatum(row.Datum || "");
      if (!iso) continue;
      const month = parseInt(iso.substring(5, 7));
      if (month >= 1 && month <= 12) {
        const entry = monthlyMap.get(month)!;
        entry.cylinders += row.Aantal || 0;
        entry.orders += 1;
      }
    }
    const monthlyBreakdown: MonthlyBreakdown[] = Array.from(monthlyMap.entries()).map(([month, d]) => ({
      month,
      label: MONTH_LABELS[month - 1],
      cylinders: d.cylinders,
      orders: d.orders,
    }));

    // Top customers + all unique names
    const custMap = new Map<string, number>();
    for (const row of rows) {
      const name = (row.Klant || "Onbekend").trim();
      custMap.set(name, (custMap.get(name) || 0) + (row.Aantal || 0));
    }
    const topCustomers = Array.from(custMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, cylinders]) => ({ name, cylinders }));
    const allCustomerNames = Array.from(custMap.keys());

    // Gas types
    const typeMap = new Map<string, number>();
    for (const row of rows) {
      const name = row.Product || "Onbekend";
      typeMap.set(name, (typeMap.get(name) || 0) + (row.Aantal || 0));
    }
    const gasTypeDistribution = Array.from(typeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, color: "#3b82f6", count }));

    // Size distribution
    const sizeMap = new Map<string, number>();
    for (const row of rows) {
      const size = row.Capaciteit != null ? `${row.Capaciteit}L` : "Onbekend";
      sizeMap.set(size, (sizeMap.get(size) || 0) + (row.Aantal || 0));
    }
    const sizeDistribution = Array.from(sizeMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([size, count]) => ({ size, count }));

    const dryIceEff = (dryIceEffRes as any)?.[0] || {};

    return {
      location,
      label,
      totalCylinders: totalCyl,
      cylinderOrders: cylOrders,
      avgCylindersPerOrder: cylOrders > 0 ? Math.round((totalCyl / cylOrders) * 10) / 10 : 0,
      totalDryIceKg: Number(dryIceEff.total_kg) || 0,
      dryIceOrders: Number(dryIceEff.total_orders) || 0,
      topCustomers,
      allCustomerNames,
      gasTypeDistribution,
      sizeDistribution,
      monthlyBreakdown,
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
        console.error("Error loading yearly report:", err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [fromDate, toDate, prevFromDate, prevToDate]);

  const totalData = useMemo((): YearLocationKPI | null => {
    if (!emmenData || !tilburgData) return null;

    const customerMap = new Map<string, number>();
    [...emmenData.topCustomers, ...tilburgData.topCustomers].forEach((c) => {
      customerMap.set(c.name, (customerMap.get(c.name) || 0) + c.cylinders);
    });
    const mergedCustomers = Array.from(customerMap.entries())
      .map(([name, cylinders]) => ({ name, cylinders }))
      .sort((a, b) => b.cylinders - a.cylinders)
      .slice(0, 5);

    const gasMap = new Map<string, { color: string; count: number }>();
    [...emmenData.gasTypeDistribution, ...tilburgData.gasTypeDistribution].forEach((g) => {
      const ex = gasMap.get(g.name) || { color: g.color, count: 0 };
      gasMap.set(g.name, { color: ex.color, count: ex.count + g.count });
    });
    const mergedGas = Array.from(gasMap.entries())
      .map(([name, d]) => ({ name, ...d }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const sizeMap = new Map<string, number>();
    [...emmenData.sizeDistribution, ...tilburgData.sizeDistribution].forEach((s) => {
      sizeMap.set(s.size, (sizeMap.get(s.size) || 0) + s.count);
    });
    const mergedSizes = Array.from(sizeMap.entries())
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => b.count - a.count);

    const mergedMonthly: MonthlyBreakdown[] = MONTH_LABELS.map((lbl, i) => {
      const month = i + 1;
      const e = emmenData.monthlyBreakdown.find((m) => m.month === month);
      const t = tilburgData.monthlyBreakdown.find((m) => m.month === month);
      return {
        month,
        label: lbl,
        cylinders: (e?.cylinders || 0) + (t?.cylinders || 0),
        orders: (e?.orders || 0) + (t?.orders || 0),
      };
    });

    const totalCyl = emmenData.totalCylinders + tilburgData.totalCylinders;
    const totalOrders = emmenData.cylinderOrders + tilburgData.cylinderOrders;

    return {
      location: "all",
      label: "Totaal",
      totalCylinders: totalCyl,
      cylinderOrders: totalOrders,
      avgCylindersPerOrder: totalOrders > 0 ? Math.round((totalCyl / totalOrders) * 10) / 10 : 0,
      totalDryIceKg: emmenData.totalDryIceKg + tilburgData.totalDryIceKg,
      dryIceOrders: emmenData.dryIceOrders + tilburgData.dryIceOrders,
      topCustomers: mergedCustomers,
      allCustomerNames: Array.from(new Set([...emmenData.allCustomerNames, ...tilburgData.allCustomerNames])),
      gasTypeDistribution: mergedGas,
      sizeDistribution: mergedSizes,
      monthlyBreakdown: mergedMonthly,
    };
  }, [emmenData, tilburgData]);

  const prevTotalData = useMemo((): YearLocationKPI | null => {
    if (!prevEmmenData || !prevTilburgData) return null;
    const totalCyl = prevEmmenData.totalCylinders + prevTilburgData.totalCylinders;
    const totalOrders = prevEmmenData.cylinderOrders + prevTilburgData.cylinderOrders;
    return {
      location: "all",
      label: "Totaal",
      totalCylinders: totalCyl,
      cylinderOrders: totalOrders,
      avgCylindersPerOrder: totalOrders > 0 ? Math.round((totalCyl / totalOrders) * 10) / 10 : 0,
      totalDryIceKg: prevEmmenData.totalDryIceKg + prevTilburgData.totalDryIceKg,
      dryIceOrders: prevEmmenData.dryIceOrders + prevTilburgData.dryIceOrders,
      topCustomers: [],
      allCustomerNames: Array.from(new Set([...prevEmmenData.allCustomerNames, ...prevTilburgData.allCustomerNames])),
      gasTypeDistribution: [],
      sizeDistribution: [],
      monthlyBreakdown: MONTH_LABELS.map((lbl, i) => ({ month: i + 1, label: lbl, cylinders: 0, orders: 0 })),
    };
  }, [prevEmmenData, prevTilburgData]);

  const daysElapsed = useMemo(() => {
    if (!ytdMode || parseInt(selectedYear) !== currentYear) return 365;
    const start = new Date(currentYear, 0, 1);
    return Math.max(1, Math.floor((today.getTime() - start.getTime()) / 86400000));
  }, [ytdMode, selectedYear]);

  const forecast = useMemo(() => {
    if (!ytdMode || parseInt(selectedYear) !== currentYear || !totalData || !emmenData || !tilburgData) return null;
    return {
      total: Math.round((totalData.totalCylinders / daysElapsed) * 365),
      emmen: Math.round((emmenData.totalCylinders / daysElapsed) * 365),
      tilburg: Math.round((tilburgData.totalCylinders / daysElapsed) * 365),
    };
  }, [ytdMode, selectedYear, totalData, emmenData, tilburgData, daysElapsed]);

  const calcTrend = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  };

  const TrendBadge = ({ current, previous, label }: { current: number; previous: number; label?: string }) => {
    const trend = calcTrend(current, previous);
    const tooltipText = `${label ? label + ": " : ""}${formatNumber(previous, 0)} → ${formatNumber(current, 0)}`;
    const badge =
      trend === 0 ? (
        <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground cursor-help">
          <Minus className="h-3 w-3" />0%
        </span>
      ) : trend > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-[11px] text-green-600 cursor-help">
          <TrendingUp className="h-3 w-3" />+{trend}%
        </span>
      ) : (
        <span className="inline-flex items-center gap-0.5 text-[11px] text-red-500 cursor-help">
          <TrendingDown className="h-3 w-3" />{trend}%
        </span>
      );
    return (
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>{badge}</TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  const buildExportRows = () => {
    if (!emmenData || !tilburgData || !totalData) return [];
    const locations = [
      { ...emmenData, prev: prevEmmenData },
      { ...tilburgData, prev: prevTilburgData },
      { ...totalData, prev: prevTotalData },
    ];
    return locations.map((loc) => {
      const row: Record<string, any> = { locatie: loc.label, jaar: selectedYear };
      if (toggles.cylinders) {
        row.cilinder_orders = loc.cylinderOrders;
        row.totaal_cilinders = loc.totalCylinders;
        row.trend_cilinders = loc.prev ? `${calcTrend(loc.totalCylinders, loc.prev.totalCylinders)}%` : "–";
      }
      if (toggles.avgPerOrder) row.gem_per_order = loc.avgCylindersPerOrder;
      if (toggles.monthly) {
        loc.monthlyBreakdown.forEach((m) => {
          row[`${m.label}_cilinders`] = m.cylinders;
        });
      }
      if (toggles.gasTypes) {
        loc.gasTypeDistribution.slice(0, 3).forEach((g, i) => {
          row[`gassoort_${i + 1}`] = g.name;
          row[`gassoort_${i + 1}_cilinders`] = g.count;
        });
      }
      if (toggles.dryIce) {
        row.droogijs_kg = loc.totalDryIceKg;
        row.droogijs_orders = loc.dryIceOrders;
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
      { header: "Jaar", key: "jaar", width: 8 },
    ];
    if (toggles.cylinders) {
      cols.push({ header: "Cil. Orders", key: "cilinder_orders", width: 12 });
      cols.push({ header: "Totaal Cil.", key: "totaal_cilinders", width: 12 });
      cols.push({ header: "Trend (jr)", key: "trend_cilinders", width: 10 });
    }
    if (toggles.avgPerOrder) cols.push({ header: "Gem./Order", key: "gem_per_order", width: 12 });
    if (toggles.monthly) {
      MONTH_LABELS.forEach((lbl) => {
        cols.push({ header: lbl.charAt(0).toUpperCase() + lbl.slice(1), key: `${lbl}_cilinders`, width: 8 });
      });
    }
    if (toggles.gasTypes) {
      for (let i = 1; i <= 3; i++) {
        cols.push({ header: `Gas ${i}`, key: `gassoort_${i}`, width: 16 });
        cols.push({ header: `#${i} Cil.`, key: `gassoort_${i}_cilinders`, width: 8 });
      }
    }
    if (toggles.dryIce) {
      cols.push({ header: "Droogijs (kg)", key: "droogijs_kg", width: 12 });
      cols.push({ header: "Droogijs Orders", key: "droogijs_orders", width: 14 });
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
    title: `Jaarrapport ${selectedYear}`,
    subtitle: "Productie overzicht per locatie",
    columns: buildExportColumns(),
    rows: buildExportRows(),
    dateRange: {
      from: new Date(parseInt(selectedYear), 0, 1),
      to: new Date(parseInt(selectedYear), 11, 31),
    },
  };

  const handleExportExcel = () => {
    setExporting(true);
    try {
      exportToExcel(exportData, `jaarrapport-${selectedYear}.xlsx`);
      toast.success("Excel rapport gedownload");
    } catch { toast.error("Fout bij exporteren"); }
    finally { setExporting(false); }
  };

  const handleExportPDF = () => {
    setExporting(true);
    try {
      exportToPDF(exportData, `jaarrapport-${selectedYear}.pdf`);
      toast.success("PDF rapport gedownload");
    } catch { toast.error("Fout bij exporteren"); }
    finally { setExporting(false); }
  };

  const LocationColumn = ({
    data,
    prevData,
    color,
  }: {
    data: YearLocationKPI;
    prevData: YearLocationKPI | null;
    color: string;
  }) => {
    const totalGas = data.gasTypeDistribution.reduce((sum, g) => sum + g.count, 0);
    const prevTotalGas = prevData?.gasTypeDistribution.reduce((sum, g) => sum + g.count, 0) ?? 0;
    const maxMonthCylinders = Math.max(...data.monthlyBreakdown.map((m) => m.cylinders), 1);

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

        {/* Monthly Breakdown bar chart */}
        {toggles.monthly && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <BarChart3 className="h-3 w-3" />
              Maandoverzicht
            </div>
            <div className="bg-muted/30 rounded-lg p-2.5">
              <div className="flex items-end gap-0.5 h-16">
                {data.monthlyBreakdown.map((m) => {
                  const pct = (m.cylinders / maxMonthCylinders) * 100;
                  const isFuture = ytdMode && parseInt(selectedYear) === currentYear && m.month > todayMonth;
                  return (
                    <TooltipProvider key={m.month} delayDuration={100}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="flex-1 flex flex-col items-center gap-0.5 cursor-default">
                            <div
                              className={`w-full rounded-sm transition-colors ${isFuture ? "bg-muted/50" : "bg-primary/70 hover:bg-primary"}`}
                              style={{ height: `${isFuture ? 4 : Math.max(pct, 2)}%` }}
                            />
                            <span className={`text-[8px] leading-none ${isFuture ? "text-muted-foreground/40" : "text-muted-foreground"}`}>
                              {m.label}
                            </span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs">
                          <p className="font-medium capitalize">{m.label}</p>
                          {isFuture ? (
                            <p className="text-muted-foreground">Nog niet verstreken</p>
                          ) : (
                            <>
                              <p>{formatNumber(m.cylinders, 0)} cilinders</p>
                              <p>{m.orders} orders</p>
                            </>
                          )}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
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
              {data.gasTypeDistribution.length > 0 ? (
                data.gasTypeDistribution.slice(0, 5).map((g) => {
                  const pct = totalGas > 0 ? Math.round((g.count / totalGas) * 100) : 0;
                  const prevG = prevData?.gasTypeDistribution.find((x) => x.name === g.name);
                  const prevPct = prevG && prevTotalGas > 0 ? (prevG.count / prevTotalGas) * 100 : 0;
                  const ppDelta = prevData ? Math.round(pct - prevPct) : null;
                  return (
                    <div key={g.name} className="space-y-0.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="flex items-center gap-1.5 truncate">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: g.color }} />
                          <span className="truncate">{g.name}</span>
                        </span>
                        <span className="flex items-center gap-1.5 font-mono font-medium shrink-0 ml-2">
                          {pct}%
                          {ppDelta !== null && ppDelta !== 0 && (
                            <span className={`text-[10px] font-normal ${ppDelta > 0 ? "text-green-600" : "text-red-500"}`}>
                              {ppDelta > 0 ? `+${ppDelta}` : ppDelta}pp
                            </span>
                          )}
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
                })
              ) : (
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
              {data.sizeDistribution.length > 0 ? (
                data.sizeDistribution.map((s) => (
                  <Badge key={s.size} variant="secondary" className="text-[11px] font-normal">
                    {s.size}: {formatNumber(s.count, 0)}
                  </Badge>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic px-2">Geen data</p>
              )}
            </div>
          </div>
        )}

        {/* Dry Ice */}
        {toggles.dryIce && (data.location === "sol_emmen" || data.location === "all") && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Snowflake className="h-3 w-3" />
              Droogijs
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-muted/30 rounded-lg p-2.5">
                <div className="text-lg font-bold">
                  {formatNumber(data.totalDryIceKg, 0)} <span className="text-xs font-normal">kg</span>
                </div>
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
              {data.topCustomers.length > 0 ? (
                data.topCustomers.map((c, i) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-muted/30"
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <span
                        className={`font-bold w-4 text-center ${
                          i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-600" : "text-muted-foreground"
                        }`}
                      >
                        {i + 1}
                      </span>
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="font-mono font-medium shrink-0 ml-2">{formatNumber(c.cylinders, 0)}</span>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic px-2">Geen data</p>
              )}
            </div>
            {data.topCustomers.length > 0 && data.totalCylinders > 0 && (
              <div className="mt-1.5 pt-1.5 border-t space-y-0.5">
                {(() => {
                  const top1Pct = Math.round((data.topCustomers[0].cylinders / data.totalCylinders) * 100);
                  const top3Sum = data.topCustomers.slice(0, 3).reduce((s, c) => s + c.cylinders, 0);
                  const top3Pct = Math.round((top3Sum / data.totalCylinders) * 100);
                  return (
                    <>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Top klant</span>
                        <span className={`font-medium ${top1Pct >= 40 ? "text-amber-500" : ""}`}>{top1Pct}%</span>
                      </div>
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Top 3 concentratie</span>
                        <span className={`font-medium ${top3Pct >= 65 ? "text-red-500" : top3Pct >= 50 ? "text-amber-500" : ""}`}>
                          {top3Pct}%
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* Customer movement: new / returning / lost */}
        {toggles.newCustomers && prevData && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              <Users className="h-3 w-3" />
              Klantbeweging t.o.v. {prevYear}
            </div>
            {(() => {
              const current = new Set(data.allCustomerNames);
              const prev = new Set(prevData.allCustomerNames);
              const newC = [...current].filter((n) => !prev.has(n)).length;
              const returning = [...current].filter((n) => prev.has(n)).length;
              const lost = [...prev].filter((n) => !current.has(n)).length;
              return (
                <div className="grid grid-cols-3 gap-1.5">
                  <div className="bg-green-500/10 rounded-lg p-2 text-center">
                    <div className="text-base font-bold text-green-600">{newC}</div>
                    <div className="text-[10px] text-muted-foreground">Nieuw</div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-2 text-center">
                    <div className="text-base font-bold">{returning}</div>
                    <div className="text-[10px] text-muted-foreground">Terugkerend</div>
                  </div>
                  <div className="bg-red-500/10 rounded-lg p-2 text-center">
                    <div className="text-base font-bold text-red-500">{lost}</div>
                    <div className="text-[10px] text-muted-foreground">Verloren</div>
                  </div>
                </div>
              );
            })()}
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
              Jaarrapport
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {ytdMode
                ? `1 jan – ${todayDay} ${todayMonthLabel} ${selectedYear} (YTD) t.o.v. ${prevYear}`
                : `Volledig jaar ${selectedYear} — vergelijking t.o.v. ${prevYear}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="w-[110px] h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={ytdMode ? "default" : "outline"}
                    size="sm"
                    onClick={() => setYtdMode(!ytdMode)}
                    className="gap-1.5"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">YTD</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs max-w-[200px]">
                  {ytdMode
                    ? `YTD actief: vergelijkt t/m ${todayDay} ${todayMonthLabel} in beide jaren`
                    : "Klik om YTD in te schakelen: vergelijkt dezelfde periode in beide jaren"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
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
            <p className="text-xs font-medium text-muted-foreground mb-2.5 uppercase tracking-wider">
              Toon/verberg secties
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-x-4 gap-y-2">
              {TOGGLE_CONFIG.map(({ key, label, icon }) => (
                <div key={key} className="flex items-center gap-2">
                  <Switch
                    id={`ytoggle-${key}`}
                    checked={toggles[key]}
                    onCheckedChange={(checked) =>
                      setToggles((prev) => ({ ...prev, [key]: checked }))
                    }
                    className="scale-[0.85]"
                  />
                  <Label htmlFor={`ytoggle-${key}`} className="text-xs flex items-center gap-1 cursor-pointer">
                    {icon}
                    {label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
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

        {/* Jaarprognose — only shown when YTD + current year */}
        {forecast && (
          <div className="border rounded-lg p-4 border-primary/20 bg-primary/[0.02]">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <TrendingUp className="h-3 w-3" />
                Jaarprognose {selectedYear}
              </div>
              <Badge variant="outline" className="text-[10px] h-4">
                op basis van {daysElapsed} dagen
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-[11px] text-blue-500 font-medium mb-0.5">SOL Emmen</div>
                <div className="text-xl font-bold">~{formatNumber(forecast.emmen, 0)}</div>
                <div className="text-[11px] text-muted-foreground">cilinders</div>
              </div>
              <div>
                <div className="text-[11px] text-sky-400 font-medium mb-0.5">SOL Tilburg</div>
                <div className="text-xl font-bold">~{formatNumber(forecast.tilburg, 0)}</div>
                <div className="text-[11px] text-muted-foreground">cilinders</div>
              </div>
              <div className="border-l pl-4">
                <div className="text-[11px] text-primary font-medium mb-0.5">Totaal</div>
                <div className="text-2xl font-bold text-primary">~{formatNumber(forecast.total, 0)}</div>
                <div className="text-[11px] text-muted-foreground">cilinders op jaarbasis</div>
              </div>
            </div>
          </div>
        )}

        {/* Doelstellingen */}
        {toggles.targets && (
          <div className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                <Target className="h-3 w-3" />
                Doelstellingen {selectedYear}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => {
                  if (editingTargets) {
                    const saved = {
                      emmen: parseInt(targetInputs.emmen) || 0,
                      tilburg: parseInt(targetInputs.tilburg) || 0,
                    };
                    setTargets(saved);
                    localStorage.setItem(`yearly-targets-${selectedYear}`, JSON.stringify(saved));
                    setEditingTargets(false);
                  } else {
                    setTargetInputs({ emmen: String(targets.emmen || ""), tilburg: String(targets.tilburg || "") });
                    setEditingTargets(true);
                  }
                }}
              >
                {editingTargets ? <><Check className="h-3 w-3" />Opslaan</> : <><Pencil className="h-3 w-3" />Bewerken</>}
              </Button>
            </div>
            {editingTargets ? (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-blue-500">SOL Emmen doelstelling</Label>
                  <input
                    type="number"
                    value={targetInputs.emmen}
                    onChange={(e) => setTargetInputs((p) => ({ ...p, emmen: e.target.value }))}
                    className="mt-1 w-full text-sm border rounded px-2 py-1 bg-background"
                    placeholder="Bijv. 10000"
                  />
                </div>
                <div>
                  <Label className="text-xs text-sky-400">SOL Tilburg doelstelling</Label>
                  <input
                    type="number"
                    value={targetInputs.tilburg}
                    onChange={(e) => setTargetInputs((p) => ({ ...p, tilburg: e.target.value }))}
                    className="mt-1 w-full text-sm border rounded px-2 py-1 bg-background"
                    placeholder="Bijv. 5000"
                  />
                </div>
              </div>
            ) : targets.emmen === 0 && targets.tilburg === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Geen doelstellingen ingesteld voor {selectedYear}. Klik op Bewerken.
              </p>
            ) : (
              <div className="space-y-3">
                {[
                  { label: "SOL Emmen", colorBar: "bg-blue-500", colorText: "text-blue-500", current: emmenData?.totalCylinders ?? 0, target: targets.emmen },
                  { label: "SOL Tilburg", colorBar: "bg-sky-400", colorText: "text-sky-400", current: tilburgData?.totalCylinders ?? 0, target: targets.tilburg },
                  { label: "Totaal", colorBar: "bg-primary", colorText: "text-primary", current: totalData?.totalCylinders ?? 0, target: targets.emmen + targets.tilburg },
                ]
                  .filter((r) => r.target > 0)
                  .map(({ label, colorBar, colorText, current, target }) => {
                    const pct = Math.min(100, Math.round((current / target) * 100));
                    return (
                      <div key={label}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className={`font-medium ${colorText}`}>{label}</span>
                          <span className="text-muted-foreground font-mono">
                            {formatNumber(current, 0)} / {formatNumber(target, 0)}
                            <span className="ml-2 font-semibold text-foreground">{pct}%</span>
                          </span>
                        </div>
                        <div className="w-full bg-muted/50 rounded-full h-2">
                          <div className={`h-2 rounded-full transition-all ${colorBar}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* Multi-year trend */}
        {toggles.multiYearTrend && (
          <div className="border rounded-lg p-4">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-4">
              <TrendingUp className="h-3 w-3" />
              Meerjaarse trend — cilinders per jaar
            </div>
            {trendLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-2.5">
                {(() => {
                  const maxTotal = Math.max(...multiYearData.map((p) => p.total), 1);
                  return multiYearData.map((point, i) => {
                    const emmenW = (point.emmen / maxTotal) * 100;
                    const tilburgW = (point.tilburg / maxTotal) * 100;
                    const prevPoint = multiYearData[i - 1];
                    const trend = prevPoint && prevPoint.total > 0
                      ? Math.round(((point.total - prevPoint.total) / prevPoint.total) * 100)
                      : null;
                    const isCurrentYear = point.year === currentYear;
                    return (
                      <div key={point.year} className="flex items-center gap-3 text-xs">
                        <div className="w-10 font-medium text-right shrink-0 text-muted-foreground">
                          {point.year}
                        </div>
                        <div className="flex-1 flex items-center h-5 rounded overflow-hidden bg-muted/30">
                          <div className="h-full bg-blue-500/60" style={{ width: `${emmenW}%` }} />
                          <div className="h-full bg-sky-400/60" style={{ width: `${tilburgW}%` }} />
                        </div>
                        <div className="w-20 font-mono font-medium text-right shrink-0">
                          {formatNumber(point.total, 0)}
                          {isCurrentYear && (
                            <span className="text-muted-foreground text-[10px] font-normal ml-1">YTD</span>
                          )}
                        </div>
                        <div className="w-12 shrink-0 text-right">
                          {trend !== null && (
                            <span className={trend > 0 ? "text-green-600" : trend < 0 ? "text-red-500" : "text-muted-foreground"}>
                              {trend > 0 ? `+${trend}` : trend}%
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  });
                })()}
                <div className="flex gap-5 pt-3 border-t mt-1">
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-3 h-3 rounded-sm bg-blue-500/60 shrink-0" />SOL Emmen
                  </span>
                  <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="w-3 h-3 rounded-sm bg-sky-400/60 shrink-0" />SOL Tilburg
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
