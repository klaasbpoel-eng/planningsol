import { addDays, startOfDay } from "date-fns";

export type FillPlanMethod = "hybrid" | "customer_interval" | "weekday_avg";
export type SafetyBufferMode = "units" | "percent";
export type LocFilter = "Alle" | "Emmen" | "Tilburg";
export type PackageFilter = "Alle" | "Cilinders" | "Bundels";

export interface CustomerScheduleInput {
  customerName: string;
  lastDeliveryDate: Date;
  medianInterval: number; // median days between deliveries (robust against outlier gaps)
  avgAmount: number;      // recent-weighted avg stuks per delivery
  deliveryCount: number;
}

export interface FillPlanProductInput {
  key: string;
  product: string;
  packageType: string;        // TypeVerpakking uit Voorraad/Afname (bv. "Cylinders Active Integrated Alu 200 Bar.")
  location: string;
  capacityPerUnit: number;
  isBundle: boolean;
  packSize: number;           // cylinders per bundle (1 for single cylinders)
  startStock: number;         // current filled stock in units
  weekdayTotals12w: number[]; // [Ma, Di, Wo, Do, Vr] total delivered in last 12 weeks
  customerSchedules: CustomerScheduleInput[];
}

export interface FillPlanOptions {
  horizonDays: number;             // e.g. 5, 10, 15 workdays
  safetyBuffer: number;            // e.g. 0, 2, 5 (units) or 10, 20 (%)
  safetyBufferMode: SafetyBufferMode;
  method: FillPlanMethod;
  today?: Date;
}

export interface FillPlanDayEntry {
  date: string;                 // YYYY-MM-DD
  expectedDemand: number;       // stuks verwacht deze dag
  projectedStockBefore: number; // voorraad voor vraag van die dag
  projectedStockAfter: number;  // voorraad na vraag, voor vullen
  safetyTarget: number;         // benodigde minimumvoorraad op deze dag
  suggestedFill: number;        // stuks bij te vullen om voorraad >= safetyTarget te houden
  endStock: number;             // voorraad einde dag (na vulling)
}

export interface FillPlanItem {
  product: string;
  packageType: string;
  location: string;
  capacityPerUnit: number;
  isBundle: boolean;
  packSize: number;
  startStock: number;
  totalExpectedDemand: number;
  totalSuggestedFill: number;
  perDay: FillPlanDayEntry[];
}

export interface FillPlanDayProductItem {
  product: string;
  packageType: string;
  location: string;
  capacityPerUnit: number;
  isBundle: boolean;
  packSize: number;
  currentStock: number;
  expectedDemand: number;
  projectedStockBefore: number;
  safetyTarget: number;
  suggestedFill: number;
}

export interface FillPlanDay {
  date: string;
  dayLabel: string;
  totalExpectedDemand: number;
  totalSuggestedFill: number;
  items: FillPlanDayProductItem[];
}

export interface FillPlanResult {
  fillPlan: FillPlanItem[];
  fillPlanByDay: FillPlanDay[];
}

export function computeMedian(values: number[]): number {
  if (values.length === 0) return 1;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

export function buildWorkdays(todayInput: Date, count: number): { date: Date; key: string; weekdayIdx: number; dayLabel: string }[] {
  const today = startOfDay(todayInput);
  const days: { date: Date; key: string; weekdayIdx: number; dayLabel: string }[] = [];
  const cursor = new Date(today);

  while (days.length < count) {
    const dow = cursor.getDay(); // 0=Sun, 6=Sat
    if (dow !== 0 && dow !== 6) {
      const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
      const dayLabel = cursor.toLocaleDateString("nl-NL", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
      days.push({
        date: new Date(cursor),
        key,
        weekdayIdx: dow - 1, // 0=Ma .. 4=Vr
        dayLabel,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function computeFillPlan(
  inputs: FillPlanProductInput[],
  options: FillPlanOptions
): FillPlanResult {
  const today = startOfDay(options.today ?? new Date());
  const horizonDays = Math.max(1, Math.min(30, Math.round(options.horizonDays || 5)));
  const safetyBuffer = Math.max(0, Number(options.safetyBuffer) || 0);
  const safetyBufferMode = options.safetyBufferMode || "units";
  const method = options.method || "hybrid";

  const planDays = buildWorkdays(today, horizonDays);
  const planLastDate = planDays[planDays.length - 1].date;

  const dayIndexFor = (d: Date): number => {
    if (d < today) return 0;
    for (let i = 0; i < planDays.length; i++) {
      if (d <= planDays[i].date) return i;
    }
    return -1;
  };

  const fillPlan: FillPlanItem[] = [];

  for (const input of inputs) {
    if (!input.product || !input.location || input.product === "Onbekend") continue;

    // 1. Customer-interval demand per day
    const customerDemand = new Array<number>(horizonDays).fill(0);
    for (const sched of input.customerSchedules) {
      const interval = Math.max(1, Math.round(sched.medianInterval));
      let cursorDate = addDays(startOfDay(sched.lastDeliveryDate), interval);
      let safety = 0;
      while (cursorDate <= planLastDate && safety < 30) {
        const idx = dayIndexFor(cursorDate);
        if (idx >= 0) {
          customerDemand[idx] += sched.avgAmount;
        }
        cursorDate = addDays(cursorDate, interval);
        safety++;
      }
    }

    // 2. Historical 12-week weekday average demand per day
    const weekdayDemand = planDays.map((pd) => {
      const total12w = input.weekdayTotals12w[pd.weekdayIdx] || 0;
      return total12w / 12;
    });

    // 3. Combine according to selected method
    const combinedDemand = planDays.map((_, i) => {
      const cDem = customerDemand[i];
      const wDem = weekdayDemand[i];
      if (method === "customer_interval") return cDem;
      if (method === "weekday_avg") return wDem;
      // hybrid: when both signals exist, blend 60% customer cadence + 40% weekday baseline,
      // and never under-predict when a clear repeat customer order is due or steady weekday flow exists.
      if (cDem > 0 && wDem > 0) {
        return Math.max(cDem * 0.65 + wDem * 0.35, wDem * 0.75);
      }
      return cDem > 0 ? cDem : wDem;
    });

    const totalRawDemand = combinedDemand.reduce((s, d) => s + d, 0);
    const hasAnyRoundedDemand = combinedDemand.some((d) => Math.round(d) > 0);
    if (totalRawDemand <= 0 || (!hasAnyRoundedDemand && totalRawDemand < 0.5)) continue;

    let running = input.startStock;
    let totalFill = 0;
    let totalRoundedDemand = 0;

    const perDay: FillPlanDayEntry[] = planDays.map((pd, i) => {
      const expectedDemand = Math.round(combinedDemand[i]);
      totalRoundedDemand += expectedDemand;
      const projectedStockBefore = Math.round(running);
      const projectedStockAfter = Math.round(running - expectedDemand);

      const safetyTarget =
        safetyBufferMode === "percent"
          ? Math.ceil(expectedDemand * (safetyBuffer / 100))
          : Math.round(safetyBuffer);

      let suggestedFill = 0;
      // Only trigger a fill if there is demand on this day (or stock is already below safetyTarget on day 0 with demand in horizon)
      if (projectedStockAfter < safetyTarget && (expectedDemand > 0 || (i === 0 && totalRawDemand > 0))) {
        suggestedFill = Math.ceil(safetyTarget - projectedStockAfter);
      }

      totalFill += suggestedFill;
      const endStock = projectedStockAfter + suggestedFill;
      running = endStock;

      return {
        date: pd.key,
        expectedDemand,
        projectedStockBefore,
        projectedStockAfter,
        safetyTarget,
        suggestedFill,
        endStock: Math.round(endStock),
      };
    });

    if (totalRoundedDemand <= 0 && totalFill <= 0) continue;

    fillPlan.push({
      product: input.product,
      packageType: input.packageType,
      location: input.location,
      capacityPerUnit: input.capacityPerUnit,
      isBundle: input.isBundle,
      packSize: input.packSize,
      startStock: Math.round(input.startStock),
      totalExpectedDemand: totalRoundedDemand,
      totalSuggestedFill: totalFill,
      perDay,
    });
  }

  // Sort: earliest required fill first, then highest total fill, then highest demand
  fillPlan.sort((a, b) => {
    const aFirstFillDay = a.perDay.findIndex((p) => p.suggestedFill > 0);
    const bFirstFillDay = b.perDay.findIndex((p) => p.suggestedFill > 0);
    const aDay = aFirstFillDay === -1 ? 999 : aFirstFillDay;
    const bDay = bFirstFillDay === -1 ? 999 : bFirstFillDay;
    if (aDay !== bDay) return aDay - bDay;
    if (b.totalSuggestedFill !== a.totalSuggestedFill) return b.totalSuggestedFill - a.totalSuggestedFill;
    return b.totalExpectedDemand - a.totalExpectedDemand;
  });

  const fillPlanByDay: FillPlanDay[] = planDays.map((pd, i) => {
    const items: FillPlanDayProductItem[] = fillPlan
      .filter((fp) => fp.perDay[i].suggestedFill > 0)
      .map((fp) => ({
        product: fp.product,
        packageType: fp.packageType,
        location: fp.location,
        capacityPerUnit: fp.capacityPerUnit,
        isBundle: fp.isBundle,
        packSize: fp.packSize,
        currentStock: fp.startStock,
        expectedDemand: fp.perDay[i].expectedDemand,
        projectedStockBefore: fp.perDay[i].projectedStockBefore,
        safetyTarget: fp.perDay[i].safetyTarget,
        suggestedFill: fp.perDay[i].suggestedFill,
      }))
      .sort((a, b) => b.suggestedFill - a.suggestedFill);

    return {
      date: pd.key,
      dayLabel: pd.dayLabel,
      totalExpectedDemand: items.reduce((s, it) => s + it.expectedDemand, 0),
      totalSuggestedFill: items.reduce((s, it) => s + it.suggestedFill, 0),
      items,
    };
  });

  return { fillPlan, fillPlanByDay };
}

export function filterFillPlan(
  fillPlan: FillPlanItem[],
  fillPlanByDay: FillPlanDay[],
  filters: { location: LocFilter; search: string; packageFilter: PackageFilter }
): FillPlanResult {
  const qLower = filters.search.trim().toLowerCase();

  const matches = (item: { product: string; packageType: string; location: string; isBundle: boolean }) => {
    const matchLoc = filters.location === "Alle" || item.location === filters.location;
    const matchQ =
      qLower === "" ||
      item.product.toLowerCase().includes(qLower) ||
      (item.packageType || "").toLowerCase().includes(qLower);
    const matchPkg =
      filters.packageFilter === "Alle" ||
      (filters.packageFilter === "Bundels" ? item.isBundle : !item.isBundle);
    return matchLoc && matchQ && matchPkg;
  };

  const filteredFillPlan = fillPlan.filter(matches);

  // Recalculate per-day totals from the filtered items so day tabs always match the table below!
  const filteredByDay: FillPlanDay[] = fillPlanByDay.map((d) => {
    const items = d.items.filter(matches);
    return {
      ...d,
      items,
      totalExpectedDemand: items.reduce((s, it) => s + it.expectedDemand, 0),
      totalSuggestedFill: items.reduce((s, it) => s + it.suggestedFill, 0),
    };
  });

  return { fillPlan: filteredFillPlan, fillPlanByDay: filteredByDay };
}
