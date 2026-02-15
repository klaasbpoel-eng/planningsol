import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, Minus, Cylinder, Snowflake, Award, AlertTriangle, X, Filter, Users, Building2, Ruler } from "lucide-react";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { GasTypeMultiSelect } from "./GasTypeMultiSelect";
import { CustomerMultiSelect } from "./CustomerMultiSelect";
import { CylinderSizeMultiSelect } from "./CylinderSizeMultiSelect";
import { CumulativeYearChart } from "./CumulativeYearChart";
import { CumulativeGasTypeChart } from "./CumulativeGasTypeChart";
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
  LineChart,
  Line,
  AreaChart,
  Area,
  ReferenceLine,
  Cell,
} from "recharts";

interface MonthlyData {
  month: number;
  monthName: string;
  currentYear: number;
  previousYear: number;
  change: number;
  changePercent: number;
}

interface YearlyTotals {
  currentYear: number;
  previousYear: number;
  change: number;
  changePercent: number;
}

interface GasTypeMonthlyData {
  gas_type_id: string;
  gas_type_name: string;
  gas_type_color: string;
  months: number[];
  total: number;
}

interface GasTypeYearComparison {
  gas_type_id: string;
  gas_type_name: string;
  gas_type_color: string;
  currentYear: number;
  previousYear: number;
  change: number;
  changePercent: number;
}

interface MonthlyGasTypeChartData {
  monthName: string;
  month: number;
  [key: string]: number | string; // Dynamic keys for each gas type
}

interface CustomerComparison {
  customer_id: string | null;
  customer_name: string;
  currentCylinders: number;
  previousCylinders: number;
  cylinderChange: number;
  cylinderChangePercent: number;
  currentDryIce: number;
  previousDryIce: number;
  dryIceChange: number;
  dryIceChangePercent: number;
}

interface CylinderSizeComparison {
  cylinder_size: string;
  currentYear: number;
  previousYear: number;
  change: number;
  changePercent: number;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mrt", "Apr", "Mei", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"
];

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface YearComparisonReportProps {
  location?: ProductionLocation;
}

interface MonthlyCustomerCylinderData {
  month: number;
  customer_id: string | null;
  customer_name: string;
  total_cylinders: number;
}

export const YearComparisonReport = React.memo(function YearComparisonReport({ location = "all" }: YearComparisonReportProps) {
  const showDryIce = location !== "sol_tilburg";
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [cylinderData, setCylinderData] = useState<MonthlyData[]>([]);
  const [dryIceData, setDryIceData] = useState<MonthlyData[]>([]);
  const [cylinderTotals, setCylinderTotals] = useState<YearlyTotals | null>(null);
  const [dryIceTotals, setDryIceTotals] = useState<YearlyTotals | null>(null);
  const [availableYears, setAvailableYears] = useState<number[]>([]);
  const [highlightSignificant, setHighlightSignificant] = useState(false);
  const [gasTypeComparison, setGasTypeComparison] = useState<GasTypeYearComparison[]>([]);
  const [gasTypes, setGasTypes] = useState<{ id: string; name: string; color: string }[]>([]);
  const [selectedGasTypes, setSelectedGasTypes] = useState<string[]>([]);
  const [monthlyGasTypeData, setMonthlyGasTypeData] = useState<{ current: MonthlyGasTypeChartData[]; previous: MonthlyGasTypeChartData[] }>({ current: [], previous: [] });
  const [gasTypeInfo, setGasTypeInfo] = useState<Map<string, { name: string; color: string }>>(new Map());
  const [customerComparison, setCustomerComparison] = useState<CustomerComparison[]>([]);
  const [customerSortBy, setCustomerSortBy] = useState<"cylinders" | "dryIce" | "total">("total");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [monthlyCustomerCylinderData, setMonthlyCustomerCylinderData] = useState<{
    current: Map<number, MonthlyCustomerCylinderData[]>;
    previous: Map<number, MonthlyCustomerCylinderData[]>;
  }>({ current: new Map(), previous: new Map() });

  // Cylinder size state
  const [cylinderSizes, setCylinderSizes] = useState<{ id: string; name: string; capacity_liters: number | null }[]>([]);
  const [selectedCylinderSizes, setSelectedCylinderSizes] = useState<string[]>([]);
  const [cylinderSizeComparison, setCylinderSizeComparison] = useState<CylinderSizeComparison[]>([]);
  const [hideDigital, setHideDigital] = useState(false);

  const hasDigitalTypes = useMemo(() => {
    return gasTypes.some((gt: any) => gt.is_digital);
  }, [gasTypes]);

  const digitalGasTypeIds = useMemo(() => {
    return new Set(gasTypes.filter((gt: any) => gt.is_digital).map((gt: any) => gt.id));
  }, [gasTypes]);
  const isSignificantGrowth = (percent: number) => percent > 10 || percent < -10;

  // =================== FILTERED DATA CALCULATIONS ===================

  // Gefilterde gastype vergelijking data
  const filteredGasTypeData = useMemo(() => {
    let data = gasTypeComparison;
    if (hideDigital) {
      data = data.filter(gt => !digitalGasTypeIds.has(gt.gas_type_id));
    }
    if (selectedGasTypes.length > 0) {
      data = data.filter(gt => selectedGasTypes.includes(gt.gas_type_id));
    }
    return data;
  }, [gasTypeComparison, selectedGasTypes, hideDigital, digitalGasTypeIds]);

  // Herberekende cylinder totalen op basis van gastype filter
  const filteredCylinderTotals = useMemo(() => {
    if (selectedGasTypes.length === 0 && !hideDigital) return cylinderTotals;
    if (!cylinderTotals) return null;

    // Bereken totalen alleen voor gefilterde gastypes
    const currentTotal = filteredGasTypeData.reduce((sum, gt) => sum + gt.currentYear, 0);
    const previousTotal = filteredGasTypeData.reduce((sum, gt) => sum + gt.previousYear, 0);
    const change = currentTotal - previousTotal;
    const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100) : (currentTotal > 0 ? 100 : 0);
    return { currentYear: currentTotal, previousYear: previousTotal, change, changePercent };
  }, [cylinderTotals, filteredGasTypeData, selectedGasTypes, hideDigital]);

  // Gefilterde maandelijkse data voor cilinders per gastype
  const filteredMonthlyGasTypeData = useMemo(() => {
    const hasGasTypeFilter = selectedGasTypes.length > 0;
    if (!hasGasTypeFilter && !hideDigital) return monthlyGasTypeData;

    const activeIds = hasGasTypeFilter
      ? selectedGasTypes.filter(id => !hideDigital || !digitalGasTypeIds.has(id))
      : Array.from(
          new Set([
            ...monthlyGasTypeData.current.flatMap(m => Object.keys(m).filter(k => k !== 'month' && k !== 'monthName')),
            ...monthlyGasTypeData.previous.flatMap(m => Object.keys(m).filter(k => k !== 'month' && k !== 'monthName')),
          ])
        ).filter(id => !digitalGasTypeIds.has(id));

    const filterMonthData = (data: MonthlyGasTypeChartData[]) => {
      return data.map(month => {
        const filtered: MonthlyGasTypeChartData = { month: month.month, monthName: month.monthName };
        activeIds.forEach(gtId => {
          if (month[gtId] !== undefined) filtered[gtId] = month[gtId];
        });
        return filtered;
      });
    };

    return {
      current: filterMonthData(monthlyGasTypeData.current),
      previous: filterMonthData(monthlyGasTypeData.previous)
    };
  }, [monthlyGasTypeData, selectedGasTypes, hideDigital, digitalGasTypeIds]);

  // Herberekende cylinder maanddata op basis van gastype filter
  const filteredCylinderData = useMemo(() => {
    if (selectedGasTypes.length === 0 && !hideDigital) return cylinderData;

    // Get active gas type IDs from filtered monthly data
    const activeIds = Object.keys(filteredMonthlyGasTypeData.current[0] || {}).filter(k => k !== 'month' && k !== 'monthName');

    // Bereken nieuwe maandtotalen uit gefilterde gastype data
    return cylinderData.map((month, idx) => {
      const currentMonthData = filteredMonthlyGasTypeData.current[idx];
      const previousMonthData = filteredMonthlyGasTypeData.previous[idx];

      const currentTotal = activeIds.reduce((sum, gtId) =>
        sum + (Number(currentMonthData?.[gtId]) || 0), 0);
      const previousTotal = activeIds.reduce((sum, gtId) =>
        sum + (Number(previousMonthData?.[gtId]) || 0), 0);

      const change = currentTotal - previousTotal;
      const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100) : (currentTotal > 0 ? 100 : 0);

      return {
        ...month,
        currentYear: currentTotal,
        previousYear: previousTotal,
        change,
        changePercent
      };
    });
  }, [cylinderData, filteredMonthlyGasTypeData, selectedGasTypes, hideDigital]);

  // Gefilterde klant data
  const filteredCustomerComparison = useMemo(() => {
    if (selectedCustomers.length === 0) return customerComparison;
    return customerComparison.filter(c => {
      const customerKey = c.customer_id || c.customer_name;
      return selectedCustomers.includes(customerKey);
    });
  }, [customerComparison, selectedCustomers]);

  // Herberekende droogijs totalen op basis van klant filter
  const filteredDryIceTotals = useMemo(() => {
    if (selectedCustomers.length === 0) return dryIceTotals;
    if (!dryIceTotals) return null;

    const currentTotal = filteredCustomerComparison.reduce((sum, c) => sum + c.currentDryIce, 0);
    const previousTotal = filteredCustomerComparison.reduce((sum, c) => sum + c.previousDryIce, 0);
    const change = currentTotal - previousTotal;
    const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100) : (currentTotal > 0 ? 100 : 0);
    return { currentYear: currentTotal, previousYear: previousTotal, change, changePercent };
  }, [dryIceTotals, filteredCustomerComparison, selectedCustomers]);

  // Herberekende cilinder maanddata op basis van klant filter
  const filteredCylinderDataByCustomer = useMemo(() => {
    // Geen klantfilter actief = gebruik de gastype gefilterde data
    if (selectedCustomers.length === 0) return filteredCylinderData;

    // Herbereken maandtotalen uit klant-specifieke data
    return cylinderData.map((month) => {
      const currentMonthCustomerData = monthlyCustomerCylinderData.current.get(month.month) || [];
      const previousMonthCustomerData = monthlyCustomerCylinderData.previous.get(month.month) || [];

      const currentTotal = currentMonthCustomerData
        .filter(c => selectedCustomers.includes(c.customer_id || c.customer_name))
        .reduce((sum, c) => sum + Number(c.total_cylinders), 0);

      const previousTotal = previousMonthCustomerData
        .filter(c => selectedCustomers.includes(c.customer_id || c.customer_name))
        .reduce((sum, c) => sum + Number(c.total_cylinders), 0);

      const change = currentTotal - previousTotal;
      const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100) : (currentTotal > 0 ? 100 : 0);

      return {
        ...month,
        currentYear: currentTotal,
        previousYear: previousTotal,
        change,
        changePercent
      };
    });
  }, [filteredCylinderData, monthlyCustomerCylinderData, selectedCustomers, cylinderData]);

  // Herberekende cilinder totalen op basis van klant filter
  const filteredCylinderTotalsByCustomer = useMemo(() => {
    // Geen klantfilter = gebruik de gastype gefilterde totalen
    if (selectedCustomers.length === 0) return filteredCylinderTotals;
    if (!cylinderTotals) return null;

    // Bereken totalen alleen voor geselecteerde klanten
    const currentTotal = filteredCustomerComparison.reduce((sum, c) => sum + c.currentCylinders, 0);
    const previousTotal = filteredCustomerComparison.reduce((sum, c) => sum + c.previousCylinders, 0);
    const change = currentTotal - previousTotal;
    const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100) : (currentTotal > 0 ? 100 : 0);
    return { currentYear: currentTotal, previousYear: previousTotal, change, changePercent };
  }, [filteredCylinderTotals, filteredCustomerComparison, selectedCustomers, cylinderTotals]);

  // Gefilterde cilindergrootte vergelijking data
  const filteredCylinderSizeComparison = useMemo(() => {
    if (selectedCylinderSizes.length === 0) return cylinderSizeComparison;
    return cylinderSizeComparison.filter(cs => selectedCylinderSizes.includes(cs.cylinder_size));
  }, [cylinderSizeComparison, selectedCylinderSizes]);

  useEffect(() => {
    // Generate years from 2024 to current year + 1
    const currentYear = new Date().getFullYear();
    const years: number[] = [];
    for (let y = currentYear + 1; y >= 2024; y--) {
      years.push(y);
    }
    setAvailableYears(years);

    // Fetch gas types and cylinder sizes for filters
    fetchGasTypes();
    fetchCylinderSizes();
  }, []);

  const fetchGasTypes = async () => {
    const { data } = await api.gasTypes.getAll();

    if (data) {
      setGasTypes(data);
    }
  };

  const fetchCylinderSizes = async () => {
    const { data } = await api.cylinderSizes.getAll();

    if (data) {
      setCylinderSizes(data);
    }
  };

  useEffect(() => {
    if (selectedYear) {
      fetchYearComparisonData();
    }
  }, [selectedYear, location]);

  const fetchYearComparisonData = async () => {
    setLoading(true);

    const currentYear = selectedYear;
    const previousYear = selectedYear - 1;
    const locationFilter = location === "all" ? null : location;

    // Use database function to get aggregated monthly totals - bypasses the 1000 row limit
    const [
      currentCylinderRes,
      previousCylinderRes,
      currentDryIceRes,
      previousDryIceRes,
      currentGasTypeRes,
      previousGasTypeRes,
      currentCustomerRes,
      previousCustomerRes,
      currentMonthlyCustCylRes,
      previousMonthlyCustCylRes,
      currentCylinderSizeRes,
      previousCylinderSizeRes
    ] = await Promise.all([
      api.reports.getMonthlyOrderTotals(currentYear, "cylinder", locationFilter).then(data => ({ data })).catch(error => ({ data: [], error })),
      api.reports.getMonthlyOrderTotals(previousYear, "cylinder", locationFilter).then(data => ({ data })).catch(error => ({ data: [], error })),
      api.reports.getMonthlyOrderTotals(currentYear, "dry_ice", locationFilter).then(data => ({ data })).catch(error => ({ data: [], error })),
      api.reports.getMonthlyOrderTotals(previousYear, "dry_ice", locationFilter).then(data => ({ data })).catch(error => ({ data: [], error })),
      api.reports.getMonthlyCylinderTotalsByGasType(currentYear, locationFilter).then(data => ({ data })).catch(error => ({ data: [], error })),
      api.reports.getMonthlyCylinderTotalsByGasType(previousYear, locationFilter).then(data => ({ data })).catch(error => ({ data: [], error })),
      api.reports.getYearlyTotalsByCustomer(currentYear, locationFilter).then(data => ({ data })).catch(error => ({ data: [], error })),
      api.reports.getYearlyTotalsByCustomer(previousYear, locationFilter).then(data => ({ data })).catch(error => ({ data: [], error })),
      api.reports.getMonthlyCylinderTotalsByCustomer(currentYear, locationFilter).then(data => ({ data })).catch(error => ({ data: [], error })),
      api.reports.getMonthlyCylinderTotalsByCustomer(previousYear, locationFilter).then(data => ({ data })).catch(error => ({ data: [], error })),
      api.reports.getMonthlyCylinderTotalsBySize(currentYear, locationFilter).then(data => ({ data })).catch(error => ({ data: [], error })),
      api.reports.getMonthlyCylinderTotalsBySize(previousYear, locationFilter).then(data => ({ data })).catch(error => ({ data: [], error }))
    ]);

    // Process cylinder data from aggregated results
    const cylinderMonthly = processMonthlyDataFromAggregated(
      currentCylinderRes.data || [],
      previousCylinderRes.data || []
    );
    setCylinderData(cylinderMonthly);
    setCylinderTotals(calculateTotals(cylinderMonthly));

    // Process dry ice data from aggregated results
    const dryIceMonthly = processMonthlyDataFromAggregated(
      currentDryIceRes.data || [],
      previousDryIceRes.data || []
    );
    setDryIceData(dryIceMonthly);
    setDryIceTotals(calculateTotals(dryIceMonthly));

    // Process gas type comparison data
    const { comparison: gasTypeData, monthlyData, typeInfo } = processGasTypeData(
      currentGasTypeRes.data || [],
      previousGasTypeRes.data || []
    );
    setGasTypeComparison(gasTypeData);
    setMonthlyGasTypeData(monthlyData);
    setGasTypeInfo(typeInfo);

    // Process customer comparison data
    const customerData = processCustomerComparison(
      currentCustomerRes.data || [],
      previousCustomerRes.data || []
    );
    setCustomerComparison(customerData);

    // Process monthly customer cylinder data
    const currentMonthlyCustMap = new Map<number, MonthlyCustomerCylinderData[]>();
    const previousMonthlyCustMap = new Map<number, MonthlyCustomerCylinderData[]>();

    (currentMonthlyCustCylRes.data || []).forEach((item: MonthlyCustomerCylinderData) => {
      const existing = currentMonthlyCustMap.get(item.month) || [];
      existing.push(item);
      currentMonthlyCustMap.set(item.month, existing);
    });

    (previousMonthlyCustCylRes.data || []).forEach((item: MonthlyCustomerCylinderData) => {
      const existing = previousMonthlyCustMap.get(item.month) || [];
      existing.push(item);
      previousMonthlyCustMap.set(item.month, existing);
    });

    setMonthlyCustomerCylinderData({
      current: currentMonthlyCustMap,
      previous: previousMonthlyCustMap
    });

    // Process cylinder size comparison data
    const cylinderSizeData = processCylinderSizeComparison(
      currentCylinderSizeRes.data || [],
      previousCylinderSizeRes.data || []
    );
    setCylinderSizeComparison(cylinderSizeData);

    setLoading(false);
  };

  const processCustomerComparison = (
    currentData: { customer_id: string | null; customer_name: string; total_cylinders: number; total_dry_ice_kg: number }[],
    previousData: { customer_id: string | null; customer_name: string; total_cylinders: number; total_dry_ice_kg: number }[]
  ): CustomerComparison[] => {
    // Create maps for quick lookup
    const currentMap = new Map<string, { cylinders: number; dryIce: number }>();
    const previousMap = new Map<string, { cylinders: number; dryIce: number }>();

    currentData.forEach(item => {
      const key = item.customer_id || item.customer_name;
      currentMap.set(key, {
        cylinders: Number(item.total_cylinders) || 0,
        dryIce: Number(item.total_dry_ice_kg) || 0
      });
    });

    previousData.forEach(item => {
      const key = item.customer_id || item.customer_name;
      previousMap.set(key, {
        cylinders: Number(item.total_cylinders) || 0,
        dryIce: Number(item.total_dry_ice_kg) || 0
      });
    });

    // Get all unique customer keys
    const allCustomers = new Map<string, string>();
    currentData.forEach(item => {
      const key = item.customer_id || item.customer_name;
      allCustomers.set(key, item.customer_name);
    });
    previousData.forEach(item => {
      const key = item.customer_id || item.customer_name;
      if (!allCustomers.has(key)) {
        allCustomers.set(key, item.customer_name);
      }
    });

    const result: CustomerComparison[] = [];

    allCustomers.forEach((name, key) => {
      const current = currentMap.get(key) || { cylinders: 0, dryIce: 0 };
      const previous = previousMap.get(key) || { cylinders: 0, dryIce: 0 };

      const cylinderChange = current.cylinders - previous.cylinders;
      const cylinderChangePercent = previous.cylinders > 0
        ? ((cylinderChange / previous.cylinders) * 100)
        : (current.cylinders > 0 ? 100 : 0);

      const dryIceChange = current.dryIce - previous.dryIce;
      const dryIceChangePercent = previous.dryIce > 0
        ? ((dryIceChange / previous.dryIce) * 100)
        : (current.dryIce > 0 ? 100 : 0);

      result.push({
        customer_id: key.includes('-') ? key : null,
        customer_name: name,
        currentCylinders: current.cylinders,
        previousCylinders: previous.cylinders,
        cylinderChange,
        cylinderChangePercent,
        currentDryIce: current.dryIce,
        previousDryIce: previous.dryIce,
        dryIceChange,
        dryIceChangePercent
      });
    });

    return result;
  };

  const processCylinderSizeComparison = (
    currentData: { month: number; cylinder_size: string; total_cylinders: number }[],
    previousData: { month: number; cylinder_size: string; total_cylinders: number }[]
  ): CylinderSizeComparison[] => {
    // Create maps for yearly totals
    const currentYearMap = new Map<string, number>();
    const previousYearMap = new Map<string, number>();

    currentData.forEach(item => {
      if (!item.cylinder_size) return;
      const existing = currentYearMap.get(item.cylinder_size) || 0;
      currentYearMap.set(item.cylinder_size, existing + (Number(item.total_cylinders) || 0));
    });

    previousData.forEach(item => {
      if (!item.cylinder_size) return;
      const existing = previousYearMap.get(item.cylinder_size) || 0;
      previousYearMap.set(item.cylinder_size, existing + (Number(item.total_cylinders) || 0));
    });

    // Get all unique cylinder sizes
    const allSizes = new Set([...currentYearMap.keys(), ...previousYearMap.keys()]);
    const result: CylinderSizeComparison[] = [];

    allSizes.forEach(size => {
      const currentTotal = currentYearMap.get(size) || 0;
      const previousTotal = previousYearMap.get(size) || 0;
      const change = currentTotal - previousTotal;
      const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100) : (currentTotal > 0 ? 100 : 0);

      result.push({
        cylinder_size: size,
        currentYear: currentTotal,
        previousYear: previousTotal,
        change,
        changePercent
      });
    });

    // Sort by current year total descending
    result.sort((a, b) => b.currentYear - a.currentYear);

    return result;
  };

  const processGasTypeData = (
    currentData: { month: number; gas_type_id: string; gas_type_name: string; gas_type_color: string; total_cylinders: number }[],
    previousData: { month: number; gas_type_id: string; gas_type_name: string; gas_type_color: string; total_cylinders: number }[]
  ) => {
    // Build gas type info map
    const typeInfo = new Map<string, { name: string; color: string }>();

    // Process for yearly comparison
    const currentYearMap = new Map<string, { name: string; color: string; total: number }>();
    const previousYearMap = new Map<string, { name: string; color: string; total: number }>();

    // Build monthly data structures
    const currentMonthlyMap = new Map<number, Map<string, number>>();
    const previousMonthlyMap = new Map<number, Map<string, number>>();

    // Initialize months
    for (let m = 1; m <= 12; m++) {
      currentMonthlyMap.set(m, new Map());
      previousMonthlyMap.set(m, new Map());
    }

    currentData.forEach(item => {
      if (!item.gas_type_id) return;

      // Store type info
      if (!typeInfo.has(item.gas_type_id)) {
        typeInfo.set(item.gas_type_id, {
          name: item.gas_type_name || "Onbekend",
          color: getGasColor(item.gas_type_name || "", item.gas_type_color || "#94a3b8")
        });
      }

      // Yearly totals
      const existing = currentYearMap.get(item.gas_type_id);
      if (existing) {
        existing.total += Number(item.total_cylinders) || 0;
      } else {
        currentYearMap.set(item.gas_type_id, {
          name: item.gas_type_name || "Onbekend",
          color: getGasColor(item.gas_type_name || "", item.gas_type_color || "#94a3b8"),
          total: Number(item.total_cylinders) || 0
        });
      }

      // Monthly data
      const monthMap = currentMonthlyMap.get(item.month);
      if (monthMap) {
        monthMap.set(item.gas_type_id, (monthMap.get(item.gas_type_id) || 0) + Number(item.total_cylinders));
      }
    });

    previousData.forEach(item => {
      if (!item.gas_type_id) return;

      // Store type info
      if (!typeInfo.has(item.gas_type_id)) {
        typeInfo.set(item.gas_type_id, {
          name: item.gas_type_name || "Onbekend",
          color: getGasColor(item.gas_type_name || "", item.gas_type_color || "#94a3b8")
        });
      }

      // Yearly totals
      const existing = previousYearMap.get(item.gas_type_id);
      if (existing) {
        existing.total += Number(item.total_cylinders) || 0;
      } else {
        previousYearMap.set(item.gas_type_id, {
          name: item.gas_type_name || "Onbekend",
          color: getGasColor(item.gas_type_name || "", item.gas_type_color || "#94a3b8"),
          total: Number(item.total_cylinders) || 0
        });
      }

      // Monthly data
      const monthMap = previousMonthlyMap.get(item.month);
      if (monthMap) {
        monthMap.set(item.gas_type_id, (monthMap.get(item.gas_type_id) || 0) + Number(item.total_cylinders));
      }
    });

    // Build yearly comparison
    const allGasTypeIds = new Set([...currentYearMap.keys(), ...previousYearMap.keys()]);
    const comparison: GasTypeYearComparison[] = [];

    allGasTypeIds.forEach(id => {
      const current = currentYearMap.get(id);
      const previous = previousYearMap.get(id);
      const currentTotal = current?.total || 0;
      const previousTotal = previous?.total || 0;
      const change = currentTotal - previousTotal;
      const changePercent = previousTotal > 0 ? ((change / previousTotal) * 100) : (currentTotal > 0 ? 100 : 0);

      comparison.push({
        gas_type_id: id,
        gas_type_name: current?.name || previous?.name || "Onbekend",
        gas_type_color: current?.color || previous?.color || "#94a3b8",
        currentYear: currentTotal,
        previousYear: previousTotal,
        change,
        changePercent
      });
    });

    comparison.sort((a, b) => b.currentYear - a.currentYear);

    // Build monthly chart data
    const currentMonthlyData: MonthlyGasTypeChartData[] = [];
    const previousMonthlyData: MonthlyGasTypeChartData[] = [];

    for (let m = 1; m <= 12; m++) {
      const currentEntry: MonthlyGasTypeChartData = {
        monthName: MONTH_NAMES[m - 1],
        month: m
      };
      const previousEntry: MonthlyGasTypeChartData = {
        monthName: MONTH_NAMES[m - 1],
        month: m
      };

      allGasTypeIds.forEach(id => {
        currentEntry[id] = currentMonthlyMap.get(m)?.get(id) || 0;
        previousEntry[id] = previousMonthlyMap.get(m)?.get(id) || 0;
      });

      currentMonthlyData.push(currentEntry);
      previousMonthlyData.push(previousEntry);
    }

    return {
      comparison,
      monthlyData: { current: currentMonthlyData, previous: previousMonthlyData },
      typeInfo
    };
  };

  const processMonthlyDataFromAggregated = (
    currentData: { month: number; total_value: number }[],
    previousData: { month: number; total_value: number }[]
  ): MonthlyData[] => {
    const monthlyData: MonthlyData[] = [];

    // Create lookup maps for quick access
    const currentMap = new Map(currentData.map(d => [d.month, Number(d.total_value) || 0]));
    const previousMap = new Map(previousData.map(d => [d.month, Number(d.total_value) || 0]));

    for (let month = 1; month <= 12; month++) {
      const currentValue = currentMap.get(month) || 0;
      const previousValue = previousMap.get(month) || 0;
      const change = currentValue - previousValue;
      const changePercent = previousValue > 0 ? ((change / previousValue) * 100) : (currentValue > 0 ? 100 : 0);

      monthlyData.push({
        month,
        monthName: MONTH_NAMES[month - 1],
        currentYear: currentValue,
        previousYear: previousValue,
        change,
        changePercent
      });
    }

    return monthlyData;
  };

  const calculateTotals = (monthlyData: MonthlyData[]): YearlyTotals => {
    const currentYear = monthlyData.reduce((sum, m) => sum + m.currentYear, 0);
    const previousYear = monthlyData.reduce((sum, m) => sum + m.previousYear, 0);
    const change = currentYear - previousYear;
    const changePercent = previousYear > 0 ? ((change / previousYear) * 100) : (currentYear > 0 ? 100 : 0);

    return { currentYear, previousYear, change, changePercent };
  };

  const getGrowthHighlights = (data: MonthlyData[]) => {
    // Filter months with data (at least one of the years has values)
    const validMonths = data.filter(m => m.currentYear > 0 || m.previousYear > 0);

    if (validMonths.length === 0) {
      return { best: null, worst: null };
    }

    const sorted = [...validMonths].sort((a, b) => b.changePercent - a.changePercent);
    return {
      best: sorted[0],
      worst: sorted[sorted.length - 1]
    };
  };

  const getTrendIcon = (changePercent: number) => {
    if (changePercent > 5) return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (changePercent < -5) return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-muted-foreground" />;
  };

  const getChangeColor = (changePercent: number) => {
    if (changePercent > 5) return "text-green-500";
    if (changePercent < -5) return "text-red-500";
    return "text-muted-foreground";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Year Selector */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Jaarvergelijking
          </CardTitle>
          <CardDescription>
            Vergelijk productiedata per maand met het voorgaande jaar
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Vergelijk jaar:</span>
              <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(parseInt(v))}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map(year => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">
                vs {selectedYear - 1}
              </span>
            </div>
          </div>

          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Gas Type Filter */}
            {gasTypes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Filter className="h-4 w-4" />
                  Filter op gastype
                </Label>
                <GasTypeMultiSelect
                  gasTypes={gasTypes}
                  selectedGasTypes={selectedGasTypes}
                  onSelectionChange={setSelectedGasTypes}
                  placeholder="Alle gastypes"
                  className="w-full"
                />
              </div>
            )}

            {/* Cylinder Size Filter */}
            {cylinderSizes.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Filter op cilindergrootte
                </Label>
                <CylinderSizeMultiSelect
                  cylinderSizes={cylinderSizes}
                  selectedCylinderSizes={selectedCylinderSizes}
                  onSelectionChange={setSelectedCylinderSizes}
                  placeholder="Alle cilindergroottes"
                  className="w-full"
                />
              </div>
            )}

            {/* Customer Filter */}
            {customerComparison.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Filter op klant
                </Label>
                <CustomerMultiSelect
                  customers={customerComparison.map(c => ({
                    id: c.customer_id,
                    name: c.customer_name
                  }))}
                  selectedCustomers={selectedCustomers}
                  onSelectionChange={setSelectedCustomers}
                  placeholder="Alle klanten"
                  className="w-full"
                />
              </div>
            )}
          </div>

          {/* Digital filter */}
          {hasDigitalTypes && (
            <div className="flex items-center">
              <Button
                variant={hideDigital ? "default" : "outline"}
                size="sm"
                className="h-8 text-xs gap-1"
                onClick={() => setHideDigital(!hideDigital)}
              >
                ⓓ {hideDigital ? "Toon digitaal" : "Verberg digitaal"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Cylinder Totals */}
        <Card className="glass-card border-orange-500/20">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Cylinder className="h-5 w-5 text-orange-500" />
              Cilinders Jaartotaal
              {selectedGasTypes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedGasTypes.length} gastype(s) gefilterd
                </Badge>
              )}
              {selectedCustomers.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedCustomers.length} klant(en) gefilterd
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredCylinderTotalsByCustomer && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">{selectedYear}</p>
                    <p className="text-2xl font-bold">{formatNumber(filteredCylinderTotalsByCustomer.currentYear, 0)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">{selectedYear - 1}</p>
                    <p className="text-2xl font-bold text-muted-foreground">{formatNumber(filteredCylinderTotalsByCustomer.previousYear, 0)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {getTrendIcon(filteredCylinderTotalsByCustomer.changePercent)}
                  <span className={`font-medium ${getChangeColor(filteredCylinderTotalsByCustomer.changePercent)}`}>
                    {filteredCylinderTotalsByCustomer.change >= 0 ? "+" : ""}{formatNumber(filteredCylinderTotalsByCustomer.change, 0)}
                  </span>
                  <Badge variant={filteredCylinderTotalsByCustomer.changePercent >= 0 ? "default" : "destructive"}>
                    {filteredCylinderTotalsByCustomer.changePercent >= 0 ? "+" : ""}{filteredCylinderTotalsByCustomer.changePercent.toFixed(1)}%
                  </Badge>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {showDryIce && (
          <Card className="glass-card border-cyan-500/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Snowflake className="h-5 w-5 text-cyan-500" />
                Droogijs Jaartotaal (kg)
                {selectedCustomers.length > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {selectedCustomers.length} klant(en) gefilterd
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {filteredDryIceTotals && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">{selectedYear}</p>
                      <p className="text-2xl font-bold">{formatNumber(filteredDryIceTotals.currentYear, 0)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">{selectedYear - 1}</p>
                      <p className="text-2xl font-bold text-muted-foreground">{formatNumber(filteredDryIceTotals.previousYear, 0)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getTrendIcon(filteredDryIceTotals.changePercent)}
                    <span className={`font-medium ${getChangeColor(filteredDryIceTotals.changePercent)}`}>
                      {filteredDryIceTotals.change >= 0 ? "+" : ""}{formatNumber(filteredDryIceTotals.change, 0)} kg
                    </span>
                    <Badge variant={filteredDryIceTotals.changePercent >= 0 ? "default" : "destructive"}>
                      {filteredDryIceTotals.changePercent >= 0 ? "+" : ""}{filteredDryIceTotals.changePercent.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Cumulative Year Charts */}
      <div className={`grid grid-cols-1 ${showDryIce ? 'xl:grid-cols-2' : ''} gap-6`}>
        <CumulativeYearChart type="cylinders" location={location} />
        {showDryIce && <CumulativeYearChart type="dryIce" location={location} />}
      </div>

      {/* Cumulative Gas Type Chart */}
      <CumulativeGasTypeChart />

      {/* Growth Highlights Summary */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            Groei Highlights
            {(selectedGasTypes.length > 0 || selectedCustomers.length > 0) && (
              <Badge variant="secondary" className="ml-2">
                Gefilterd
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Beste en slechtste maanden qua groei t.o.v. {selectedYear - 1}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Cylinder Highlights */}
            <div className="space-y-4">
              <h4 className="font-medium flex items-center gap-2">
                <Cylinder className="h-4 w-4 text-orange-500" />
                Cilinders
                {selectedGasTypes.length > 0 && (
                  <span className="text-xs text-muted-foreground">({selectedGasTypes.length} gastype(s))</span>
                )}
                {selectedCustomers.length > 0 && (
                  <span className="text-xs text-muted-foreground">({selectedCustomers.length} klant(en))</span>
                )}
              </h4>
              {(() => {
                const highlights = getGrowthHighlights(filteredCylinderDataByCustomer);
                const bestIsNegative = highlights.best && highlights.best.changePercent < 0;
                return (
                  <div className="grid grid-cols-2 gap-3">
                    {/* Best Month */}
                    <div className={`p-3 rounded-lg ${bestIsNegative ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-green-500/10 border border-green-500/20"}`}>
                      <div className={`flex items-center gap-1.5 mb-1 ${bestIsNegative ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}>
                        <TrendingUp className="h-4 w-4" />
                        <span className="text-xs font-medium">{bestIsNegative ? "Kleinste daling" : "Beste maand"}</span>
                      </div>
                      {highlights.best ? (
                        <>
                          <p className="text-lg font-bold">{highlights.best.monthName}</p>
                          <p className={`text-sm ${bestIsNegative ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}>
                            {highlights.best.changePercent >= 0 ? "+" : ""}{highlights.best.changePercent.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatNumber(highlights.best.currentYear, 0)} vs {formatNumber(highlights.best.previousYear, 0)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Geen data beschikbaar</p>
                      )}
                    </div>
                    {/* Worst Month */}
                    <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
                        <TrendingDown className="h-4 w-4" />
                        <span className="text-xs font-medium">Grootste daling</span>
                      </div>
                      {highlights.worst ? (
                        <>
                          <p className="text-lg font-bold">{highlights.worst.monthName}</p>
                          <p className="text-sm text-red-600 dark:text-red-400">
                            {highlights.worst.changePercent >= 0 ? "+" : ""}{highlights.worst.changePercent.toFixed(1)}%
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatNumber(highlights.worst.currentYear, 0)} vs {formatNumber(highlights.worst.previousYear, 0)}
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">Geen data beschikbaar</p>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Dry Ice Highlights */}
            {showDryIce && (
              <div className="space-y-4">
                <h4 className="font-medium flex items-center gap-2">
                  <Snowflake className="h-4 w-4 text-cyan-500" />
                  Droogijs
                </h4>
                {(() => {
                  const highlights = getGrowthHighlights(dryIceData);
                  const bestIsNegative = highlights.best && highlights.best.changePercent < 0;
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      {/* Best Month */}
                      <div className={`p-3 rounded-lg ${bestIsNegative ? "bg-yellow-500/10 border border-yellow-500/20" : "bg-green-500/10 border border-green-500/20"}`}>
                        <div className={`flex items-center gap-1.5 mb-1 ${bestIsNegative ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}>
                          <TrendingUp className="h-4 w-4" />
                          <span className="text-xs font-medium">{bestIsNegative ? "Kleinste daling" : "Beste maand"}</span>
                        </div>
                        {highlights.best ? (
                          <>
                            <p className="text-lg font-bold">{highlights.best.monthName}</p>
                            <p className={`text-sm ${bestIsNegative ? "text-yellow-600 dark:text-yellow-400" : "text-green-600 dark:text-green-400"}`}>
                              {highlights.best.changePercent >= 0 ? "+" : ""}{highlights.best.changePercent.toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatNumber(highlights.best.currentYear, 0)} kg vs {formatNumber(highlights.best.previousYear, 0)} kg
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">Geen data beschikbaar</p>
                        )}
                      </div>
                      {/* Worst Month */}
                      <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400 mb-1">
                          <TrendingDown className="h-4 w-4" />
                          <span className="text-xs font-medium">Grootste daling</span>
                        </div>
                        {highlights.worst ? (
                          <>
                            <p className="text-lg font-bold">{highlights.worst.monthName}</p>
                            <p className="text-sm text-red-600 dark:text-red-400">
                              {highlights.worst.changePercent >= 0 ? "+" : ""}{highlights.worst.changePercent.toFixed(1)}%
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatNumber(highlights.worst.currentYear, 0)} kg vs {formatNumber(highlights.worst.previousYear, 0)} kg
                            </p>
                          </>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">Geen data beschikbaar</p>
                        )}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gas Type Year Comparison */}
      {gasTypeComparison.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cylinder className="h-5 w-5 text-orange-500" />
              Cilinders per gastype
              {selectedGasTypes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedGasTypes.length} gefilterd
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Jaarvergelijking {selectedYear} vs {selectedYear - 1} per gastype
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              // Filter gas type comparison based on selected gas types and digital filter
              let filteredGasTypeComparison = gasTypeComparison;
              if (hideDigital) {
                filteredGasTypeComparison = filteredGasTypeComparison.filter(gt => !digitalGasTypeIds.has(gt.gas_type_id));
              }
              if (selectedGasTypes.length > 0) {
                filteredGasTypeComparison = filteredGasTypeComparison.filter(gt => selectedGasTypes.includes(gt.gas_type_id));
              }

              if (filteredGasTypeComparison.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Cylinder className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">Geen data voor geselecteerde gastypes</p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <div>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart
                        data={filteredGasTypeComparison}
                        layout="vertical"
                        margin={{ left: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis
                          type="category"
                          dataKey="gas_type_name"
                          className="text-xs"
                          width={75}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "10px",
                            border: "1px solid hsl(var(--border))",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                            backgroundColor: "hsl(var(--background))",
                            padding: "10px 14px",
                            fontSize: "13px"
                          }}
                          formatter={(value: number, name: string) => [
                            formatNumber(value, 0),
                            name === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()
                          ]}
                        />
                        <Legend
                          formatter={(value) => value === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()}
                        />
                        <Bar dataKey="previousYear" name="previousYear" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="currentYear" name="currentYear" radius={[0, 4, 4, 0]}>
                          {filteredGasTypeComparison.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.gas_type_color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Details Table */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground mb-3">
                      Overzicht per gastype
                    </div>
                    <div className="space-y-2 max-h-[280px] overflow-y-auto">
                      {filteredGasTypeComparison.map((gasType) => (
                        <div
                          key={gasType.gas_type_id}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: gasType.gas_type_color }}
                            />
                            <span className="font-medium">{gasType.gas_type_name}</span>
                            {digitalGasTypeIds.has(gasType.gas_type_id) && (
                              <Badge variant="outline" className="text-[9px] px-1 py-0 border-sky-400/40 text-sky-500 bg-sky-400/10">ⓓ</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-right">
                              <div className="font-medium">{formatNumber(gasType.currentYear, 0)}</div>
                              <div className="text-xs text-muted-foreground">
                                vs {formatNumber(gasType.previousYear, 0)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 min-w-[80px] justify-end">
                              {getTrendIcon(gasType.changePercent)}
                              <Badge
                                variant={gasType.changePercent >= 0 ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {gasType.changePercent >= 0 ? "+" : ""}{gasType.changePercent.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Cylinder Size Year Comparison */}
      {cylinderSizeComparison.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Ruler className="h-5 w-5 text-blue-500" />
              Cilinders per cilindergrootte
              {selectedCylinderSizes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedCylinderSizes.length} gefilterd
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Jaarvergelijking {selectedYear} vs {selectedYear - 1} per cilindergrootte
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              if (filteredCylinderSizeComparison.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Ruler className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">Geen data voor geselecteerde cilindergroottes</p>
                  </div>
                );
              }

              return (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Bar Chart */}
                  <div>
                    <ResponsiveContainer width="100%" height={Math.max(300, filteredCylinderSizeComparison.length * 40)}>
                      <BarChart
                        data={filteredCylinderSizeComparison}
                        layout="vertical"
                        margin={{ left: 80 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" className="text-xs" />
                        <YAxis
                          type="category"
                          dataKey="cylinder_size"
                          className="text-xs"
                          width={75}
                        />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "10px",
                            border: "1px solid hsl(var(--border))",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                            backgroundColor: "hsl(var(--background))",
                            padding: "10px 14px",
                            fontSize: "13px"
                          }}
                          formatter={(value: number, name: string) => [
                            formatNumber(value, 0),
                            name === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()
                          ]}
                        />
                        <Legend
                          formatter={(value) => value === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()}
                        />
                        <Bar dataKey="previousYear" name="previousYear" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="currentYear" name="currentYear" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Details Table */}
                  <div className="space-y-2">
                    <div className="text-sm font-medium text-muted-foreground mb-3">
                      Overzicht per cilindergrootte
                    </div>
                    <div className="space-y-2 max-h-[380px] overflow-y-auto">
                      {filteredCylinderSizeComparison.map((size) => (
                        <div
                          key={size.cylinder_size}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card/50"
                        >
                          <div className="flex items-center gap-3">
                            <Ruler className="h-4 w-4 text-blue-500" />
                            <span className="font-medium">{size.cylinder_size}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="text-right">
                              <div className="font-medium">{formatNumber(size.currentYear, 0)}</div>
                              <div className="text-xs text-muted-foreground">
                                vs {formatNumber(size.previousYear, 0)}
                              </div>
                            </div>
                            <div className="flex items-center gap-1 min-w-[80px] justify-end">
                              {getTrendIcon(size.changePercent)}
                              <Badge
                                variant={size.changePercent >= 0 ? "default" : "destructive"}
                                className="text-xs"
                              >
                                {size.changePercent >= 0 ? "+" : ""}{size.changePercent.toFixed(1)}%
                              </Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Combined Year Comparison per Gas Type */}
      {gasTypeComparison.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cylinder className="h-5 w-5 text-orange-500" />
              Gecombineerde jaarvergelijking per gastype
              {selectedGasTypes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedGasTypes.length} gefilterd
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Beide jaren naast elkaar per gastype — {selectedYear} vs {selectedYear - 1}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              // Get all gas type IDs to display
              const displayGasTypes = selectedGasTypes.length > 0
                ? gasTypeComparison.filter(gt => selectedGasTypes.includes(gt.gas_type_id))
                : gasTypeComparison;

              if (displayGasTypes.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Cylinder className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">Geen data voor geselecteerde gastypes</p>
                  </div>
                );
              }

              // Build combined data for grouped bar chart
              const combinedData = displayGasTypes.map(gasType => ({
                name: gasType.gas_type_name,
                color: gasType.gas_type_color,
                currentYear: gasType.currentYear,
                previousYear: gasType.previousYear,
                changePercent: gasType.changePercent
              }));

              return (
                <div className="space-y-6">
                  {/* Combined Grouped Bar Chart */}
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={combinedData} margin={{ bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis
                        dataKey="name"
                        className="text-xs"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={0}
                      />
                      <YAxis className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "10px",
                          border: "1px solid hsl(var(--border))",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                          backgroundColor: "hsl(var(--background))",
                          padding: "10px 14px",
                          fontSize: "13px"
                        }}
                        formatter={(value: number, name: string) => [
                          formatNumber(value, 0),
                          name === "currentYear" ? `${selectedYear}` : `${selectedYear - 1}`
                        ]}
                        labelFormatter={(label) => label}
                      />
                      <Legend
                        formatter={(value) => value === "currentYear" ? `${selectedYear}` : `${selectedYear - 1}`}
                        verticalAlign="top"
                      />
                      <Bar
                        dataKey="previousYear"
                        name="previousYear"
                        fill="#94a3b8"
                        radius={[4, 4, 0, 0]}
                      />
                      <Bar
                        dataKey="currentYear"
                        name="currentYear"
                        radius={[4, 4, 0, 0]}
                      >
                        {combinedData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Growth Summary per Gas Type */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                    {displayGasTypes.map((gasType) => (
                      <div
                        key={gasType.gas_type_id}
                        className="p-3 rounded-lg border bg-card/50 text-center"
                      >
                        <div
                          className="w-3 h-3 rounded-full mx-auto mb-2"
                          style={{ backgroundColor: gasType.gas_type_color }}
                        />
                        <p className="text-xs font-medium truncate mb-1">{gasType.gas_type_name}</p>
                        <div className="flex items-center justify-center gap-1">
                          {getTrendIcon(gasType.changePercent)}
                          <span className={`text-sm font-bold ${getChangeColor(gasType.changePercent)}`}>
                            {gasType.changePercent >= 0 ? "+" : ""}{gasType.changePercent.toFixed(1)}%
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {formatNumber(gasType.currentYear, 0)} vs {formatNumber(gasType.previousYear, 0)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Monthly Gas Type Breakdown */}
      {gasTypeComparison.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cylinder className="h-5 w-5 text-orange-500" />
              Maandelijkse breakdown per gastype
              {selectedGasTypes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedGasTypes.length} gefilterd
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Cilinders per maand uitgesplitst per gastype — {selectedYear} vs {selectedYear - 1}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {(() => {
              // Get all gas type IDs to display
              const displayGasTypes = selectedGasTypes.length > 0
                ? gasTypeComparison.filter(gt => selectedGasTypes.includes(gt.gas_type_id))
                : gasTypeComparison;

              if (displayGasTypes.length === 0) {
                return (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Cylinder className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">Geen data voor geselecteerde gastypes</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {/* Current Year Chart */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">{selectedYear}</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={monthlyGasTypeData.current}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="monthName" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "10px",
                            border: "1px solid hsl(var(--border))",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                            backgroundColor: "hsl(var(--background))",
                            padding: "10px 14px",
                            fontSize: "13px"
                          }}
                          formatter={(value: number, name: string) => {
                            const info = gasTypeInfo.get(name);
                            return [formatNumber(value, 0), info?.name || name];
                          }}
                        />
                        <Legend
                          formatter={(value) => {
                            const info = gasTypeInfo.get(value);
                            return info?.name || value;
                          }}
                        />
                        {displayGasTypes.map((gasType) => (
                          <Bar
                            key={gasType.gas_type_id}
                            dataKey={gasType.gas_type_id}
                            name={gasType.gas_type_id}
                            stackId="a"
                            fill={gasType.gas_type_color}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Previous Year Chart */}
                  <div>
                    <h4 className="text-sm font-medium mb-3">{selectedYear - 1}</h4>
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={monthlyGasTypeData.previous}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="monthName" className="text-xs" />
                        <YAxis className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} />
                        <Tooltip
                          contentStyle={{
                            borderRadius: "10px",
                            border: "1px solid hsl(var(--border))",
                            boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                            backgroundColor: "hsl(var(--background))",
                            padding: "10px 14px",
                            fontSize: "13px"
                          }}
                          formatter={(value: number, name: string) => {
                            const info = gasTypeInfo.get(name);
                            return [formatNumber(value, 0), info?.name || name];
                          }}
                        />
                        <Legend
                          formatter={(value) => {
                            const info = gasTypeInfo.get(value);
                            return info?.name || value;
                          }}
                        />
                        {displayGasTypes.map((gasType) => (
                          <Bar
                            key={gasType.gas_type_id}
                            dataKey={gasType.gas_type_id}
                            name={gasType.gas_type_id}
                            stackId="a"
                            fill={gasType.gas_type_color}
                          />
                        ))}
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {/* Monthly Comparison Charts */}
      <div className="grid grid-cols-1 gap-6">
        {/* Cylinder Monthly Comparison */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Cylinder className="h-5 w-5 text-orange-500" />
              Cilinders per maand
              {selectedGasTypes.length > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {selectedGasTypes.length} gastype(s) gefilterd
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Vergelijking {selectedYear} vs {selectedYear - 1}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={filteredCylinderDataByCustomer}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="monthName" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} />
                <Tooltip
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid hsl(var(--border))",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                    backgroundColor: "hsl(var(--background))",
                    padding: "10px 14px",
                    fontSize: "13px"
                  }}
                  formatter={(value: number, name: string) => [
                    formatNumber(value, 0),
                    name === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()
                  ]}
                />
                <Legend
                  formatter={(value) => value === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()}
                />
                <Bar dataKey="previousYear" name="previousYear" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="currentYear" name="currentYear" fill="#f97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Dry Ice Monthly Comparison */}
        {showDryIce && (
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Snowflake className="h-5 w-5 text-cyan-500" />
                Droogijs per maand (kg)
              </CardTitle>
              <CardDescription>
                Vergelijking {selectedYear} vs {selectedYear - 1}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dryIceData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="monthName" className="text-xs" />
                  <YAxis className="text-xs" tickFormatter={(value) => formatNumber(value, 0)} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))'
                    }}
                    formatter={(value: number, name: string) => [
                      formatNumber(value, 0) + " kg",
                      name === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()
                    ]}
                  />
                  <Legend
                    formatter={(value) => value === "currentYear" ? selectedYear.toString() : (selectedYear - 1).toString()}
                  />
                  <Bar dataKey="previousYear" name="previousYear" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="currentYear" name="currentYear" fill="#06b6d4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Growth Trend Area Chart */}
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Groeipercentage per maand
            {(selectedGasTypes.length > 0 || selectedCustomers.length > 0) && (
              <Badge variant="secondary" className="ml-2">
                Gefilterd
              </Badge>
            )}
          </CardTitle>
          <CardDescription>
            Procentuele verandering t.o.v. {selectedYear - 1} — boven 0% = groei, onder 0% = daling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart
              data={filteredCylinderDataByCustomer.map((c, i) => ({
                monthName: c.monthName,
                cylinders: parseFloat(c.changePercent.toFixed(1)),
                dryIce: parseFloat((dryIceData[i]?.changePercent || 0).toFixed(1))
              }))}
            >
              <defs>
                <linearGradient id="colorCylinders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorDryIce" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="monthName" className="text-xs" />
              <YAxis
                className="text-xs"
                tickFormatter={(v) => `${v}%`}
                domain={['dataMin - 10', 'dataMax + 10']}
              />
              <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" />
              <Tooltip
                contentStyle={{
                  borderRadius: "10px",
                  border: "1px solid hsl(var(--border))",
                  boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                  backgroundColor: "hsl(var(--background))",
                  padding: "10px 14px",
                  fontSize: "13px"
                }}
                formatter={(value: number, name: string) => [
                  `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`,
                  name
                ]}
                labelFormatter={(label) => `Maand: ${label}`}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="cylinders"
                name="Cilinders"
                stroke="#f97316"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCylinders)"
              />
              {showDryIce && (
                <Area
                  type="monotone"
                  dataKey="dryIce"
                  name="Droogijs"
                  stroke="#06b6d4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorDryIce)"
                />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Growth Line Chart Detail */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="glass-card border-orange-500/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Cylinder className="h-4 w-4 text-orange-500" />
              Cilinders groeitrend
              {selectedGasTypes.length > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5">
                  Gefilterd
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={filteredCylinderDataByCustomer}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="monthName" className="text-xs" tick={{ fontSize: 10 }} />
                <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                <Tooltip
                  contentStyle={{
                    borderRadius: "10px",
                    border: "1px solid hsl(var(--border))",
                    boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                    backgroundColor: "hsl(var(--background))",
                    padding: "10px 14px",
                    fontSize: "13px"
                  }}
                  formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, 'Groei']}
                />
                <Line
                  type="monotone"
                  dataKey="changePercent"
                  name="Groei %"
                  stroke="#f97316"
                  strokeWidth={2}
                  dot={{ fill: "#f97316", r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {showDryIce && (
          <Card className="glass-card border-cyan-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Snowflake className="h-4 w-4 text-cyan-500" />
                Droogijs groeitrend
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={dryIceData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="monthName" className="text-xs" tick={{ fontSize: 10 }} />
                  <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} tick={{ fontSize: 10 }} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))'
                    }}
                    formatter={(value: number) => [`${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, 'Groei']}
                  />
                  <Line
                    type="monotone"
                    dataKey="changePercent"
                    name="Groei %"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={{ fill: "#06b6d4", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Monthly Details Table */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                Maandelijks overzicht
                {(selectedGasTypes.length > 0 || selectedCustomers.length > 0) && (
                  <Badge variant="secondary" className="ml-2">
                    Gefilterd
                  </Badge>
                )}
              </CardTitle>
              <CardDescription>Gedetailleerde vergelijking per maand</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="highlight-significant"
                checked={highlightSignificant}
                onCheckedChange={setHighlightSignificant}
              />
              <Label htmlFor="highlight-significant" className="text-sm cursor-pointer">
                Markeer significante groei (&gt;10% of &lt;-10%)
              </Label>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-3 px-2 font-medium">Maand</th>
                  <th className="text-right py-3 px-2 font-medium" colSpan={3}>Cilinders</th>
                  {showDryIce && <th className="text-right py-3 px-2 font-medium" colSpan={3}>Droogijs (kg)</th>}
                </tr>
                <tr className="border-b text-muted-foreground">
                  <th></th>
                  <th className="text-right py-2 px-2 text-xs">{selectedYear}</th>
                  <th className="text-right py-2 px-2 text-xs">{selectedYear - 1}</th>
                  <th className="text-right py-2 px-2 text-xs">Δ%</th>
                  {showDryIce && (
                    <>
                      <th className="text-right py-2 px-2 text-xs">{selectedYear}</th>
                      <th className="text-right py-2 px-2 text-xs">{selectedYear - 1}</th>
                      <th className="text-right py-2 px-2 text-xs">Δ%</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {filteredCylinderDataByCustomer.map((cylinder, i) => {
                  const dryIce = dryIceData[i];
                  const cylinderSignificant = isSignificantGrowth(cylinder.changePercent);
                  const dryIceSignificant = isSignificantGrowth(dryIce?.changePercent || 0);
                  const rowHighlight = highlightSignificant && (cylinderSignificant || (showDryIce && dryIceSignificant));

                  return (
                    <tr
                      key={cylinder.month}
                      className={`border-b hover:bg-muted/50 transition-colors ${rowHighlight
                        ? cylinderSignificant && cylinder.changePercent > 10 || (showDryIce && dryIceSignificant && (dryIce?.changePercent || 0) > 10)
                          ? "bg-green-500/10"
                          : "bg-red-500/10"
                        : i % 2 === 1 ? "bg-muted/20" : ""
                        }`}
                    >
                      <td className="py-3 px-2 font-medium">
                        {cylinder.monthName}
                        {highlightSignificant && (cylinderSignificant || (showDryIce && dryIceSignificant)) && (
                          <Badge
                            variant={cylinder.changePercent > 10 || (showDryIce && (dryIce?.changePercent || 0) > 10) ? "default" : "destructive"}
                            className="ml-2 text-[10px] px-1.5 py-0"
                          >
                            Significant
                          </Badge>
                        )}
                      </td>
                      <td className={`text-right py-3 px-2 ${highlightSignificant && cylinderSignificant ? "font-semibold" : ""}`}>
                        {formatNumber(cylinder.currentYear, 0)}
                      </td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{formatNumber(cylinder.previousYear, 0)}</td>
                      <td className={`text-right py-3 px-2 ${getChangeColor(cylinder.changePercent)} ${highlightSignificant && cylinderSignificant ? "font-bold" : ""}`}>
                        {cylinder.changePercent >= 0 ? "+" : ""}{cylinder.changePercent.toFixed(1)}%
                      </td>
                      {showDryIce && (
                        <>
                          <td className={`text-right py-3 px-2 ${highlightSignificant && dryIceSignificant ? "font-semibold" : ""}`}>
                            {formatNumber(dryIce?.currentYear || 0, 0)}
                          </td>
                          <td className="text-right py-3 px-2 text-muted-foreground">{formatNumber(dryIce?.previousYear || 0, 0)}</td>
                          <td className={`text-right py-3 px-2 ${getChangeColor(dryIce?.changePercent || 0)} ${highlightSignificant && dryIceSignificant ? "font-bold" : ""}`}>
                            {(dryIce?.changePercent || 0) >= 0 ? "+" : ""}{(dryIce?.changePercent || 0).toFixed(1)}%
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {/* Totals row */}
                <tr className="bg-muted/30 font-bold">
                  <td className="py-3 px-2">Totaal</td>
                  <td className="text-right py-3 px-2">{formatNumber(filteredCylinderTotalsByCustomer?.currentYear || 0, 0)}</td>
                  <td className="text-right py-3 px-2 text-muted-foreground">{formatNumber(filteredCylinderTotalsByCustomer?.previousYear || 0, 0)}</td>
                  <td className={`text-right py-3 px-2 ${getChangeColor(filteredCylinderTotalsByCustomer?.changePercent || 0)}`}>
                    {(filteredCylinderTotalsByCustomer?.changePercent || 0) >= 0 ? "+" : ""}{(filteredCylinderTotalsByCustomer?.changePercent || 0).toFixed(1)}%
                  </td>
                  {showDryIce && (
                    <>
                      <td className="text-right py-3 px-2">{formatNumber(filteredDryIceTotals?.currentYear || 0, 0)}</td>
                      <td className="text-right py-3 px-2 text-muted-foreground">{formatNumber(filteredDryIceTotals?.previousYear || 0, 0)}</td>
                      <td className={`text-right py-3 px-2 ${getChangeColor(filteredDryIceTotals?.changePercent || 0)}`}>
                        {(filteredDryIceTotals?.changePercent || 0) >= 0 ? "+" : ""}{(filteredDryIceTotals?.changePercent || 0).toFixed(1)}%
                      </td>
                    </>
                  )}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Customer Comparison */}
      {customerComparison.length > 0 && (
        <Card className="glass-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5 text-purple-500" />
                  Vergelijking per klant
                </CardTitle>
                <CardDescription>
                  Productietotalen per klant — {selectedYear} vs {selectedYear - 1}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Sorteer op:</Label>
                <Select value={customerSortBy} onValueChange={(v) => setCustomerSortBy(v as "cylinders" | "dryIce" | "total")}>
                  <SelectTrigger className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Totaal</SelectItem>
                    <SelectItem value="cylinders">Cilinders</SelectItem>
                    {showDryIce && <SelectItem value="dryIce">Droogijs</SelectItem>}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {(() => {
              // Filter customers based on selection
              const filteredCustomers = selectedCustomers.length === 0
                ? customerComparison
                : customerComparison.filter(c => {
                  const customerKey = c.customer_id || c.customer_name;
                  return selectedCustomers.includes(customerKey);
                });

              // Sort customers based on selected criteria
              const sortedCustomers = [...filteredCustomers].sort((a, b) => {
                switch (customerSortBy) {
                  case "cylinders":
                    return b.currentCylinders - a.currentCylinders;
                  case "dryIce":
                    return b.currentDryIce - a.currentDryIce;
                  case "total":
                  default:
                    return (b.currentCylinders + b.currentDryIce) - (a.currentCylinders + a.currentDryIce);
                }
              });

              // Take top 15 for the chart
              const topCustomers = sortedCustomers.slice(0, 15);

              return (
                <div className="space-y-6">
                  {/* Customer Chart */}
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart
                      data={topCustomers}
                      layout="vertical"
                      margin={{ left: 120, right: 20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" className="text-xs" />
                      <YAxis
                        type="category"
                        dataKey="customer_name"
                        className="text-xs"
                        width={115}
                        tick={{ fontSize: 11 }}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: "10px",
                          border: "1px solid hsl(var(--border))",
                          boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                          backgroundColor: "hsl(var(--background))",
                          padding: "10px 14px",
                          fontSize: "13px"
                        }}
                        formatter={(value: number, name: string) => {
                          const label = name === "currentCylinders" ? `Cilinders ${selectedYear}` :
                            name === "previousCylinders" ? `Cilinders ${selectedYear - 1}` :
                              name === "currentDryIce" ? `Droogijs ${selectedYear} (kg)` :
                                `Droogijs ${selectedYear - 1} (kg)`;
                          return [value.toLocaleString(), label];
                        }}
                      />
                      <Legend
                        formatter={(value) => {
                          if (value === "currentCylinders") return `Cilinders ${selectedYear}`;
                          if (value === "previousCylinders") return `Cilinders ${selectedYear - 1}`;
                          if (value === "currentDryIce") return `Droogijs ${selectedYear}`;
                          if (value === "previousDryIce") return `Droogijs ${selectedYear - 1}`;
                          return value;
                        }}
                      />
                      {customerSortBy !== "dryIce" && (
                        <>
                          <Bar dataKey="previousCylinders" name="previousCylinders" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="currentCylinders" name="currentCylinders" fill="#f97316" radius={[0, 4, 4, 0]} />
                        </>
                      )}
                      {customerSortBy !== "cylinders" && showDryIce && (
                        <>
                          <Bar dataKey="previousDryIce" name="previousDryIce" fill="#64748b" radius={[0, 4, 4, 0]} />
                          <Bar dataKey="currentDryIce" name="currentDryIce" fill="#06b6d4" radius={[0, 4, 4, 0]} />
                        </>
                      )}
                    </BarChart>
                  </ResponsiveContainer>

                  {/* Customer Details Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-3 px-2 font-medium">Klant</th>
                          <th className="text-right py-3 px-2 font-medium" colSpan={3}>Cilinders</th>
                          {showDryIce && <th className="text-right py-3 px-2 font-medium" colSpan={3}>Droogijs (kg)</th>}
                        </tr>
                        <tr className="border-b text-muted-foreground">
                          <th></th>
                          <th className="text-right py-2 px-2 text-xs">{selectedYear}</th>
                          <th className="text-right py-2 px-2 text-xs">{selectedYear - 1}</th>
                          <th className="text-right py-2 px-2 text-xs">Δ%</th>
                          {showDryIce && (
                            <>
                              <th className="text-right py-2 px-2 text-xs">{selectedYear}</th>
                              <th className="text-right py-2 px-2 text-xs">{selectedYear - 1}</th>
                              <th className="text-right py-2 px-2 text-xs">Δ%</th>
                            </>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {sortedCustomers.map((customer, idx) => {
                          const cylinderSignificant = isSignificantGrowth(customer.cylinderChangePercent);
                          const dryIceSignificant = isSignificantGrowth(customer.dryIceChangePercent);

                          return (
                            <tr
                              key={customer.customer_id || customer.customer_name}
                              className={`border-b hover:bg-muted/50 transition-colors ${idx % 2 === 1 ? "bg-muted/20" : ""}`}
                            >
                              <td className="py-3 px-2 font-medium max-w-[200px] truncate">
                                {customer.customer_name}
                              </td>
                              <td className="text-right py-3 px-2">
                                {customer.currentCylinders.toLocaleString()}
                              </td>
                              <td className="text-right py-3 px-2 text-muted-foreground">
                                {customer.previousCylinders.toLocaleString()}
                              </td>
                              <td className={`text-right py-3 px-2 ${getChangeColor(customer.cylinderChangePercent)}`}>
                                {customer.cylinderChangePercent >= 0 ? "+" : ""}{customer.cylinderChangePercent.toFixed(1)}%
                                {cylinderSignificant && (
                                  <span className="ml-1">
                                    {customer.cylinderChangePercent > 0 ?
                                      <TrendingUp className="h-3 w-3 inline" /> :
                                      <TrendingDown className="h-3 w-3 inline" />
                                    }
                                  </span>
                                )}
                              </td>
                              {showDryIce && (
                                <>
                                  <td className="text-right py-3 px-2">
                                    {customer.currentDryIce.toLocaleString()}
                                  </td>
                                  <td className="text-right py-3 px-2 text-muted-foreground">
                                    {customer.previousDryIce.toLocaleString()}
                                  </td>
                                  <td className={`text-right py-3 px-2 ${getChangeColor(customer.dryIceChangePercent)}`}>
                                    {customer.dryIceChangePercent >= 0 ? "+" : ""}{customer.dryIceChangePercent.toFixed(1)}%
                                    {dryIceSignificant && (
                                      <span className="ml-1">
                                        {customer.dryIceChangePercent > 0 ?
                                          <TrendingUp className="h-3 w-3 inline" /> :
                                          <TrendingDown className="h-3 w-3 inline" />
                                        }
                                      </span>
                                    )}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
});

YearComparisonReport.displayName = "YearComparisonReport";
