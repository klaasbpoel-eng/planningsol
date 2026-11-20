import { addDays, startOfDay } from "date-fns";

export type FillPlanMethod = "ewma_seasonal" | "hybrid" | "customer_interval" | "weekday_avg";
export type SafetyBufferMode = "units" | "percent" | "service_level";
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
  packageType: string;           // TypeVerpakking uit Voorraad/Afname (bv. "Cylinders Active Integrated Alu 200 Bar.")
  location: string;
  capacityPerUnit: number;       // effectieve cilinderinhoud in L (bv. 50)
  displayCapacityLiters: number; // weergave-inhoud in L (voor bundels bv. 800 L / 640 L, voor cilinders = capacityPerUnit)
  isBundle: boolean;
  packSize: number;              // cilinders per bundel (1 voor losse cilinders)
  startStock: number;            // huidige volle voorraad in stuks
  weekdayTotals12w: number[];    // [Ma, Di, Wo, Do, Vr] totaal geleverd afgelopen 12 weken
  weekdayBuckets12w?: number[][]; // [5][12]: per weekdag (0=Ma..4=Vr), 12 weekbuckets (index 0 = meest recent .. 11 = 12 wkn terug)
  seasonalFactor?: number;       // YoY seizoensfactor (begrensd op [0.75, 1.35], standaard 1.0)
  customerSchedules: CustomerScheduleInput[];
}

export interface FillPlanOptions {
  horizonDays: number;             // bv. 5, 10, 15 werkdagen
  safetyBuffer: number;            // stuks, %, of servicegraad (90, 95, 99)
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
  displayCapacityLiters: number;
  isBundle: boolean;
  packSize: number;
  startStock: number;
  seasonalFactor: number;
  dailyStdDev: number;
  totalExpectedDemand: number;
  totalSuggestedFill: number;
  perDay: FillPlanDayEntry[];
}

export interface FillPlanDayProductItem {
  product: string;
  packageType: string;
  location: string;
  capacityPerUnit: number;
  displayCapacityLiters: number;
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

// Verouderde/uitgefaseerde producten of verpakkingstypes die niet in de vulplanning getoond hoeven te worden
export const EXCLUDED_FILL_PLAN_PRODUCTS: { product?: string; packageType?: string }[] = [
  {
    product: "zuurstof medicinaal gasv. sol in cylinders aluminium integrated",
  },
  {
    packageType: "cylinders aluminium integrated 200 bar",
  },
];

export function isExcludedFillPlanProduct(product: string, packageType?: string): boolean {
  const prodLower = (product || "").trim().toLowerCase();
  const pkgLower = (packageType || "").trim().toLowerCase();
  return EXCLUDED_FILL_PLAN_PRODUCTS.some((rule) => {
    if (rule.product && rule.packageType) {
      return prodLower === rule.product && pkgLower === rule.packageType;
    }
    if (rule.product) return prodLower === rule.product;
    if (rule.packageType) return pkgLower === rule.packageType;
    return false;
  });
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

export function computePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

/**
 * Winsorized EWMA over 12 weekly buckets (index 0 = most recent week, 11 = 12 weeks ago).
 * Dampens single-week extreme spikes and weights recent weeks higher (decay = 0.84^weekAge).
 */
export function computeWinsorizedEwma(weeklyBuckets: number[], decay = 0.84): number {
  if (!weeklyBuckets || weeklyBuckets.length === 0) return 0;
  const nonZero = weeklyBuckets.filter((v) => v > 0);
  if (nonZero.length === 0) return 0;

  // Cap extreme one-off spikes when we have at least 3 active weeks on this weekday
  let cap = Infinity;
  if (nonZero.length >= 3) {
    const med = computeMedian(nonZero);
    const p75 = computePercentile(nonZero, 0.75);
    cap = Math.max(p75 * 2.2, med * 2.5, 1);
  }

  let weightedSum = 0;
  let weightTotal = 0;
  for (let age = 0; age < weeklyBuckets.length; age++) {
    const w = Math.pow(decay, age);
    const val = Math.min(weeklyBuckets[age] || 0, cap);
    weightedSum += val * w;
    weightTotal += w;
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0;
}

/**
 * Standard deviation of daily demand across the 12-week weekday buckets (used for service-level safety buffer).
 */
export function computeDailyStdDev(weekdayBuckets12w?: number[][], weekdayTotals12w?: number[]): number {
  if (weekdayBuckets12w && weekdayBuckets12w.length === 5) {
    const allDays: number[] = [];
    for (let d = 0; d < 5; d++) {
      const buckets = weekdayBuckets12w[d] || [];
      for (let w = 0; w < buckets.length; w++) {
        allDays.push(buckets[w] || 0);
      }
    }
    if (allDays.length > 1) {
      const mean = allDays.reduce((s, v) => s + v, 0) / allDays.length;
      const variance = allDays.reduce((s, v) => s + (v - mean) ** 2, 0) / allDays.length;
      return Math.sqrt(variance);
    }
  }
  if (weekdayTotals12w && weekdayTotals12w.length === 5) {
    const avgs = weekdayTotals12w.map((t) => t / 12);
    const mean = avgs.reduce((s, v) => s + v, 0) / 5;
    const variance = avgs.reduce((s, v) => s + (v - mean) ** 2, 0) / 5;
    return Math.sqrt(variance);
  }
  return 0;
}

export function serviceLevelToZ(serviceLevelPct: number): number {
  if (serviceLevelPct >= 99) return 2.33;
  if (serviceLevelPct >= 95) return 1.65;
  if (serviceLevelPct >= 90) return 1.28;
  if (serviceLevelPct >= 80) return 0.84;
  return 0;
}

export function buildWorkdays(
  todayInput: Date,
  count: number
): { date: Date; key: string; weekdayIdx: number; dayLabel: string }[] {
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
  const method = options.method || "ewma_seasonal";

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
    if (isExcludedFillPlanProduct(input.product, input.packageType)) continue;

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

    // 2. Plain 12-week weekday average demand per day
    const weekdayDemand = planDays.map((pd) => {
      const total12w = input.weekdayTotals12w[pd.weekdayIdx] || 0;
      return total12w / 12;
    });

    // 3. Winsorized EWMA + YoY seasonal factor per weekday
    const seasonalFactor = Math.min(1.35, Math.max(0.75, input.seasonalFactor ?? 1.0));
    const ewmaSeasonalDemand = planDays.map((pd) => {
      const buckets = input.weekdayBuckets12w?.[pd.weekdayIdx];
      const base = buckets
        ? computeWinsorizedEwma(buckets)
        : (input.weekdayTotals12w[pd.weekdayIdx] || 0) / 12;
      return base * seasonalFactor;
    });

    // 4. Combine according to selected method
    const combinedDemand = planDays.map((_, i) => {
      const cDem = customerDemand[i];
      const wDem = weekdayDemand[i];
      const eDem = ewmaSeasonalDemand[i];

      if (method === "customer_interval") return cDem;
      if (method === "weekday_avg") return wDem;
      if (method === "ewma_seasonal") {
        // Primary: winsorized EWMA × YoY seasonal factor; fallback to customer cadence if no 12w weekday history
        return eDem > 0 ? eDem : cDem;
      }
      // hybrid: blend customer cadence + weekday baseline
      if (cDem > 0 && wDem > 0) {
        return Math.max(cDem * 0.65 + wDem * 0.35, wDem * 0.75);
      }
      return cDem > 0 ? cDem : wDem;
    });

    const totalRawDemand = combinedDemand.reduce((s, d) => s + d, 0);
    const hasAnyRoundedDemand = combinedDemand.some((d) => Math.round(d) > 0);
    if (totalRawDemand <= 0 || (!hasAnyRoundedDemand && totalRawDemand < 0.5)) continue;

    const dailyStdDev = computeDailyStdDev(input.weekdayBuckets12w, input.weekdayTotals12w);
    const serviceLevelZ = safetyBufferMode === "service_level" ? serviceLevelToZ(safetyBuffer) : 0;

    let running = input.startStock;
    let totalFill = 0;
    let totalRoundedDemand = 0;

    const perDay: FillPlanDayEntry[] = planDays.map((pd, i) => {
      const expectedDemand = Math.round(combinedDemand[i]);
      totalRoundedDemand += expectedDemand;
      const projectedStockBefore = Math.round(running);
      const projectedStockAfter = Math.round(running - expectedDemand);

      let safetyTarget = 0;
      if (safetyBufferMode === "percent") {
        safetyTarget = Math.ceil(expectedDemand * (safetyBuffer / 100));
      } else if (safetyBufferMode === "service_level") {
        safetyTarget = expectedDemand > 0 || i === 0 ? Math.ceil(serviceLevelZ * dailyStdDev) : 0;
      } else {
        safetyTarget = Math.round(safetyBuffer);
      }

      let suggestedFill = 0;
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

    const displayCapacityLiters = input.isBundle
      ? input.displayCapacityLiters >= 200
        ? input.displayCapacityLiters
        : 800
      : input.displayCapacityLiters || input.capacityPerUnit;

    fillPlan.push({
      product: input.product,
      packageType: input.packageType,
      location: input.location,
      capacityPerUnit: input.capacityPerUnit,
      displayCapacityLiters,
      isBundle: input.isBundle,
      packSize: input.packSize,
      startStock: Math.round(input.startStock),
      seasonalFactor,
      dailyStdDev: Math.round(dailyStdDev * 10) / 10,
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
        displayCapacityLiters: fp.displayCapacityLiters,
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
