import React, { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2, TrendingUp, TrendingDown, Minus, Cylinder, Sparkles } from "lucide-react";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getGasColor } from "@/constants/gasColors";
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
}

interface LocationComparisonReportProps {
  hideDigital?: boolean;
  onHideDigitalChange?: (value: boolean) => void;
}

export const LocationComparisonReport = React.memo(function LocationComparisonReport({ hideDigital: externalHideDigital, onHideDigitalChange }: LocationComparisonReportProps) {
  const hideDigital = externalHideDigital ?? false;
  const setHideDigital = (val: boolean) => onHideDigitalChange?.(val);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [monthlyData, setMonthlyData] = useState<MonthlyLocationData[]>([]);
  const [gasTypeData, setGasTypeData] = useState<GasTypeLocationData[]>([]);
  const [emmenTotal, setEmmenTotal] = useState(0);
  const [tilburgTotal, setTilburgTotal] = useState(0);
  const [hasDigitalTypes, setHasDigitalTypes] = useState(false);
  const [digitalGasTypeIds, setDigitalGasTypeIds] = useState<Set<string>>(new Set());

  const availableYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= 2024; y--) years.push(y);
    return years;
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedYear]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [emmenMonthly, tilburgMonthly, emmenGasType, tilburgGasType, gasTypesRes] = await Promise.all([
        api.reports.getMonthlyOrderTotals(selectedYear, "cylinder", "sol_emmen").catch(() => []),
        api.reports.getMonthlyOrderTotals(selectedYear, "cylinder", "sol_tilburg").catch(() => []),
        api.reports.getMonthlyCylinderTotalsByGasType(selectedYear, "sol_emmen").catch(() => []),
        api.reports.getMonthlyCylinderTotalsByGasType(selectedYear, "sol_tilburg").catch(() => []),
        api.gasTypes.getAll().catch(() => ({ data: [] })),
      ]);

      // Process monthly data
      const emmenMap = new Map<number, number>();
      const tilburgMap = new Map<number, number>();
      (emmenMonthly || []).forEach((item: any) => emmenMap.set(item.month, Number(item.total_value) || 0));
      (tilburgMonthly || []).forEach((item: any) => tilburgMap.set(item.month, Number(item.total_value) || 0));

      const monthly: MonthlyLocationData[] = MONTH_NAMES.map((name, idx) => {
        const m = idx + 1;
        const e = emmenMap.get(m) || 0;
        const t = tilburgMap.get(m) || 0;
        return { monthName: name, month: m, emmen: e, tilburg: t, total: e + t };
      });
      setMonthlyData(monthly);
      setEmmenTotal(monthly.reduce((s, m) => s + m.emmen, 0));
      setTilburgTotal(monthly.reduce((s, m) => s + m.tilburg, 0));

      // Build digital gas type map
      const digitalMap = new Map<string, boolean>();
      const gasTypesData = gasTypesRes?.data || [];
      (gasTypesData as any[]).forEach((gt: any) => {
        if (gt.id) digitalMap.set(gt.name || gt.id, gt.is_digital === true);
      });
      setDigitalGasTypeIds(new Set(
        (gasTypesData as any[]).filter((gt: any) => gt.is_digital).map((gt: any) => gt.name)
      ));
      setHasDigitalTypes((gasTypesData as any[]).some((gt: any) => gt.is_digital));

      // Process gas type data
      const gasMap = new Map<string, { name: string; color: string; emmen: number; tilburg: number }>();
      (emmenGasType || []).forEach((item: any) => {
        const name = item.gas_type_name || "Onbekend";
        const existing = gasMap.get(name) || { name, color: item.gas_type_color || "#3b82f6", emmen: 0, tilburg: 0 };
        existing.emmen += Number(item.total_cylinders) || 0;
        gasMap.set(name, existing);
      });
      (tilburgGasType || []).forEach((item: any) => {
        const name = item.gas_type_name || "Onbekend";
        const existing = gasMap.get(name) || { name, color: item.gas_type_color || "#3b82f6", emmen: 0, tilburg: 0 };
        existing.tilburg += Number(item.total_cylinders) || 0;
        gasMap.set(name, existing);
      });

      const gasData: GasTypeLocationData[] = Array.from(gasMap.values())
        .map(g => ({
          gas_type_name: g.name,
          gas_type_color: getGasColor(g.name, g.color),
          is_digital: digitalMap.get(g.name) || false,
          emmen: g.emmen,
          tilburg: g.tilburg,
          total: g.emmen + g.tilburg,
        }))
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

  // Filtered totals (recalculate when hiding digital)
  const filteredEmmenTotal = useMemo(() => {
    if (!hideDigital) return emmenTotal;
    return filteredGasTypeData.reduce((s, gt) => s + gt.emmen, 0);
  }, [hideDigital, emmenTotal, filteredGasTypeData]);

  const filteredTilburgTotal = useMemo(() => {
    if (!hideDigital) return tilburgTotal;
    return filteredGasTypeData.reduce((s, gt) => s + gt.tilburg, 0);
  }, [hideDigital, tilburgTotal, filteredGasTypeData]);

  const grandTotal = filteredEmmenTotal + filteredTilburgTotal;
  const emmenPercent = grandTotal > 0 ? Math.round((filteredEmmenTotal / grandTotal) * 100) : 0;
  const tilburgPercent = grandTotal > 0 ? Math.round((filteredTilburgTotal / grandTotal) * 100) : 0;

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

  const cumulativeData = useMemo(() => {
    let cumE = 0, cumT = 0;
    return monthlyData.map(m => {
      cumE += m.emmen;
      cumT += m.tilburg;
      return { monthName: m.monthName, cumEmmen: cumE, cumTilburg: cumT, cumTotal: cumE + cumT };
    });
  }, [monthlyData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
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
        <div className="flex items-center gap-2">
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-sm border-blue-500/20">
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground flex items-center gap-1.5">SOL Emmen{hideDigital && hasDigitalTypes && (<span className="inline-flex items-center text-[9px] px-1 py-0 rounded border border-sky-400/40 text-sky-500 bg-sky-400/10 font-normal leading-tight">Alleen fysiek</span>)}</p>
                <p className="text-2xl font-bold">{formatNumber(filteredEmmenTotal, 0)}</p>
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
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Cylinder className="h-4 w-4" />
                cilinders
              </div>
            </div>
            {/* Proportion bar */}
            <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden flex">
              <div
                className="h-full bg-blue-500 transition-all duration-500"
                style={{ width: `${emmenPercent}%` }}
              />
              <div
                className="h-full bg-sky-400 transition-all duration-500"
                style={{ width: `${tilburgPercent}%` }}
              />
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
              <span>Emmen</span>
              <span>Tilburg</span>
            </div>
          </CardContent>
        </Card>
      </div>

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
          <CardDescription>Maandelijkse vergelijking {selectedYear}</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={monthlyData} margin={{ left: 10, right: 10 }}>
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
                  name === "emmen" ? "SOL Emmen" : "SOL Tilburg"
                ]}
              />
              <Legend
                formatter={(value: string) => value === "emmen" ? "SOL Emmen" : "SOL Tilburg"}
              />
              <Bar dataKey="emmen" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={20} />
              <Bar dataKey="tilburg" fill="#38bdf8" radius={[4, 4, 0, 0]} barSize={20} />
            </BarChart>
          </ResponsiveContainer>

          {/* Monthly Table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-4 font-medium text-muted-foreground">Locatie</th>
                  {MONTH_NAMES.map(m => (
                    <th key={m} className="text-right py-2 px-1 font-medium text-muted-foreground">{m}</th>
                  ))}
                  <th className="text-right py-2 pl-3 font-semibold">Totaal</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 pr-4 font-medium flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-blue-500" />
                    Emmen
                  </td>
                  {monthlyData.map(m => (
                    <td key={m.month} className="text-right py-2 px-1 tabular-nums">
                      {formatNumber(m.emmen, 0)}
                    </td>
                  ))}
                  <td className="text-right py-2 pl-3 font-semibold tabular-nums">{formatNumber(emmenTotal, 0)}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 pr-4 font-medium flex items-center gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-sky-400" />
                    Tilburg
                  </td>
                  {monthlyData.map(m => (
                    <td key={m.month} className="text-right py-2 px-1 tabular-nums">
                      {formatNumber(m.tilburg, 0)}
                    </td>
                  ))}
                  <td className="text-right py-2 pl-3 font-semibold tabular-nums">{formatNumber(tilburgTotal, 0)}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-semibold">Totaal</td>
                  {monthlyData.map(m => (
                    <td key={m.month} className="text-right py-2 px-1 font-semibold tabular-nums">
                      {formatNumber(m.total, 0)}
                    </td>
                  ))}
                  <td className="text-right py-2 pl-3 font-bold tabular-nums">{formatNumber(grandTotal, 0)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Cumulative Line Chart */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Cumulatief verloop</CardTitle>
          <CardDescription>Lopend totaal cilinders per locatie — {selectedYear}</CardDescription>
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
                  name === "cumEmmen" ? "SOL Emmen" : name === "cumTilburg" ? "SOL Tilburg" : "Totaal"
                ]}
              />
              <Legend
                formatter={(value: string) => value === "cumEmmen" ? "SOL Emmen" : value === "cumTilburg" ? "SOL Tilburg" : "Totaal"}
              />
              <Line type="monotone" dataKey="cumEmmen" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 3.5 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="cumTilburg" stroke="#38bdf8" strokeWidth={2.5} dot={{ r: 3.5 }} activeDot={{ r: 5 }} />
              <Line type="monotone" dataKey="cumTotal" stroke="hsl(var(--foreground))" strokeWidth={2} strokeDasharray="5 5" dot={{ r: 3 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Gas Type Distribution per Location */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium">Gastype verdeling per locatie</CardTitle>
          <CardDescription>Cilinders per gastype — Emmen vs Tilburg ({selectedYear})</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredGasTypeData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={Math.max(300, filteredGasTypeData.length * 36)}>
                <BarChart data={filteredGasTypeData} layout="vertical" margin={{ left: 10, right: 60 }}>
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
                      name === "emmen" ? "SOL Emmen" : "SOL Tilburg"
                    ]}
                  />
                  <Legend
                    formatter={(value: string) => value === "emmen" ? "SOL Emmen" : "SOL Tilburg"}
                  />
                  <Bar dataKey="emmen" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={14} stackId="a" />
                  <Bar dataKey="tilburg" fill="#38bdf8" radius={[0, 4, 4, 0]} barSize={14} stackId="a">
                    <LabelList
                      dataKey="total"
                      position="right"
                      className="text-[11px] font-medium fill-foreground"
                      formatter={(v: number) => formatNumber(v, 0)}
                    />
                  </Bar>
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
                      <th className="text-right py-2 px-3 font-semibold">Totaal</th>
                      <th className="text-right py-2 pl-3 font-medium text-muted-foreground">Verdeling</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGasTypeData.map((gt) => {
                      const pctEmmen = gt.total > 0 ? Math.round((gt.emmen / gt.total) * 100) : 0;
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
                          <td className="text-right py-2 pl-3">
                            <div className="flex items-center justify-end gap-1">
                              <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden flex">
                                <div className="h-full bg-blue-500" style={{ width: `${pctEmmen}%` }} />
                                <div className="h-full bg-sky-400" style={{ width: `${100 - pctEmmen}%` }} />
                              </div>
                            </div>
                          </td>
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
