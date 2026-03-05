import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Download,
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
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { nl } from "date-fns/locale";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { exportToExcel, exportToPDF } from "@/lib/export-utils";

interface MonthlyReportProps {
  hideDigital?: boolean;
}

interface LocationKPI {
  location: string;
  label: string;
  totalCylinders: number;
  cylinderOrders: number;
  completedCylinders: number;
  efficiencyRate: number;
  totalDryIceKg: number;
  dryIceOrders: number;
  topCustomers: { name: string; cylinders: number; dryIceKg: number }[];
}

export function MonthlyReport({ hideDigital = false }: MonthlyReportProps) {
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return format(now, "yyyy-MM");
  });

  const [emmenData, setEmmenData] = useState<LocationKPI | null>(null);
  const [tilburgData, setTilburgData] = useState<LocationKPI | null>(null);
  const [prevEmmenData, setPrevEmmenData] = useState<LocationKPI | null>(null);
  const [prevTilburgData, setPrevTilburgData] = useState<LocationKPI | null>(null);
  const [exporting, setExporting] = useState(false);

  const monthDate = useMemo(() => new Date(selectedMonth + "-01"), [selectedMonth]);
  const fromDate = useMemo(() => format(startOfMonth(monthDate), "yyyy-MM-dd"), [monthDate]);
  const toDate = useMemo(() => format(endOfMonth(monthDate), "yyyy-MM-dd"), [monthDate]);
  const prevMonthDate = useMemo(() => subMonths(monthDate, 1), [monthDate]);
  const prevFromDate = useMemo(() => format(startOfMonth(prevMonthDate), "yyyy-MM-dd"), [prevMonthDate]);
  const prevToDate = useMemo(() => format(endOfMonth(prevMonthDate), "yyyy-MM-dd"), [prevMonthDate]);

  // Generate month options (last 24 months)
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

  const fetchLocationData = async (
    location: string,
    label: string,
    from: string,
    to: string,
  ): Promise<LocationKPI> => {
    const [effRes, dryIceEffRes, customerRes] = await Promise.all([
      api.reports.getProductionEfficiency(from, to, location, hideDigital).catch(() => []),
      api.reports.getDryIceEfficiency(from, to, location).catch(() => []),
      api.reports.getCustomerTotals(from, to, location, hideDigital).catch(() => []),
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

    return {
      location,
      label,
      totalCylinders: Number(eff.total_cylinders) || 0,
      cylinderOrders: Number(eff.total_orders) || 0,
      completedCylinders: Number(eff.completed_cylinders) || 0,
      efficiencyRate: Number(eff.efficiency_rate) || 0,
      totalDryIceKg: Number(dryIceEff.total_kg) || 0,
      dryIceOrders: Number(dryIceEff.total_orders) || 0,
      topCustomers: customers,
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
    // Merge top customers by name
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

    return {
      location: "all",
      label: "Totaal",
      totalCylinders: emmenData.totalCylinders + tilburgData.totalCylinders,
      cylinderOrders: emmenData.cylinderOrders + tilburgData.cylinderOrders,
      completedCylinders: emmenData.completedCylinders + tilburgData.completedCylinders,
      efficiencyRate: Math.round(
        ((emmenData.completedCylinders + tilburgData.completedCylinders) /
          Math.max(emmenData.totalCylinders + tilburgData.totalCylinders, 1)) *
          100
      ),
      totalDryIceKg: emmenData.totalDryIceKg + tilburgData.totalDryIceKg,
      dryIceOrders: emmenData.dryIceOrders + tilburgData.dryIceOrders,
      topCustomers: mergedCustomers,
    };
  }, [emmenData, tilburgData]);

  const prevTotalData = useMemo((): LocationKPI | null => {
    if (!prevEmmenData || !prevTilburgData) return null;
    return {
      location: "all",
      label: "Totaal",
      totalCylinders: prevEmmenData.totalCylinders + prevTilburgData.totalCylinders,
      cylinderOrders: prevEmmenData.cylinderOrders + prevTilburgData.cylinderOrders,
      completedCylinders: prevEmmenData.completedCylinders + prevTilburgData.completedCylinders,
      efficiencyRate: 0,
      totalDryIceKg: prevEmmenData.totalDryIceKg + prevTilburgData.totalDryIceKg,
      dryIceOrders: prevEmmenData.dryIceOrders + prevTilburgData.dryIceOrders,
      topCustomers: [],
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

  const buildExportRows = () => {
    if (!emmenData || !tilburgData || !totalData) return [];
    const locations = [
      { ...emmenData, prev: prevEmmenData },
      { ...tilburgData, prev: prevTilburgData },
      { ...totalData, prev: prevTotalData },
    ];
    return locations.map((loc) => ({
      locatie: loc.label,
      cilinder_orders: loc.cylinderOrders,
      totaal_cilinders: loc.totalCylinders,
      trend_cilinders: loc.prev ? `${calcTrend(loc.totalCylinders, loc.prev.totalCylinders)}%` : "–",
      droogijs_orders: loc.dryIceOrders,
      droogijs_kg: loc.totalDryIceKg,
      trend_droogijs: loc.prev ? `${calcTrend(loc.totalDryIceKg, loc.prev.totalDryIceKg)}%` : "–",
      top_klant_1: loc.topCustomers[0]?.name || "–",
      top_klant_1_cilinders: loc.topCustomers[0]?.cylinders || 0,
      top_klant_2: loc.topCustomers[1]?.name || "–",
      top_klant_2_cilinders: loc.topCustomers[1]?.cylinders || 0,
      top_klant_3: loc.topCustomers[2]?.name || "–",
      top_klant_3_cilinders: loc.topCustomers[2]?.cylinders || 0,
    }));
  };

  const exportData = {
    title: `Maandrapport ${format(monthDate, "MMMM yyyy", { locale: nl })}`,
    subtitle: "Productie overzicht per locatie",
    columns: [
      { header: "Locatie", key: "locatie", width: 14 },
      { header: "Cil. Orders", key: "cilinder_orders", width: 12 },
      { header: "Totaal Cil.", key: "totaal_cilinders", width: 12 },
      { header: "Trend Cil.", key: "trend_cilinders", width: 10 },
      { header: "Droogijs Orders", key: "droogijs_orders", width: 14 },
      { header: "Droogijs (kg)", key: "droogijs_kg", width: 12 },
      { header: "Trend Droogijs", key: "trend_droogijs", width: 12 },
      { header: "Top 1", key: "top_klant_1", width: 20 },
      { header: "#1 Cil.", key: "top_klant_1_cilinders", width: 8 },
      { header: "Top 2", key: "top_klant_2", width: 20 },
      { header: "#2 Cil.", key: "top_klant_2_cilinders", width: 8 },
      { header: "Top 3", key: "top_klant_3", width: 20 },
      { header: "#3 Cil.", key: "top_klant_3_cilinders", width: 8 },
    ],
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
  }) => (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Building2 className={`h-4 w-4 ${color}`} />
        <h3 className="font-semibold text-sm">{data.label}</h3>
        {data.label === "Totaal" && (
          <Badge variant="outline" className="text-[10px] h-5">Gecombineerd</Badge>
        )}
      </div>

      {/* Cylinder KPIs */}
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

      {/* Dry Ice KPIs */}
      {(data.location === "sol_emmen" || data.location === "all") && (
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
    </div>
  );

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
              Overzicht van KPI's per locatie met vergelijking t.o.v. vorige maand
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
