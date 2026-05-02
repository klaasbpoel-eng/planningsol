import React, { useState, useEffect, useMemo, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2, TrendingUp, TrendingDown, Minus, Cylinder, Sparkles, Calendar, RefreshCw, Download } from "lucide-react";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getGasColor } from "@/constants/gasColors";
import { supabase } from "@/integrations/supabase/client";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  LabelList,
  LineChart,
  Line,
} from "recharts";

const MONTH_NAMES = [
  "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

interface MonthlyLocationData {
  monthName: string;
  month: number;
  emmen: number;
  tilburg: number;
  total: number;
}

interface GasTypeLocationData {
  gas_type_name: string;
  gas_type_color: string;
  gas_type_id?: string;
  is_digital?: boolean;
  emmen: number;
  tilburg: number;
  total: number;
  emmen_prev?: number;
  tilburg_prev?: number;
  total_prev?: number;
}

interface LocationComparisonReportProps {
  hideDigital?: boolean;
  onHideDigitalChange?: (value: boolean) => void;
}

export const LocationComparisonReport = React.memo(function LocationComparisonReport({ hideDigital: externalHideDigital, onHideDigitalChange }: LocationComparisonReportProps) {
  const hideDigital = externalHideDigital ?? false;
  const setHideDigital = (val: boolean) => onHideDigitalChange?.(val);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const exportPDF = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const [html2canvas, { default: jsPDF }] = await Promise.all([
        import("html2canvas").then(m => m.default),
        import("jspdf"),
      ]);
      const canvas = await html2canvas(reportRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const margin = 10;
      const usableW = pageW - margin * 2;
      const imgH = (canvas.height / canvas.width) * usableW;
      let y = margin;
      let remaining = imgH;
      let srcY = 0;
      while (remaining > 0) {
        const sliceH = Math.min(remaining, pageH - margin * 2);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = (sliceH / usableW) * canvas.width;
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
        pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", margin, y, usableW, sliceH);
        remaining -= sliceH;
        srcY += sliceCanvas.height;
        if (remaining > 0) { pdf.addPage(); y = margin; }
      }
      const yr = selectedYear;
      const prev = showComparison ? `_vs${yr - 1}` : "";
      pdf.save(`locatievergelijking_${yr}${prev}.pdf`);
    } catch (e) {
      console.error("PDF export failed", e);
    } finally {
      setExporting(false);
    }
  };
  const currentYear = new Date().getFullYear();
  const todayMonth = new Date().getMonth() + 1;
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [ytdMode, setYtdMode] = useState<boolean>(true);
  const [showComparison, setShowComparison] = useState<boolean>(true);
  const [monthlyData, setMonthlyData] = useState<MonthlyLocationData[]>([]);
  const [prevMonthlyData, setPrevMonthlyData] = useState<MonthlyLocationData[]>([]);
  const [gasTypeData, setGasTypeData] = useState<GasTypeLocationData[]>([]);
  const [emmenTotal, setEmmenTotal] = useState(0);
  const [tilburgTotal, setTilburgTotal] = useState(0);
  const [hasDigitalTypes, setHasDigitalTypes] = useState(false);
  const [digitalGasTypeIds, setDigitalGasTypeIds] = useState<Set<string>>(new Set());

  const availableYears = useMemo(() => {
    const years: number[] = [];
    for (let y = currentYear + 1; y >= 2024; y--) years.push(y);
    return years;
  }, []);

  // Auto-enable YTD when switching to current year
  useEffect(() => {
    setYtdMode(selectedYear === currentYear);
  }, [selectedYear]);

  useEffect(() => {
    fetchData();
  }, [selectedYear, hideDigital]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Helper: paginate Productie table for a given year and location
      const PAGE = 1000;
      const fetchAllRowsForYear = async (year: number, locationParam: string): Promise<any[]> => {
        const locFilter = locationParam === "sol_emmen"
          ? "SOL Nederland-Depot Emmen"
          : "SOL Nederland-Tilburg";
        const allRows: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await (supabase.from("Productie" as never) as any)
            .select("Datum, Product, Aantal")
            .eq("Jaar", year)
            .eq("Locatie", locFilter)
            .order("id", { ascending: true })
            .range(from, from + PAGE - 1);
          if (error) break;
          if (!data || data.length === 0) break;
          allRows.push(...data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        return allRows;
      };

      // Helper: get month from a Datum field
      const getRowMonth = (row: any): number | null => {
        const raw = row.Datum;
        if (!raw) return null;
        const iso = raw.includes("T") ? raw.substring(0, 10) : raw;
        if (!iso || iso.length < 7) return null;
        return parseInt(iso.substring(5, 7));
      };

      // Fetch rows for both locations + previous year in parallel
      const prevYear = selectedYear - 1;
      const [emmenRows, tilburgRows, emmenRowsPrev, tilburgRowsPrev] = await Promise.all([
        fetchAllRowsForYear(selectedYear, "sol_emmen"),
        fetchAllRowsForYear(selectedYear, "sol_tilburg"),
        fetchAllRowsForYear(prevYear, "sol_emmen"),
        fetchAllRowsForYear(prevYear, "sol_tilburg"),
      ]);

      // Aggregate monthly totals per location
      const buildMonthlyMap = (rows: any[]): Map<number, number> => {
        const m = new Map<number, number>();
        for (const row of rows) {
          const month = getRowMonth(row);
          if (!month) continue;
          m.set(month, (m.get(month) || 0) + (Number(row.Aantal) || 0));
        }
        return m;
      };

      const emmenMap = buildMonthlyMap(emmenRows);
      const tilburgMap = buildMonthlyMap(tilburgRows);
      const emmenMapPrev = buildMonthlyMap(emmenRowsPrev);
      const tilburgMapPrev = buildMonthlyMap(tilburgRowsPrev);

      const monthly: MonthlyLocationData[] = MONTH_NAMES.map((name, idx) => {
        const m = idx + 1;
        const e = emmenMap.get(m) || 0;
        const t = tilburgMap.get(m) || 0;
        return { monthName: name, month: m, emmen: e, tilburg: t, total: e + t };
      });
      const monthlyPrev: MonthlyLocationData[] = MONTH_NAMES.map((name, idx) => {
        const m = idx + 1;
        const e = emmenMapPrev.get(m) || 0;
        const t = tilburgMapPrev.get(m) || 0;
        return { monthName: name, month: m, emmen: e, tilburg: t, total: e + t };
      });
      setMonthlyData(monthly);
      setPrevMonthlyData(monthlyPrev);
      setEmmenTotal(monthly.reduce((s, m) => s + m.emmen, 0));
      setTilburgTotal(monthly.reduce((s, m) => s + m.tilburg, 0));

      // No digital types from Productie
      setHasDigitalTypes(false);
      setDigitalGasTypeIds(new Set());

      // Aggregate gas type totals per location
      const buildGasMap = (rows: any[], loc: "emmen" | "tilburg"): Map<string, { emmen: number; tilburg: number }> => {
        const gasMap = new Map<string, { emmen: number; tilburg: number }>();
        for (const row of rows) {
          const name = row.Product || "Onbekend";
          const existing = gasMap.get(name) || { emmen: 0, tilburg: 0 };
          existing[loc] += Number(row.Aantal) || 0;
          gasMap.set(name, existing);
        }
        return gasMap;
      };

      const emmenGasMap = buildGasMap(emmenRows, "emmen");
      const tilburgGasMap = buildGasMap(tilburgRows, "tilburg");
      const emmenGasMapPrev = buildGasMap(emmenRowsPrev, "emmen");
      const tilburgGasMapPrev = buildGasMap(tilburgRowsPrev, "tilburg");

      // Merge current year maps
      const combinedGasMap = new Map<string, { emmen: number; tilburg: number }>();
      emmenGasMap.forEach((val, name) => { combinedGasMap.set(name, { emmen: val.emmen, tilburg: 0 }); });
      tilburgGasMap.forEach((val, name) => {
        const existing = combinedGasMap.get(name) || { emmen: 0, tilburg: 0 };
        existing.tilburg += val.tilburg;
        combinedGasMap.set(name, existing);
      });

      // Merge prev year maps
      const combinedGasMapPrev = new Map<string, { emmen: number; tilburg: number }>();
      emmenGasMapPrev.forEach((val, name) => { combinedGasMapPrev.set(name, { emmen: val.emmen, tilburg: 0 }); });
      tilburgGasMapPrev.forEach((val, name) => {
        const existing = combinedGasMapPrev.get(name) || { emmen: 0, tilburg: 0 };
        existing.tilburg += val.tilburg;
        combinedGasMapPrev.set(name, existing);
      });

      // Also ensure prev-year-only products appear in combined map
      combinedGasMapPrev.forEach((_, name) => {
        if (!combinedGasMap.has(name)) combinedGasMap.set(name, { emmen: 0, tilburg: 0 });
      });

      const gasData: GasTypeLocationData[] = Array.from(combinedGasMap.entries())
        .map(([name, vals]) => {
          const prev = combinedGasMapPrev.get(name) || { emmen: 0, tilburg: 0 };
          return {
            gas_type_name: name,
            gas_type_color: getGasColor(name, "#3b82f6"),
            is_digital: false,
            emmen: vals.emmen,
            tilburg: vals.tilburg,
            total: vals.emmen + vals.tilburg,
            emmen_prev: prev.emmen,
            tilburg_prev: prev.tilburg,
            total_prev: prev.emmen + prev.tilburg,
          };
        })
        .sort((a, b) => b.total - a.total);
      setGasTypeData(gasData);
    } catch (error) {
      console.error("Error fetching location comparison data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Filtered gas type data (hide digital)
  const filteredGasTypeData = useMemo(() => {
    if (!hideDigital) return gasTypeData;
    return gasTypeData.filter(gt => !gt.is_digital);
  }, [gasTypeData, hideDigital]);

  const digitalPhysicalSplit = useMemo(() => {
    const digital = gasTypeData.filter(gt => gt.is_digital).reduce((s, gt) => s + gt.total, 0);
    const physical = gasTypeData.filter(gt => !gt.is_digital).reduce((s, gt) => s + gt.total, 0);
    const total = digital + physical;
    return {
      digital, physical, total,
      digitalPercent: total > 0 ? Math.round((digital / total) * 100) : 0,
      physicalPercent: total > 0 ? Math.round((physical / total) * 100) : 0,
    };
  }, [gasTypeData]);

  // YTD-filtered monthly data: only months up to today when ytdMode is active
  const displayMonthlyData = useMemo(() => {
    if (!ytdMode) return monthlyData;
    return monthlyData.filter(m => m.month <= todayMonth);
  }, [monthlyData, ytdMode, todayMonth]);

  const displayEmmenTotal = useMemo(() => displayMonthlyData.reduce((s, m) => s + m.emmen, 0), [displayMonthlyData]);
  const displayTilburgTotal = useMemo(() => displayMonthlyData.reduce((s, m) => s + m.tilburg, 0), [displayMonthlyData]);

  // Filtered totals (recalculate when hiding digital) — declared after displayEmmen/Tilburg totals exist
  const filteredEmmenTotal = useMemo(() => {
    if (!hideDigital) return displayEmmenTotal;
    return filteredGasTypeData.reduce((s, gt) => s + gt.emmen, 0);
  }, [hideDigital, displayEmmenTotal, filteredGasTypeData]);

  const filteredTilburgTotal = useMemo(() => {
    if (!hideDigital) return displayTilburgTotal;
    return filteredGasTypeData.reduce((s, gt) => s + gt.tilburg, 0);
  }, [hideDigital, displayTilburgTotal, filteredGasTypeData]);

  const grandTotal = filteredEmmenTotal + filteredTilburgTotal;
  const emmenPercent = grandTotal > 0 ? Math.round((filteredEmmenTotal / grandTotal) * 100) : 0;
  const tilburgPercent = grandTotal > 0 ? Math.round((filteredTilburgTotal / grandTotal) * 100) : 0;

  // Previous year display data (same months as current YTD/full)
  const prevDisplayData = useMemo(() => {
    if (!ytdMode) return prevMonthlyData;
    return prevMonthlyData.filter(m => m.month <= todayMonth);
  }, [prevMonthlyData, ytdMode, todayMonth]);

  const prevEmmenTotal = useMemo(() => prevDisplayData.reduce((s, m) => s + m.emmen, 0), [prevDisplayData]);
  const prevTilburgTotal = useMemo(() => prevDisplayData.reduce((s, m) => s + m.tilburg, 0), [prevDisplayData]);
  const prevGrandTotal = prevEmmenTotal + prevTilburgTotal;

  // Merged chart data (current + prev year per month)
  const comparisonChartData = useMemo(() => {
    return displayMonthlyData.map((m, idx) => ({
      ...m,
      emmen_prev: prevDisplayData[idx]?.emmen || 0,
      tilburg_prev: prevDisplayData[idx]?.tilburg || 0,
    }));
  }, [displayMonthlyData, prevDisplayData]);

  const cumulativeData = useMemo(() => {
    let cumE = 0, cumT = 0, cumEP = 0, cumTP = 0;
    return displayMonthlyData.map((m, idx) => {
      cumE += m.emmen;
      cumT += m.tilburg;
      cumEP += prevDisplayData[idx]?.emmen || 0;
      cumTP += prevDisplayData[idx]?.tilburg || 0;
      return {
        monthName: m.monthName,
        cumEmmen: cumE, cumTilburg: cumT, cumTotal: cumE + cumT,
        cumEmmenPrev: cumEP, cumTilburgPrev: cumTP, cumTotalPrev: cumEP + cumTP,
      };
    });
  }, [displayMonthlyData, prevDisplayData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div ref={reportRef} className="space-y-6 bg-background p-1">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Locatievergelijking
          </h3>
          <p className="text-sm text-muted-foreground">
            Vergelijk cilindervullingen tussen SOL Emmen en SOL Tilburg
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm text-muted-foreground">Jaar:</span>
          <Select value={String(selectedYear)} onValueChange={(v) => setSelectedYear(Number(v))}>
            <SelectTrigger className="w-[100px] h-8">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableYears.map(y => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={ytdMode ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setYtdMode(!ytdMode)}
          >
            <Calendar className="h-3 w-3" />
            YTD
          </Button>
          <Button
            variant={showComparison ? "default" : "outline"}
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setShowComparison(!showComparison)}
          >
            vs {selectedYear - 1}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={exportPDF}
            disabled={exporting || loading}
            title="Download als PDF"
          >
            {exporting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
            {exporting ? "Bezig..." : "PDF"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={fetchData}
            disabled={loading}
            title="Data herladen"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          {hasDigitalTypes && (
            <Button
              variant={hideDigital ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs gap-1"
              onClick={() => setHideDigital(!hideDigital)}
            >
              ⓓ {hideDigital ? "Toon digitaal" : "Verberg digitaal"}
            </Button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      {(() => {
        const emmenDelta = prevEmmenTotal > 0 ? ((filteredEmmenTotal - prevEmmenTotal) / prevEmmenTotal) * 100 : null;
        const tilburgDelta = prevTilburgTotal > 0 ? ((filteredTilburgTotal - prevTilburgTotal) / prevTilburgTotal) * 100 : null;
        const totalDelta = prevGrandTotal > 0 ? ((grandTotal - prevGrandTotal) / prevGrandTotal) * 100 : null;
        const DeltaBadge = ({ delta }: { delta: number | null }) => {
          if (!showComparison || delta === null) return null;
          const pos = delta >= 0;
          return (
            <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${pos ? "text-emerald-600" : "text-red-500"}`}>
              {pos ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {pos ? "+" : ""}{delta.toFixed(1)}%
            </span>
          );
        };
        return (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="shadow-sm border-blue-500/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">SOL Emmen{hideDigital && hasDigitalTypes && (<span className="inline-flex items-center text-[9px] px-1 py-0 rounded border border-sky-400/40 text-sky-500 bg-sky-400/10 font-normal leading-tight">Alleen fysiek</span>)}</p>
                    <p className="text-2xl font-bold">{formatNumber(filteredEmmenTotal, 0)}</p>
                    {showComparison && prevEmmenTotal > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedYear - 1}: {formatNumber(prevEmmenTotal, 0)} <DeltaBadge delta={emmenDelta} /></p>
                    )}
                  </div>
                  <Badge variant="secondary" className="bg-blue-500/10 text-blue-600 border-blue-500/20">
                    {emmenPercent}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm border-sky-400/20">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">SOL Tilburg{hideDigital && hasDigitalTypes && (<span className="inline-flex items-center text-[9px] px-1 py-0 rounded border border-sky-400/40 text-sky-500 bg-sky-400/10 font-normal leading-tight">Alleen fysiek</span>)}</p>
                    <p className="text-2xl font-bold">{formatNumber(filteredTilburgTotal, 0)}</p>
                    {showComparison && prevTilburgTotal > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedYear - 1}: {formatNumber(prevTilburgTotal, 0)} <DeltaBadge delta={tilburgDelta} /></p>
                    )}
                  </div>
                  <Badge variant="secondary" className="bg-sky-400/10 text-sky-500 border-sky-400/20">
                    {tilburgPercent}%
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm">
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground flex items-center gap-1.5">Totaal{hideDigital && hasDigitalTypes && (<span className="inline-flex items-center text-[9px] px-1 py-0 rounded border border-sky-400/40 text-sky-500 bg-sky-400/10 font-normal leading-tight">Alleen fysiek</span>)}</p>
                    <p className="text-2xl font-bold">{formatNumber(grandTotal, 0)}</p>
                    {showComparison && prevGrandTotal > 0 && (
                      <p className="text-xs text-muted-foreground mt-0.5">{selectedYear - 1}: {formatNumber(prevGrandTotal, 0)} <DeltaBadge delta={totalDelta} /></p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Cylinder className="h-4 w-4" />
                    cilinders
                  </div>
                </div>
                {/* Proportion bar */}
                <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden flex">
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: `${emmenPercent}%` }} />
                  <div className="h-full bg-sky-400 transition-all duration-500" style={{ width: `${tilburgPercent}%` }} />
                </div>
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span>Emmen</span>
                  <span>Tilburg</span>
                </div>
              </CardContent>
            </Card>
          </div>
        );
      })()}

      {/* Digital vs Physical Summary */}
      {hasDigitalTypes && digitalPhysicalSplit.total > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card className="shadow-sm border-orange-500/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cylinder className="h-4 w-4 text-orange-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Fysieke cilinders</p>
                    <p className="text-xl font-bold">{formatNumber(digitalPhysicalSplit.physical, 0)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
                  {digitalPhysicalSplit.physicalPercent}%
                </Badge>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-sky-400/20">
            <CardContent className="pt-4 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-sky-500" />
                  <div>
                    <p className="text-sm text-muted-foreground">Digitale cilinders</p>
                    <p className="text-xl font-bold">{formatNumber(digitalPhysicalSplit.digital, 0)}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-sky-400/10 text-sky-500 border-sky-400/20">
                  {digitalPhysicalSplit.digitalPercent}%
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      )}


      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Cilinders per maand</CardTitle>
          <CardDescription>
            {ytdMode ? `YTD t/m ${MONTH_NAMES[todayMonth - 1]} ${selectedYear}` : `Maandelijkse vergelijking ${selectedYear}`}
            {showComparison && ` — vergeleken met ${selectedYear - 1}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={comparisonChartData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="monthName" className="text-xs" tickLine={false} axisLine={false} />
              <YAxis className="text-xs" tickFormatter={(v) => formatNumber(v, 0)} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  backgroundColor: "hsl(var(--background))",
                  padding: "10px 14px",
                  fontSize: "13px",
                }}
                formatter={(value: number, name: string) => [
                  formatNumber(value, 0),
                  name === "emmen" ? `Emmen ${selectedYear}` :
                  name === "tilburg" ? `Tilburg ${selectedYear}` :
                  name === "emmen_prev" ? `Emmen ${selectedYear - 1}` :
                  `Tilburg ${selectedYear - 1}`
                ]}
              />
              <Legend
                formatter={(value: string) =>
                  value === "emmen" ? `Emmen ${selectedYear}` :
                  value === "tilburg" ? `Tilburg ${selectedYear}` :
                  value === "emmen_prev" ? `Emmen ${selectedYear - 1}` :
                  `Tilburg ${selectedYear - 1}`
                }
              />
              <Bar dataKey="emmen" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={showComparison ? 12 : 20} />
              <Bar dataKey="tilburg" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={showComparison ? 12 : 20} />
              {showComparison && <Bar dataKey="emmen_prev" fill="#93c5fd" radius={[4, 4, 0, 0]} barSize={12} />}
              {showComparison && <Bar dataKey="tilburg_prev" fill="#7dd3fc" radius={[4, 4, 0, 0]} barSize={12} />}
            </BarChart>
          </ResponsiveContainer>

          {/* Monthly Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Locatie</th>
                  {displayMonthlyData.map(m => (
                    <th key={m.month} className="text-right py-2 px-1 font-medium text-muted-foreground">{m.monthName}</th>
                  ))}
                  <th className="text-right py-2 pl-3 font-semibold">Totaal</th>
                </tr>
              </thead>
              <tbody>
                {/* Current year rows */}
                <tr className={showComparison ? "" : "border-b"}>
                  <td className="py-2 pr-4 font-medium flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Emmen {selectedYear}
                  </td>
                  {displayMonthlyData.map(m => (
                    <td key={m.month} className="text-right py-2 px-1 tabular-nums">{formatNumber(m.emmen, 0)}</td>
                  ))}
                  <td className="text-right py-2 pl-3 font-semibold tabular-nums">{formatNumber(displayEmmenTotal, 0)}</td>
                </tr>
                {showComparison && (
                  <tr className="border-b">
                    <td className="py-1.5 pr-4 text-muted-foreground flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-blue-200" />
                      Emmen {selectedYear - 1}
                    </td>
                    {displayMonthlyData.map((m, idx) => {
                      const prev = prevDisplayData[idx]?.emmen || 0;
                      const delta = prev > 0 ? ((m.emmen - prev) / prev) * 100 : null;
                      return (
                        <td key={m.month} className="text-right py-1.5 px-1 tabular-nums text-muted-foreground">
                          {formatNumber(prev, 0)}
                          {delta !== null && (
                            <span className={`ml-1 text-[9px] ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-right py-1.5 pl-3 tabular-nums text-muted-foreground font-medium">{formatNumber(prevEmmenTotal, 0)}</td>
                  </tr>
                )}
                <tr className={showComparison ? "" : "border-b"}>
                  <td className="py-2 pr-4 font-medium flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                    Tilburg {selectedYear}
                  </td>
                  {displayMonthlyData.map(m => (
                    <td key={m.month} className="text-right py-2 px-1 tabular-nums">{formatNumber(m.tilburg, 0)}</td>
                  ))}
                  <td className="text-right py-2 pl-3 font-semibold tabular-nums">{formatNumber(displayTilburgTotal, 0)}</td>
                </tr>
                {showComparison && (
                  <tr className="border-b">
                    <td className="py-1.5 pr-4 text-muted-foreground flex items-center gap-1.5">
                      <div className="h-2.5 w-2.5 rounded-full bg-sky-200" />
                      Tilburg {selectedYear - 1}
                    </td>
                    {displayMonthlyData.map((m, idx) => {
                      const prev = prevDisplayData[idx]?.tilburg || 0;
                      const delta = prev > 0 ? ((m.tilburg - prev) / prev) * 100 : null;
                      return (
                        <td key={m.month} className="text-right py-1.5 px-1 tabular-nums text-muted-foreground">
                          {formatNumber(prev, 0)}
                          {delta !== null && (
                            <span className={`ml-1 text-[9px] ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                              {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
                            </span>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-right py-1.5 pl-3 tabular-nums text-muted-foreground font-medium">{formatNumber(prevTilburgTotal, 0)}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-2 pr-4 font-semibold">Totaal {selectedYear}</td>
                  {displayMonthlyData.map(m => (
                    <td key={m.month} className="text-right py-2 px-1 font-semibold tabular-nums">{formatNumber(m.total, 0)}</td>
                  ))}
                  <td className="text-right py-2 pl-3 font-bold tabular-nums">{formatNumber(grandTotal, 0)}</td>
                </tr>
                {showComparison && prevGrandTotal > 0 && (
                  <tr className="border-t">
                    <td className="py-1.5 pr-4 text-muted-foreground font-medium">Totaal {selectedYear - 1}</td>
                    {displayMonthlyData.map((m, idx) => {
                      const prev = (prevDisplayData[idx]?.emmen || 0) + (prevDisplayData[idx]?.tilburg || 0);
                      return (
                        <td key={m.month} className="text-right py-1.5 px-1 tabular-nums text-muted-foreground">{formatNumber(prev, 0)}</td>
                      );
                    })}
                    <td className="text-right py-1.5 pl-3 font-semibold tabular-nums text-muted-foreground">{formatNumber(prevGrandTotal, 0)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Line Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Cumulatief verloop</CardTitle>
          <CardDescription>
            {ytdMode ? `YTD t/m ${MONTH_NAMES[todayMonth - 1]} ${selectedYear}` : `Lopend totaal cilinders per locatie — ${selectedYear}`}
            {showComparison && ` — vergeleken met ${selectedYear - 1}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={cumulativeData} margin={{ left: 10, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="monthName" className="text-xs" tickLine={false} axisLine={false} />
              <YAxis className="text-xs" tickFormatter={(v) => formatNumber(v, 0)} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  backgroundColor: "hsl(var(--background))",
                  padding: "10px 14px",
                  fontSize: "13px",
                }}
                formatter={(value: number, name: string) => [
                  formatNumber(value, 0),
                  name === "cumEmmen" ? `Emmen ${selectedYear}` :
                  name === "cumTilburg" ? `Tilburg ${selectedYear}` :
                  name === "cumTotal" ? `Totaal ${selectedYear}` :
                  name === "cumEmmenPrev" ? `Emmen ${selectedYear - 1}` :
                  name === "cumTilburgPrev" ? `Tilburg ${selectedYear - 1}` :
                  `Totaal ${selectedYear - 1}`
                ]}
              />
              <Legend
                formatter={(value: string) =>
                  value === "cumEmmen" ? `Emmen ${selectedYear}` :
                  value === "cumTilburg" ? `Tilburg ${selectedYear}` :
                  value === "cumTotal" ? `Totaal ${selectedYear}` :
                  value === "cumEmmenPrev" ? `Emmen ${selectedYear - 1}` :
                  value === "cumTilburgPrev" ? `Tilburg ${selectedYear - 1}` :
                  `Totaal ${selectedYear - 1}`
                }
              />
              <Line type="monotone" dataKey="cumEmmen" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3.5 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="cumTilburg" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3.5 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="cumTotal" stroke="#1e293b" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} activeDot={{ r: 5 }} />
              {showComparison && <Line type="monotone" dataKey="cumEmmenPrev" stroke="#93c5fd" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2.5 }} activeDot={{ r: 4 }} />}
              {showComparison && <Line type="monotone" dataKey="cumTilburgPrev" stroke="#7dd3fc" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2.5 }} activeDot={{ r: 4 }} />}
              {showComparison && <Line type="monotone" dataKey="cumTotalPrev" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 3" dot={{ r: 2 }} activeDot={{ r: 4 }} />}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gas Type Distribution per Location */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Gastype verdeling per locatie</CardTitle>
          <CardDescription>
            Cilinders per gastype — Emmen vs Tilburg ({selectedYear})
            {showComparison && ` — vergeleken met ${selectedYear - 1}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredGasTypeData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={Math.max(300, filteredGasTypeData.length * (showComparison ? 50 : 36))}>
                <BarChart data={filteredGasTypeData} layout="vertical" margin={{ left: 10, right: 70 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e5e7eb" />
                  <XAxis type="number" className="text-xs" tickFormatter={(v) => formatNumber(v, 0)} tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="gas_type_name"
                    type="category"
                    width={120}
                    className="text-[11px]"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: "10px",
                      border: "1px solid hsl(var(--border))",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                      backgroundColor: "hsl(var(--background))",
                      padding: "10px 14px",
                      fontSize: "13px",
                    }}
                    formatter={(value: number, name: string) => [
                      formatNumber(value, 0),
                      name === "emmen" ? `Emmen ${selectedYear}` :
                      name === "tilburg" ? `Tilburg ${selectedYear}` :
                      name === "emmen_prev" ? `Emmen ${selectedYear - 1}` :
                      `Tilburg ${selectedYear - 1}`
                    ]}
                  />
                  <Legend
                    formatter={(value: string) =>
                      value === "emmen" ? `Emmen ${selectedYear}` :
                      value === "tilburg" ? `Tilburg ${selectedYear}` :
                      value === "emmen_prev" ? `Emmen ${selectedYear - 1}` :
                      `Tilburg ${selectedYear - 1}`
                    }
                  />
                  <Bar dataKey="emmen" fill="#3b82f6" radius={[0, 2, 2, 0]} barSize={showComparison ? 9 : 14} stackId="cur" />
                  <Bar dataKey="tilburg" fill="#38bdf8" radius={[0, 4, 4, 0]} barSize={showComparison ? 9 : 14} stackId="cur">
                    <LabelList
                      dataKey="total"
                      position="right"
                      className="text-[11px] font-medium fill-foreground"
                      formatter={(v: number) => formatNumber(v, 0)}
                    />
                  </Bar>
                  {showComparison && <Bar dataKey="emmen_prev" fill="#93c5fd" radius={[0, 2, 2, 0]} barSize={9} stackId="prev" />}
                  {showComparison && (
                    <Bar dataKey="tilburg_prev" fill="#bae6fd" radius={[0, 4, 4, 0]} barSize={9} stackId="prev">
                      <LabelList
                        dataKey="total_prev"
                        position="right"
                        className="text-[10px] fill-muted-foreground"
                        formatter={(v: number) => v > 0 ? formatNumber(v, 0) : ""}
                      />
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>

              {/* Gas type table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Gastype</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Emmen</th>
                      <th className="text-right py-2 px-3 font-medium text-muted-foreground">Tilburg</th>
                      <th className="text-right py-2 px-3 font-semibold">{selectedYear}</th>
                      {showComparison && <th className="text-right py-2 px-3 font-medium text-muted-foreground">{selectedYear - 1}</th>}
                      {showComparison && <th className="text-right py-2 pl-3 font-medium text-muted-foreground">Δ</th>}
                      {!showComparison && <th className="text-right py-2 pl-3 font-medium text-muted-foreground">Verdeling</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGasTypeData.map((gt) => {
                      const pctEmmen = gt.total > 0 ? Math.round((gt.emmen / gt.total) * 100) : 0;
                      const prevTotal = gt.total_prev || 0;
                      const delta = prevTotal > 0 ? ((gt.total - prevTotal) / prevTotal) * 100 : null;
                      return (
                        <tr key={gt.gas_type_name} className="border-b last:border-0">
                          <td className="py-2 pr-4 font-medium flex items-center gap-1.5">
                            <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: gt.gas_type_color }} />
                            {gt.gas_type_name}
                            {gt.is_digital && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-sky-400/40 text-sky-500 bg-sky-400/10">ⓓ</Badge>
                            )}
                          </td>
                          <td className="text-right py-2 px-3 tabular-nums">{formatNumber(gt.emmen, 0)}</td>
                          <td className="text-right py-2 px-3 tabular-nums">{formatNumber(gt.tilburg, 0)}</td>
                          <td className="text-right py-2 px-3 font-semibold tabular-nums">{formatNumber(gt.total, 0)}</td>
                          {showComparison && (
                            <td className="text-right py-2 px-3 tabular-nums text-muted-foreground">{prevTotal > 0 ? formatNumber(prevTotal, 0) : "—"}</td>
                          )}
                          {showComparison && (
                            <td className="text-right py-2 pl-3 tabular-nums">
                              {delta !== null ? (
                                <span className={`font-medium ${delta >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                                  {delta >= 0 ? "+" : ""}{delta.toFixed(0)}%
                                </span>
                              ) : "—"}
                            </td>
                          )}
                          {!showComparison && (
                            <td className="text-right py-2 pl-3">
                              <div className="flex items-center justify-end gap-1">
                                <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden flex">
                                  <div className="h-full bg-blue-500" style={{ width: `${pctEmmen}%` }} />
                                  <div className="h-full bg-sky-400" style={{ width: `${100 - pctEmmen}%` }} />
                                </div>
                              </div>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              Geen gastype data beschikbaar voor {selectedYear}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

export default LocationComparisonReport;
