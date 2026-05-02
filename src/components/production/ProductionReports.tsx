import { useState, useEffect, useMemo, lazy, Suspense, useCallback } from "react";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";

// Type definitions for RPC responses
interface DailyProductionData {
  production_date: string;
  cylinder_count: number;
  dry_ice_kg: number;
}

interface GasTypeDistributionData {
  gas_type_id: string | null;
  gas_type_name: string;
  gas_type_color: string;
  total_cylinders: number;
  is_digital?: boolean;
  is_external?: boolean;
}

interface GasCategoryDistributionData {
  category_id: string | null;
  category_name: string;
  total_cylinders: number;
}

interface EfficiencyData {
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  efficiency_rate: number;
  total_cylinders: number;
  completed_cylinders: number;
}

interface DryIceEfficiencyData {
  total_orders: number;
  completed_orders: number;
  pending_orders: number;
  cancelled_orders: number;
  efficiency_rate: number;
  total_kg: number;
  completed_kg: number;
}

interface CustomerTotalsData {
  customer_id: string | null;
  customer_name: string;
  total_cylinders: number;
  total_dry_ice_kg: number;
}

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BarChart3,
  Building2,
  Cylinder,
  Snowflake,
  CalendarIcon,
  TrendingUp,
  Package,
  CheckCircle2,
  Clock,
  GitCompare,
  Sparkles,
  ChevronDown,
  ChevronUp,
  EyeOff,
} from "lucide-react";
import { ChartSkeleton, StatCardSkeleton } from "@/components/ui/skeletons";
import { StatCard } from "@/components/ui/stat-card";

// Lazy load heavy chart components
const YearComparisonReport = lazy(() => import("./YearComparisonReport").then(m => ({ default: m.YearComparisonReport })));
const CumulativeGasTypeChart = lazy(() => import("./CumulativeGasTypeChart").then(m => ({ default: m.CumulativeGasTypeChart })));
const CumulativeCylinderSizeChart = lazy(() => import("./CumulativeCylinderSizeChart").then(m => ({ default: m.CumulativeCylinderSizeChart })));
const ProductionHeatMap = lazy(() => import("./ProductionHeatMap").then(m => ({ default: m.ProductionHeatMap })));
const CustomerSegmentation = lazy(() => import("./CustomerSegmentation").then(m => ({ default: m.CustomerSegmentation })));
const LocationComparisonReport = lazy(() => import("./LocationComparisonReport").then(m => ({ default: m.LocationComparisonReport })));
const MonthlyReport = lazy(() => import("./MonthlyReport").then(m => ({ default: m.MonthlyReport })));
const YearlyReport = lazy(() => import("./YearlyReport").then(m => ({ default: m.YearlyReport })));
const TopCustomersWidget = lazy(() => import("./TopCustomersWidget").then(m => ({ default: m.TopCustomersWidget })));



// Loading fallback component with skeleton
const ChartLoadingFallback = () => (
  <ChartSkeleton height={300} showLegend={false} />
);
import { format, startOfMonth, endOfMonth, subMonths, startOfWeek, endOfWeek, differenceInDays, subDays, startOfYear, endOfYear, subYears, isSameDay, isSameMonth, isSameYear } from "date-fns";
import { nl } from "date-fns/locale";
import { cn, formatNumber, normalizeDatum } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ReportExportButtons } from "./ReportExportButtons";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ComposedChart,
  Area,
  BarChart,
  Bar,
  Legend,
  Cell,
  LabelList,
  ReferenceArea,
} from "recharts";

type DateRange = {
  from: Date;
  to: Date;
};

interface GasCylinderOrder {
  id: string;
  order_number: string;
  customer_name: string;
  gas_type: string;
  gas_type_id: string | null;
  gas_grade: "medical" | "technical";
  cylinder_count: number;
  scheduled_date: string;
  status: string;
  pressure: number;
  notes: string | null;
}

interface DryIceOrder {
  id: string;
  order_number: string;
  customer_name: string;
  product_type: string;
  quantity_kg: number;
  scheduled_date: string;
  status: string;
}

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface ProductionReportsProps {
  refreshKey?: number;
  onDataChanged?: () => void;
  location?: ProductionLocation;
  dateRange?: DateRange;
  onDateRangeChange?: (range: DateRange) => void;
  hideDigital?: boolean;
  onHideDigitalChange?: (value: boolean) => void;
  hideExternal?: boolean;
  onHideExternalChange?: (value: boolean) => void;
}

import { getGasColor } from "@/constants/gasColors";

export function ProductionReports({
  refreshKey = 0,
  onDataChanged,
  location = "all",
  dateRange: externalDateRange,
  onDateRangeChange,
  hideDigital: externalHideDigital,
  onHideDigitalChange,
  hideExternal: externalHideExternal,
  onHideExternalChange
}: ProductionReportsProps) {
  const [loading, setLoading] = useState(true);

  // Server-side aggregated data
  const [dailyProduction, setDailyProduction] = useState<DailyProductionData[]>([]);
  const [gasTypeDistributionData, setGasTypeDistributionData] = useState<GasTypeDistributionData[]>([]);
  const [gasCategoryDistributionData, setGasCategoryDistributionData] = useState<GasCategoryDistributionData[]>([]);
  const hideDigital = externalHideDigital ?? false;
  const setHideDigital = (val: boolean) => onHideDigitalChange?.(val);
  const hideExternal = externalHideExternal ?? false;
  const setHideExternal = (val: boolean) => onHideExternalChange?.(val);
  const [hasDigitalTypes, setHasDigitalTypes] = useState(false);
  const [hasExternalTypes, setHasExternalTypes] = useState(false);
  const [cylinderEfficiency, setCylinderEfficiency] = useState<EfficiencyData | null>(null);
  const [dryIceEfficiency, setDryIceEfficiency] = useState<DryIceEfficiencyData | null>(null);
  const [prevCylinderEfficiency, setPrevCylinderEfficiency] = useState<EfficiencyData | null>(null);
  const [prevDryIceEfficiency, setPrevDryIceEfficiency] = useState<DryIceEfficiencyData | null>(null);
  const [customerTotals, setCustomerTotals] = useState<CustomerTotalsData[]>([]);

  const [internalDateRange, setInternalDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date())
  });

  // Use external dateRange if provided, otherwise use internal state
  const dateRange = externalDateRange || internalDateRange;
  const setDateRange = (range: DateRange) => {
    if (onDateRangeChange) {
      onDateRangeChange(range);
    } else {
      setInternalDateRange(range);
    }
  };

  const [cylinderOrders, setCylinderOrders] = useState<GasCylinderOrder[]>([]);
  const [dryIceOrders, setDryIceOrders] = useState<DryIceOrder[]>([]);
  const [activeTab, setActiveTab] = useState("overview");
  const [productieView, setProductieView] = useState<"monthly" | "yearly">("monthly");
  const [productionChartView, setProductionChartView] = useState<"both" | "cylinders" | "dryIce">("both");
  const [distributionView, setDistributionView] = useState<"type" | "category">("type");


  // Previous period stats for trend calculations
  const [previousPeriodStats, setPreviousPeriodStats] = useState({
    cylinderOrders: 0,
    totalCylinders: 0,
    dryIceOrders: 0,
    totalDryIce: 0,
    completed: 0,
    pending: 0
  });

  // Determine if dry ice should be shown (only for Emmen or All)
  const showDryIce = location !== "sol_tilburg";

  useEffect(() => {
    fetchReportData();
  }, [dateRange, refreshKey, location, hideDigital, hideExternal]);

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const fromDate = format(dateRange.from, "yyyy-MM-dd");
      const toDate = format(dateRange.to, "yyyy-MM-dd");

      // YTD mode: Jan 1 to today → compare same period last year
      const nowCheck = new Date();
      const ytd = dateRange.from.getMonth() === 0 && dateRange.from.getDate() === 1
        && dateRange.to.getFullYear() === dateRange.from.getFullYear()
        && dateRange.to <= nowCheck;

      let prevFromDate: string, prevToDate: string;
      if (ytd) {
        const prevYr = dateRange.from.getFullYear() - 1;
        const prevEnd = new Date(dateRange.to);
        prevEnd.setFullYear(prevYr);
        prevFromDate = `${prevYr}-01-01`;
        prevToDate = format(prevEnd, "yyyy-MM-dd");
      } else {
        prevFromDate = format(subYears(dateRange.from, 1), "yyyy-MM-dd");
        prevToDate = format(subYears(dateRange.to, 1), "yyyy-MM-dd");
      }
      const locationParam = location === "all" ? null : location;
      const isTilburg = location === "sol_tilburg";

      // Paginate all Productie rows for a date range
      const fetchRows = async (fDate: string, tDate: string): Promise<any[]> => {
        const fromYear = parseInt(fDate.substring(0, 4));
        const toYear = parseInt(tDate.substring(0, 4));
        const years = Array.from({ length: toYear - fromYear + 1 }, (_, i) => fromYear + i);
        const allRows: any[] = [];
        for (const year of years) {
          const PAGE = 1000;
          // Get total row count for this year first, then load all pages in parallel
          const { count } = await (supabase.from("Productie" as never) as any)
            .select("*", { count: "exact", head: true })
            .eq("Jaar", year);
          const totalRows = count || 0;
          if (totalRows === 0) continue;
          const numPages = Math.ceil(totalRows / PAGE);
          const pageResults = await Promise.all(
            Array.from({ length: numPages }, (_, i) =>
              (supabase.from("Productie" as never) as any)
                .select("Datum,Locatie,Product,Capaciteit,Aantal,Klant")
                .eq("Jaar", year)
                .order("id")
                .range(i * PAGE, (i + 1) * PAGE - 1)
            )
          );
          for (const { data } of pageResults) {
            if (data) allRows.push(...data);
          }
        }
        return allRows.filter((row: any) => {
          const raw: string = row.Datum || "";
          if (!raw) return false;
          const iso = normalizeDatum(raw);
          if (iso < fDate || iso > tDate) return false;
          if (locationParam) {
            const loc = row.Locatie?.toLowerCase().includes("emmen") ? "sol_emmen" : "sol_tilburg";
            if (loc !== locationParam) return false;
          }
          return true;
        });
      };

      const getDryIce = async (f: string, t: string) => {
        if (isTilburg) return [{ total_kg: 0, total_orders: 0, completed_orders: 0, pending_orders: 0, cancelled_orders: 0 }];
        try { return await api.reports.getDryIceEfficiency(f, t, null); }
        catch { return [{ total_kg: 0, total_orders: 0, completed_orders: 0, pending_orders: 0, cancelled_orders: 0 }]; }
      };

      const [currentRows, prevRows, dryIceData, prevDryIceData, gasTypesData] = await Promise.all([
        fetchRows(fromDate, toDate),
        fetchRows(prevFromDate, prevToDate),
        getDryIce(fromDate, toDate),
        getDryIce(prevFromDate, prevToDate),
        api.gasTypes.getAllIncludingInactive(),
      ]);
      const gasTypeMap = new Map<string, any>(gasTypesData?.map(gt => [gt.name, gt]) || []);

      // Build EfficiencyData from Productie rows (no status in Productie, all = completed)
      const buildEfficiency = (rows: any[]): EfficiencyData => {
        const total = rows.reduce((sum, r) => sum + (r.Aantal || 0), 0);
        return { total_orders: rows.length, completed_orders: rows.length, pending_orders: 0, cancelled_orders: 0, efficiency_rate: 100, total_cylinders: total, completed_cylinders: total };
      };

      const cylEff = buildEfficiency(currentRows);
      const prevCylEff = buildEfficiency(prevRows);
      setCylinderEfficiency(cylEff);
      setPrevCylinderEfficiency(prevCylEff);

      const dryIceEff = (dryIceData as any)?.[0] || null;
      const prevDryIceEff = (prevDryIceData as any)?.[0] || null;
      setDryIceEfficiency(dryIceEff);
      setPrevDryIceEfficiency(prevDryIceEff);

      setPreviousPeriodStats({
        cylinderOrders: prevCylEff.total_orders,
        totalCylinders: prevCylEff.total_cylinders,
        dryIceOrders: prevDryIceEff?.total_orders || 0,
        totalDryIce: prevDryIceEff?.total_kg || 0,
        completed: prevCylEff.completed_orders + (prevDryIceEff?.completed_orders || 0),
        pending: prevDryIceEff?.pending_orders || 0,
      });

      // Daily production grouped by date
      const dailyMap = new Map<string, number>();
      for (const row of currentRows) {
        const iso = normalizeDatum((row.Datum || "").toString());
        if (iso) dailyMap.set(iso, (dailyMap.get(iso) || 0) + (row.Aantal || 0));
      }
      setDailyProduction(
        Array.from(dailyMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, count]) => ({ production_date: date, cylinder_count: count, dry_ice_kg: 0 }))
      );

      // Prev year daily data keyed by day-offset from prevFromDate
      const prevDailyMap = new Map<string, number>();
      for (const row of prevRows) {
        const iso = normalizeDatum((row.Datum || "").toString());
        if (iso) prevDailyMap.set(iso, (prevDailyMap.get(iso) || 0) + (row.Aantal || 0));
      }
      const prevStart = new Date(prevFromDate);
      const prevEnd = new Date(prevToDate);
      const prevTotalDays = differenceInDays(prevEnd, prevStart) + 1;
      const prevOffsetArr: number[] = Array(prevTotalDays).fill(0);
      prevDailyMap.forEach((count, isoDate) => {
        const offset = differenceInDays(new Date(isoDate), prevStart);
        if (offset >= 0 && offset < prevTotalDays) prevOffsetArr[offset] = count;
      });
      setPrevDailyByOffset(prevOffsetArr);

      // Location split (for KPI cards when location === "all")
      const emmenCyl = currentRows
        .filter(r => r.Locatie?.toLowerCase().includes("emmen"))
        .reduce((s: number, r: any) => s + (r.Aantal || 0), 0);
      const tilburgCyl = currentRows
        .filter(r => !r.Locatie?.toLowerCase().includes("emmen"))
        .reduce((s: number, r: any) => s + (r.Aantal || 0), 0);
      setLocationSplit({ emmen: emmenCyl, tilburg: tilburgCyl });

      // Gas type distribution grouped by Product
      const typeMap = new Map<string, number>();
      for (const row of currentRows) {
        const name = row.Product || "Onbekend";
        typeMap.set(name, (typeMap.get(name) || 0) + (row.Aantal || 0));
      }
      let hasDigital = false;
      let hasExternal = false;
      setGasTypeDistributionData(
        Array.from(typeMap.entries())
          .map(([name, total]) => {
            const gt = gasTypeMap.get(name);
            const isDig = gt?.is_digital || false;
            const isExt = gt?.is_external || false;
            if (isDig) hasDigital = true;
            if (isExt) hasExternal = true;
            return {
              gas_type_id: gt?.id || null,
              gas_type_name: name,
              gas_type_color: gt?.color || "",
              total_cylinders: total,
              is_digital: isDig,
              is_external: isExt,
            };
          })
          .sort((a, b) => b.total_cylinders - a.total_cylinders)
      );
      setHasDigitalTypes(hasDigital);
      setHasExternalTypes(hasExternal);

      // Category distribution grouped by Capaciteit (cylinder size)
      const catMap = new Map<string, number>();
      for (const row of currentRows) {
        const cap = row.Capaciteit != null ? `${row.Capaciteit}L` : "Onbekend";
        catMap.set(cap, (catMap.get(cap) || 0) + (row.Aantal || 0));
      }
      setGasCategoryDistributionData(
        Array.from(catMap.entries())
          .map(([cat, total]) => ({ category_id: null, category_name: cat, total_cylinders: total }))
          .sort((a, b) => b.total_cylinders - a.total_cylinders)
      );

      // Customer totals grouped by Klant
      const custMap = new Map<string, number>();
      for (const row of currentRows) {
        const name = row.Klant || "Onbekend";
        custMap.set(name, (custMap.get(name) || 0) + (row.Aantal || 0));
      }
      setCustomerTotals(
        Array.from(custMap.entries())
          .map(([name, total]) => ({ customer_id: null, customer_name: name, total_cylinders: total, total_dry_ice_kg: 0 }))
          .sort((a, b) => b.total_cylinders - a.total_cylinders)
      );

      setCylinderOrders([]);
      setDryIceOrders([]);
    } catch (error) {
      console.error("[ProductionReports] Error fetching report data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to calculate trend percentage
  const calculateTrend = (current: number, previous: number): number | null => {
    if (previous === 0) return null;
    const pct = Math.round(((current - previous) / previous) * 100);
    return Math.max(-500, Math.min(500, pct));
  };

  const setPresetRange = (preset: string) => {
    const now = new Date();
    switch (preset) {
      case "mtd":
        setDateRange({ from: startOfMonth(now), to: now });
        break;
      case "week":
        setDateRange({ from: startOfWeek(now, { weekStartsOn: 1 }), to: endOfWeek(now, { weekStartsOn: 1 }) });
        break;
      case "month":
        setDateRange({ from: startOfMonth(now), to: endOfMonth(now) });
        break;
      case "last-month":
        const lastMonth = subMonths(now, 1);
        setDateRange({ from: startOfMonth(lastMonth), to: endOfMonth(lastMonth) });
        break;
      case "quarter":
        setDateRange({ from: subMonths(startOfMonth(now), 2), to: endOfMonth(now) });
        break;
      case "last-year":
        const lastYear = subYears(now, 1);
        setDateRange({ from: startOfYear(lastYear), to: endOfYear(lastYear) });
        break;
      case "this-year":
        setDateRange({ from: startOfYear(now), to: now });
        break;
    }
  };

  const getActivePreset = (): string => {
    const now = new Date();
    const { from, to } = dateRange;

    // MTD: month start to today (must check before "month" because of overlap on last day)
    if (isSameDay(from, startOfMonth(now)) && isSameDay(to, new Date(now.getFullYear(), now.getMonth(), now.getDate()))) {
      if (!isSameDay(to, endOfMonth(now))) return "mtd";
    }
    if (isSameDay(from, startOfWeek(now, { weekStartsOn: 1 })) && isSameDay(to, endOfWeek(now, { weekStartsOn: 1 }))) return "week";
    if (isSameDay(from, startOfMonth(now)) && isSameDay(to, endOfMonth(now))) return "month";
    const lastMonth = subMonths(now, 1);
    if (isSameDay(from, startOfMonth(lastMonth)) && isSameDay(to, endOfMonth(lastMonth))) return "last-month";
    if (isSameDay(from, subMonths(startOfMonth(now), 2)) && isSameDay(to, endOfMonth(now))) return "quarter";

    // Last year
    const lastYear = subYears(now, 1);
    if (isSameDay(from, startOfYear(lastYear)) && isSameDay(to, endOfYear(lastYear))) return "last-year";

    // This year (YTD: Jan 1 to any date this year)
    if (isSameDay(from, startOfYear(now)) && from.getFullYear() === to.getFullYear() && to.getFullYear() === now.getFullYear()) return "this-year";

    return "";
  };

  // Calculate statistics from RPC data
  const cylinderStats = useMemo(() => ({
    total: cylinderEfficiency?.total_orders || 0,
    completed: cylinderEfficiency?.completed_orders || 0,
    pending: cylinderEfficiency?.pending_orders || 0,
    inProgress: 0,
    cancelled: cylinderEfficiency?.cancelled_orders || 0,
    totalCylinders: cylinderEfficiency?.total_cylinders || 0
  }), [cylinderEfficiency]);

  const dryIceStats = useMemo(() => ({
    total: dryIceEfficiency?.total_orders || 0,
    completed: dryIceEfficiency?.completed_orders || 0,
    pending: dryIceEfficiency?.pending_orders || 0,
    inProgress: 0,
    cancelled: dryIceEfficiency?.cancelled_orders || 0,
    totalKg: dryIceEfficiency?.total_kg || 0
  }), [dryIceEfficiency]);

  // Prev year daily data (by day-offset index from prev period start)
  const [prevDailyByOffset, setPrevDailyByOffset] = useState<number[]>([]);
  // Location split for KPI (emmen/tilburg cylinders)
  const [locationSplit, setLocationSplit] = useState<{ emmen: number; tilburg: number }>({ emmen: 0, tilburg: 0 });
  // Chart toggles
  const [showPrevYear, setShowPrevYear] = useState(false);
  const [cumulativeChart, setCumulativeChart] = useState(false);

  // Detect YTD mode: period starts on Jan 1 of current year and ends today or earlier
  const isYtdMode = useMemo(() => {
    const now = new Date();
    return dateRange.from.getMonth() === 0 && dateRange.from.getDate() === 1
      && dateRange.to.getFullYear() === dateRange.from.getFullYear()
      && dateRange.to <= now;
  }, [dateRange]);

  // Prepare chart data from RPC response
  const ordersPerDay = useMemo(() => {
    return dailyProduction.map((item, idx) => ({
      date: item.production_date,
      cylinders: Number(item.cylinder_count) || 0,
      dryIce: Number(item.dry_ice_kg) || 0,
      displayDate: format(new Date(item.production_date), "d MMM", { locale: nl }),
      prevCylinders: prevDailyByOffset[idx] || 0,
    }));
  }, [dailyProduction, prevDailyByOffset]);

  // Chart data: cumulative running totals when cumulativeChart is on
  const chartData = useMemo(() => {
    if (!cumulativeChart) return ordersPerDay.map(d => ({ ...d, targetRamp: undefined as number | undefined }));
    let yearTarget = 0;
    if (isYtdMode) {
      try {
        const yearStr = String(dateRange.from.getFullYear());
        const stored = localStorage.getItem(`yearly-targets-${yearStr}`);
        if (stored) {
          const t = JSON.parse(stored);
          yearTarget = location === "sol_emmen" ? (t.emmen || 0)
            : location === "sol_tilburg" ? (t.tilburg || 0)
            : (t.emmen || 0) + (t.tilburg || 0);
        }
      } catch {}
    }
    // Build prefix sum over ALL calendar days so weekends/holidays are included in prev-year cumulative
    const prevPrefix: number[] = [];
    { let s = 0; for (const v of prevDailyByOffset) { s += v; prevPrefix.push(s); } }
    let cumCyl = 0;
    return ordersPerDay.map((d, i) => {
      cumCyl += d.cylinders;
      // Calendar offset from period start → use ISO string to avoid local/UTC timezone mismatch
      const periodStartIso = format(dateRange.from, "yyyy-MM-dd");
      const calOffset = differenceInDays(new Date(d.date), new Date(periodStartIso));
      const cumPrev = calOffset >= 0 && calOffset < prevPrefix.length ? prevPrefix[calOffset] : 0;
      const targetRamp = yearTarget > 0 ? Math.round((yearTarget / 365) * (i + 1)) : undefined;
      return { ...d, cylinders: cumCyl, prevCylinders: cumPrev, targetRamp };
    });
  }, [ordersPerDay, cumulativeChart, isYtdMode, dateRange.from, location, prevDailyByOffset]);

  // Check if dry ice data is all zeros (hide from chart when irrelevant)
  const hasDryIceData = useMemo(() => {
    return ordersPerDay.some(d => d.dryIce > 0);
  }, [ordersPerDay]);

  // Gas type distribution from RPC (already aggregated)
  const gasTypeDistribution = useMemo(() => {
    let filtered = gasTypeDistributionData;
    if (hideDigital) filtered = filtered.filter(item => !item.is_digital);
    if (hideExternal) filtered = filtered.filter(item => !item.is_external);
    
    return filtered.map(item => {
      const name = item.gas_type_name || "";
      const color = getGasColor(name, item.gas_type_color || "#8b5cf6");

      return {
        name: item.is_digital ? `${item.gas_type_name} ⓓ` : item.gas_type_name,
        value: Number(item.total_cylinders) || 0,
        color,
        is_digital: item.is_digital,
      };
    });
  }, [gasTypeDistributionData, hideDigital]);

  // Digital vs physical cylinder totals
  const digitalPhysicalSplit = useMemo(() => {
    const digital = gasTypeDistributionData
      .filter(item => item.is_digital)
      .reduce((sum, item) => sum + (Number(item.total_cylinders) || 0), 0);
    const physical = gasTypeDistributionData
      .filter(item => !item.is_digital)
      .reduce((sum, item) => sum + (Number(item.total_cylinders) || 0), 0);
    const total = digital + physical;
    const digitalPercent = total > 0 ? Math.round((digital / total) * 100) : 0;
    const physicalPercent = total > 0 ? Math.round((physical / total) * 100) : 0;
    return { digital, physical, total, digitalPercent, physicalPercent };
  }, [gasTypeDistributionData]);

  // Gas category distribution from RPC (already aggregated)
  const gasCategoryDistribution = useMemo(() => {
    return gasCategoryDistributionData.map(item => ({
      name: item.category_name,
      value: Number(item.total_cylinders) || 0,
      color: "#8b5cf6" // Default color for categories (purple)
    }));
  }, [gasCategoryDistributionData]);

  // Determine which distribution data to show, limiting to top items
  const [showAllDistribution, setShowAllDistribution] = useState(false);
  const MAX_DISTRIBUTION_ITEMS = 8;

  const currentDistributionData = useMemo(() => {
    const raw = distributionView === "type" ? gasTypeDistribution : gasCategoryDistribution;
    const sorted = [...raw].sort((a, b) => b.value - a.value);

    if (showAllDistribution || sorted.length <= MAX_DISTRIBUTION_ITEMS) return sorted;

    const top = sorted.slice(0, MAX_DISTRIBUTION_ITEMS);
    const rest = sorted.slice(MAX_DISTRIBUTION_ITEMS);
    const otherValue = rest.reduce((sum, item) => sum + item.value, 0);
    if (otherValue > 0) {
      top.push({ name: `Overige (${rest.length})`, value: otherValue, color: "#9ca3af" });
    }
    return top;
  }, [distributionView, gasTypeDistribution, gasCategoryDistribution, showAllDistribution]);

  // Build tab-specific export data
  const activeExportData = useMemo(() => {
    const periodLabel = `${format(dateRange.from, "d MMM yyyy", { locale: nl })} – ${format(dateRange.to, "d MMM yyyy", { locale: nl })}`;
    const locLabel = location === "all" ? "Alle locaties" : location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg";

    if (activeTab === "cylinders") {
      return {
        title: "Cilinder maten",
        subtitle: `${locLabel} | ${periodLabel}`,
        columns: [
          { header: "Maat", key: "size", width: 15 },
          { header: "Cilinders", key: "total", width: 12 },
          { header: "%", key: "pct", width: 8 },
        ] as { header: string; key: string; width?: number }[],
        rows: (() => {
          const totalCyl = gasCategoryDistributionData.reduce((s, r) => s + r.total_cylinders, 0);
          return gasCategoryDistributionData.map(r => ({
            size: r.category_name,
            total: r.total_cylinders,
            pct: totalCyl > 0 ? `${Math.round((r.total_cylinders / totalCyl) * 100)}%` : "0%",
          }));
        })(),
        dateRange: { from: dateRange.from, to: dateRange.to },
        location: locLabel,
      };
    }

    if (activeTab === "insights") {
      return {
        title: "Dagelijkse productie",
        subtitle: `${locLabel} | ${periodLabel}`,
        columns: [
          { header: "Datum", key: "date", width: 14 },
          { header: "Cilinders", key: "cylinders", width: 12 },
        ] as { header: string; key: string; width?: number }[],
        rows: dailyProduction.map(d => ({ date: d.production_date, cylinders: d.cylinder_count })),
        dateRange: { from: dateRange.from, to: dateRange.to },
        location: locLabel,
      };
    }

    if (activeTab === "locations") {
      return {
        title: "Locatieverdeling",
        subtitle: `${periodLabel}`,
        columns: [
          { header: "Locatie", key: "loc", width: 20 },
          { header: "Cilinders", key: "total", width: 12 },
          { header: "%", key: "pct", width: 8 },
        ] as { header: string; key: string; width?: number }[],
        rows: (() => {
          const tot = locationSplit.emmen + locationSplit.tilburg;
          return [
            { loc: "SOL Emmen", total: locationSplit.emmen, pct: tot > 0 ? `${Math.round((locationSplit.emmen / tot) * 100)}%` : "0%" },
            { loc: "SOL Tilburg", total: locationSplit.tilburg, pct: tot > 0 ? `${Math.round((locationSplit.tilburg / tot) * 100)}%` : "0%" },
            { loc: "Totaal", total: tot, pct: "100%" },
          ];
        })(),
        dateRange: { from: dateRange.from, to: dateRange.to },
        location: locLabel,
      };
    }

    // Default: gas type distribution (overview, productie, comparison)
    return {
      title: "Gastype verdeling",
      subtitle: `${locLabel} | ${periodLabel}`,
      columns: [
        { header: "Gastype", key: "name", width: 25 },
        { header: "Cilinders", key: "total", width: 12 },
        { header: "%", key: "pct", width: 8 },
      ] as { header: string; key: string; width?: number }[],
      rows: (() => {
        const filtered = gasTypeDistributionData.filter(r => (!hideDigital || !r.is_digital) && (!hideExternal || !r.is_external));
        const totalCyl = filtered.reduce((s, r) => s + r.total_cylinders, 0);
        return filtered.map(r => ({
          name: r.gas_type_name,
          total: r.total_cylinders,
          pct: totalCyl > 0 ? `${Math.round((r.total_cylinders / totalCyl) * 100)}%` : "0%",
        }));
      })(),
      dateRange: { from: dateRange.from, to: dateRange.to },
      location: locLabel,
    };
  }, [activeTab, gasTypeDistributionData, gasCategoryDistributionData, dailyProduction, locationSplit, dateRange, location, hideDigital, hideExternal]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-14 w-full bg-muted/20 animate-pulse rounded-lg" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCardSkeleton count={4} />
        </div>
        <ChartSkeleton height={350} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Compact Toolbar */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center bg-card/60 backdrop-blur-md border rounded-lg p-2 shadow-sm sticky top-0 z-10">
        <div className="flex flex-wrap items-center gap-2">
          {/* Periode preset dropdown */}
          <Select value={getActivePreset() || "custom"} onValueChange={(val) => val !== "custom" && setPresetRange(val)}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue placeholder="Kies periode" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">Deze week</SelectItem>
              <SelectItem value="mtd">Maand t/m vandaag</SelectItem>
              <SelectItem value="month">Deze maand</SelectItem>
              <SelectItem value="last-month">Vorige maand</SelectItem>
              <SelectItem value="quarter">Kwartaal</SelectItem>
              <SelectItem value="last-year">Vorig jaar</SelectItem>
              <SelectItem value="this-year">Dit jaar</SelectItem>
              {getActivePreset() === "" && <SelectItem value="custom">Aangepast</SelectItem>}
            </SelectContent>
          </Select>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-9 px-3 gap-2 font-medium">
                <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-sm">
                  {format(dateRange.from, "d MMM", { locale: nl })} – {format(dateRange.to, "d MMM yyyy", { locale: nl })}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  } else if (range?.from) {
                    setDateRange({ from: range.from, to: range.from });
                  }
                }}
                locale={nl}
                numberOfMonths={2}
                defaultMonth={dateRange.from}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>
          {isYtdMode && (
            <Badge variant="outline" className="text-[10px] h-7 px-2 text-primary border-primary/40 font-medium">
              YTD vs. vorig jaar
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasDigitalTypes && (
            <Button
              variant={hideDigital ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setHideDigital(!hideDigital)}
            >
              <Sparkles className="h-3 w-3" />
              {hideDigital ? "Toon digitaal" : "Verberg digitaal"}
            </Button>
          )}
          {hasExternalTypes && (
            <Button
              variant={hideExternal ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setHideExternal(!hideExternal)}
            >
              <EyeOff className="h-3 w-3" />
              {hideExternal ? "Toon extern" : "Verberg extern"}
            </Button>
          )}
          <ReportExportButtons
            tableData={activeExportData}
            chartElementId={activeTab === "overview" ? "production-chart" : undefined}
            chartTitle={activeTab === "overview" ? "Productie Grafiek" : undefined}
            chartOptions={{
              dateRange: { from: dateRange.from, to: dateRange.to },
              location: location === "all" ? "Alle locaties" : location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg",
            }}
          />
        </div>
      </div>

      {/* Digital vs Physical split */}
      {hasDigitalTypes && digitalPhysicalSplit.total > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            value={formatNumber(digitalPhysicalSplit.physical, 0)}
            label={`Fysieke cilinders (${digitalPhysicalSplit.physicalPercent}%)`}
            icon={<Cylinder className="h-4 w-4 text-orange-500" />}
            iconBgColor="bg-orange-500/10"
            className="border-orange-500/20 shadow-sm"
          />
          <StatCard
            value={formatNumber(digitalPhysicalSplit.digital, 0)}
            label={`Digitale cilinders (${digitalPhysicalSplit.digitalPercent}%)`}
            icon={<Sparkles className="h-4 w-4 text-sky-500" />}
            iconBgColor="bg-sky-500/10"
            className="border-sky-500/20 shadow-sm"
          />
        </div>
      )}

      {/* Primary KPI Stats */}
      <div className="flex overflow-x-auto scrollbar-none gap-3 pb-1 sm:grid sm:grid-cols-3 lg:grid-cols-6 sm:overflow-visible">
        <StatCard
          value={formatNumber(cylinderStats.total, 0)}
          label="Cilinder orders"
          icon={<Cylinder className="h-4 w-4 text-orange-500" />}
          iconBgColor="bg-orange-500/10"
          trend={{
            value: calculateTrend(cylinderStats.total, previousPeriodStats.cylinderOrders),
            label: "vs. vorige periode"
          }}
          className="border-orange-500/20 shadow-sm min-w-[160px] sm:min-w-0"
        />

        <StatCard
          value={formatNumber(hideDigital ? cylinderStats.totalCylinders - digitalPhysicalSplit.digital : cylinderStats.totalCylinders, 0)}
          label={
            <span className="flex items-center gap-1.5">
              {hideDigital ? "Fysieke cilinders" : "Totaal cilinders"}
              {hideDigital && hasDigitalTypes && (
                <span className="inline-flex items-center text-[9px] px-1 py-0 rounded border border-sky-400/40 text-sky-500 bg-sky-400/10 font-normal leading-tight">Alleen fysiek</span>
              )}
            </span>
          }
          icon={<Package className="h-4 w-4 text-orange-500" />}
          iconBgColor="bg-orange-500/10"
          trend={{
            value: calculateTrend(
              hideDigital ? cylinderStats.totalCylinders - digitalPhysicalSplit.digital : cylinderStats.totalCylinders,
              previousPeriodStats.totalCylinders
            ),
            label: "vs. vorige periode"
          }}
          className="border-orange-500/20 shadow-sm min-w-[160px] sm:min-w-0"
        />

        {showDryIce && (
          <>
            <StatCard
              value={formatNumber(dryIceStats.total, 0)}
              label="Droogijs orders"
              icon={<Snowflake className="h-4 w-4 text-cyan-500" />}
              iconBgColor="bg-cyan-500/10"
              trend={{
                value: calculateTrend(dryIceStats.total, previousPeriodStats.dryIceOrders),
                label: "vs. vorige periode"
              }}
              className="border-cyan-500/20 shadow-sm min-w-[160px] sm:min-w-0"
            />

            <StatCard
              value={`${formatNumber(dryIceStats.totalKg, 0)} kg`}
              label="Totaal droogijs"
              icon={<TrendingUp className="h-4 w-4 text-cyan-500" />}
              iconBgColor="bg-cyan-500/10"
              trend={{
                value: calculateTrend(dryIceStats.totalKg, previousPeriodStats.totalDryIce),
                label: "vs. vorige periode"
              }}
              className="border-cyan-500/20 shadow-sm min-w-[160px] sm:min-w-0"
            />
          </>
        )}

        <StatCard
          value={formatNumber(cylinderStats.completed + dryIceStats.completed, 0)}
          label="Voltooid"
          icon={<CheckCircle2 className="h-4 w-4 text-green-500" />}
          iconBgColor="bg-green-500/10"
          trend={{
            value: calculateTrend(cylinderStats.completed + dryIceStats.completed, previousPeriodStats.completed),
            label: "vs. vorige periode"
          }}
          className="border-green-500/20 shadow-sm min-w-[160px] sm:min-w-0"
        />

        <StatCard
          value={formatNumber(cylinderStats.pending + dryIceStats.pending, 0)}
          label="Gepland"
          icon={<Clock className="h-4 w-4 text-yellow-500" />}
          iconBgColor="bg-yellow-500/10"
          trend={{
            value: calculateTrend(cylinderStats.pending + dryIceStats.pending, previousPeriodStats.pending),
            label: "vs. vorige periode"
          }}
          className="border-yellow-500/20 shadow-sm min-w-[160px] sm:min-w-0"
        />
      </div>

      {/* Locatie uitsplitsing — shown when location is "all" and data loaded */}
      {location === "all" && (locationSplit.emmen > 0 || locationSplit.tilburg > 0) && (() => {
        const total = locationSplit.emmen + locationSplit.tilburg;
        const emmenPct = total > 0 ? Math.round((locationSplit.emmen / total) * 100) : 0;
        const tilburgPct = total > 0 ? 100 - emmenPct : 0;
        return (
          <div className="flex items-center gap-3 px-1 text-xs text-muted-foreground">
            <span className="shrink-0 font-medium">Verdeling locaties:</span>
            <div className="flex-1 flex items-center h-2 rounded-full overflow-hidden bg-muted/30">
              <div className="h-full bg-orange-500/70 transition-all" style={{ width: `${emmenPct}%` }} />
              <div className="h-full bg-blue-500/70 transition-all" style={{ width: `${tilburgPct}%` }} />
            </div>
            <span className="shrink-0 flex items-center gap-3">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-orange-500/80 shrink-0" />
                Emmen {formatNumber(locationSplit.emmen, 0)} ({emmenPct}%)
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500/80 shrink-0" />
                Tilburg {formatNumber(locationSplit.tilburg, 0)} ({tilburgPct}%)
              </span>
            </span>
          </div>
        );
      })()}

      {/* Detailed Tabs & Dashboard — sidebar layout */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="flex flex-col md:flex-row gap-4 items-start">
          {/* Sidebar navigation */}
          <TabsList className="flex md:flex-col h-auto w-full md:w-44 bg-card border shadow-sm rounded-xl p-1.5 gap-0.5 overflow-x-auto md:overflow-x-visible scrollbar-none md:shrink-0 md:sticky md:top-[4.5rem]">
            <TabsTrigger value="overview" className="text-sm gap-2 justify-start w-auto md:w-full px-3 py-2 shrink-0">
              <BarChart3 className="h-4 w-4 shrink-0" />
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="productie" className="text-sm gap-2 justify-start w-auto md:w-full px-3 py-2 shrink-0">
              <CalendarIcon className="h-4 w-4 shrink-0" />
              Productie
            </TabsTrigger>
            <TabsTrigger value="insights" className="text-sm gap-2 justify-start w-auto md:w-full px-3 py-2 shrink-0">
              <Sparkles className="h-4 w-4 shrink-0" />
              Insights
            </TabsTrigger>
            <TabsTrigger value="cylinders" className="text-sm gap-2 justify-start w-auto md:w-full px-3 py-2 shrink-0">
              <Cylinder className="h-4 w-4 shrink-0" />
              Cilinders
            </TabsTrigger>
            <TabsTrigger value="locations" className="text-sm gap-2 justify-start w-auto md:w-full px-3 py-2 shrink-0">
              <Building2 className="h-4 w-4 shrink-0" />
              Locaties
            </TabsTrigger>
            <TabsTrigger value="comparison" className="text-sm gap-2 justify-start w-auto md:w-full px-3 py-2 shrink-0">
              <GitCompare className="h-4 w-4 shrink-0" />
              Vergelijking
            </TabsTrigger>
          </TabsList>

          {/* Content area */}
          <div className="flex-1 min-w-0 w-full">
        <TabsContent value="overview" className="mt-0 space-y-4">
          {/* Dashboard Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Main Chart - Spans 2 cols */}
            <Card className="lg:col-span-2 shadow-sm" id="production-chart">
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base font-medium">Productie per dag</CardTitle>
                    {isYtdMode && (
                      <Badge variant="outline" className="text-[10px] h-5 text-primary border-primary/40">YTD</Badge>
                    )}
                    {cumulativeChart && (
                      <Badge variant="outline" className="text-[10px] h-5 text-amber-600 border-amber-400/40">Cumulatief</Badge>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Button
                      variant={showPrevYear ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setShowPrevYear(!showPrevYear)}
                    >
                      <TrendingUp className="h-3 w-3" />
                      Vorig jaar
                    </Button>
                    <Button
                      variant={cumulativeChart ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setCumulativeChart(!cumulativeChart)}
                    >
                      <TrendingUp className="h-3 w-3" />
                      Cumulatief
                    </Button>
                    {showDryIce && hasDryIceData ? (
                      <ToggleGroup type="single" value={productionChartView} onValueChange={(v) => v && setProductionChartView(v as any)} size="sm">
                        <ToggleGroupItem value="both" size="sm" className="h-7 text-xs">Beide</ToggleGroupItem>
                        <ToggleGroupItem value="cylinders" size="sm" className="h-7 text-xs">Cilinders</ToggleGroupItem>
                        <ToggleGroupItem value="dryIce" size="sm" className="h-7 text-xs">Droogijs</ToggleGroupItem>
                      </ToggleGroup>
                    ) : (
                      <span className="text-xs text-muted-foreground px-2 h-7 flex items-center">Cilinders</span>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {ordersPerDay.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <ComposedChart data={chartData}>
                      <defs>
                        <linearGradient id="gradientCylinders" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#f97316" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradientDryIce" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="gradientPrevYear" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#94a3b8" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#94a3b8" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                      <XAxis dataKey="displayDate" className="text-xs" tickLine={false} axisLine={false} />
                      <YAxis className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} tickLine={false} axisLine={false} domain={[(dataMin: number) => Math.max(0, Math.floor(dataMin * 0.85)), 'auto']} />
                      {/* Weekend shading */}
                      {chartData.map((item, idx) => {
                        const d = new Date(item.date);
                        const day = d.getDay();
                        if (day === 0 || day === 6) {
                          return (
                            <ReferenceArea
                              key={`weekend-${idx}`}
                              x1={item.displayDate}
                              x2={item.displayDate}
                              fill="hsl(var(--muted))"
                              fillOpacity={0.5}
                              stroke="none"
                            />
                          );
                        }
                        return null;
                      })}
                      <Tooltip
                        contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", backgroundColor: "hsl(var(--background))", padding: "10px 14px", fontSize: "13px" }}
                        labelStyle={{ fontWeight: 600, marginBottom: 4, color: "hsl(var(--foreground))" }}
                        itemStyle={{ padding: "2px 0" }}
                      />
                      <Legend />
                      {/* Prev year ghost area */}
                      {showPrevYear && (productionChartView === "both" || productionChartView === "cylinders") && (
                        <Area type="monotone" dataKey="prevCylinders" name={`Vorig jaar cilinders`} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 2" fill="url(#gradientPrevYear)" dot={false} activeDot={{ r: 3 }} />
                      )}
                      {/* Current year areas */}
                      {(productionChartView === "both" || productionChartView === "cylinders") && (
                        <Area type="monotone" dataKey="cylinders" name="Cilinders" stroke="#f97316" strokeWidth={2} fill="url(#gradientCylinders)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
                      )}
                      {(productionChartView === "both" || productionChartView === "dryIce") && hasDryIceData && (
                        <Area type="monotone" dataKey="dryIce" name="Droogijs" stroke="#06b6d4" strokeWidth={2} fill="url(#gradientDryIce)" dot={false} activeDot={{ r: 4, strokeWidth: 2 }} />
                      )}
                      {/* Target ramp line (cumulative mode only) */}
                      {cumulativeChart && chartData.some(d => d.targetRamp !== undefined) && (
                        <Area type="linear" dataKey="targetRamp" name="Doelstelling" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 3" fill="none" dot={false} activeDot={false} legendType="plainline" />
                      )}
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[300px] text-muted-foreground text-sm">
                    <div className="text-center">
                      <BarChart3 className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                      <p>Geen productiedata voor deze periode</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Distribution Chart - Spans 1 col */}
            <Card className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base font-medium">Verdeling</CardTitle>
                <div className="flex items-center gap-2">
                  {hasDigitalTypes && distributionView === "type" && (
                    <Button
                      variant={hideDigital ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setHideDigital(!hideDigital)}
                    >
                      ⓓ {hideDigital ? "Toon digitaal" : "Verberg digitaal"}
                    </Button>
                  )}
                  <ToggleGroup type="single" value={distributionView} onValueChange={(v) => v && setDistributionView(v as any)} size="sm">
                    <ToggleGroupItem value="type" size="sm" className="h-7 text-xs">Type</ToggleGroupItem>
                    <ToggleGroupItem value="category" size="sm" className="h-7 text-xs">Cat</ToggleGroupItem>
                  </ToggleGroup>
                </div>
              </CardHeader>
              <CardContent>
                {currentDistributionData.length > 0 ? (
                  <>
                  <ResponsiveContainer width="100%" height={Math.max(280, currentDistributionData.length * 32)}>
                    <BarChart data={currentDistributionData} layout="vertical" margin={{ left: 10, right: 50 }}>
                      <XAxis type="number" hide />
                      <YAxis dataKey="name" type="category" width={110} className="text-[11px]" tickLine={false} axisLine={false} interval={0} />
                      <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", boxShadow: "0 4px 16px rgba(0,0,0,0.1)", backgroundColor: "hsl(var(--background))", padding: "10px 14px", fontSize: "13px" }} />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                        {currentDistributionData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                        <LabelList dataKey="value" position="right" className="text-[11px] font-medium fill-foreground" formatter={(v: number) => formatNumber(v, 0)} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {(distributionView === "type" ? gasTypeDistribution : gasCategoryDistribution).length > MAX_DISTRIBUTION_ITEMS && (
                    <button
                      onClick={() => setShowAllDistribution(!showAllDistribution)}
                      className="flex items-center gap-1 mx-auto mt-2 text-xs text-primary hover:text-primary/80 font-medium border border-primary/30 rounded-md px-3 py-1.5 hover:bg-primary/5 transition-colors"
                      type="button"
                    >
                      {showAllDistribution ? (
                        <><ChevronUp className="h-3 w-3" />Toon minder</>
                      ) : (
                        <><ChevronDown className="h-3 w-3" />Toon alle {(distributionView === "type" ? gasTypeDistribution : gasCategoryDistribution).length} types</>
                      )}
                    </button>
                  )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-[280px] text-muted-foreground text-sm">
                    <Cylinder className="h-8 w-8 mb-2 text-muted-foreground/40" />
                    <p>Geen verdelingsdata voor deze periode</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Additional Widgets Row could go here */}
          </div>
        </TabsContent>

        {/* Productie: Maand / Jaar sub-toggle */}
        <TabsContent value="productie" className="mt-0 space-y-4">
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={productieView === "monthly" ? "default" : "outline"}
              className="h-8 text-xs px-4"
              onClick={() => setProductieView("monthly")}
            >
              <CalendarIcon className="h-3.5 w-3.5 mr-1.5" />
              Maand
            </Button>
            <Button
              size="sm"
              variant={productieView === "yearly" ? "default" : "outline"}
              className="h-8 text-xs px-4"
              onClick={() => setProductieView("yearly")}
            >
              <BarChart3 className="h-3.5 w-3.5 mr-1.5" />
              Jaar
            </Button>
          </div>
          <Suspense fallback={<ChartLoadingFallback />}>
            {productieView === "monthly" ? (
              <MonthlyReport hideDigital={hideDigital} />
            ) : (
              <YearlyReport hideDigital={hideDigital} />
            )}
          </Suspense>
        </TabsContent>

        {/* Other tabs content placeholders (using existing components) */}
        <TabsContent value="insights" className="mt-0">
          <Suspense fallback={<ChartLoadingFallback />}>
            <CustomerSegmentation
              location={location}
              refreshKey={refreshKey}
              dateRange={dateRange}
              hideDigital={hideDigital}
              hasDigitalTypes={hasDigitalTypes}
            />
          </Suspense>
        </TabsContent>

        <TabsContent value="cylinders" className="mt-0 space-y-4">
          <Suspense fallback={<ChartLoadingFallback />}>
            <CumulativeGasTypeChart
              location={location === "all" ? undefined : location}
              hideDigital={hideDigital}
              hasDigitalTypes={hasDigitalTypes}
            />
            <CumulativeCylinderSizeChart
              location={location === "all" ? undefined : location}
              hideDigital={hideDigital}
              hasDigitalTypes={hasDigitalTypes}
            />
            <ProductionHeatMap
              location={location}
              refreshKey={refreshKey}
              dateRange={dateRange}
              hideDigital={hideDigital}
              hasDigitalTypes={hasDigitalTypes}
            />
          </Suspense>
        </TabsContent>


        <TabsContent value="locations" className="mt-0">
          <Suspense fallback={<ChartLoadingFallback />}>
            <LocationComparisonReport hideDigital={hideDigital} onHideDigitalChange={setHideDigital} />
          </Suspense>
        </TabsContent>

        <TabsContent value="comparison" className="mt-0">
          <Suspense fallback={<ChartLoadingFallback />}>
            <YearComparisonReport location={location === "all" ? null : location} hideDigital={hideDigital} onHideDigitalChange={setHideDigital} />
          </Suspense>
        </TabsContent>

          </div>
        </div>
      </Tabs>
    </div>
  );
}
