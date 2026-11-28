import type { FillPlanDay, FillPlanDayProductItem } from "@/lib/fillPlanning";

export interface UnitTotals {
  cylinders: number;
  bundles: number;
  /** Bundels omgerekend naar losse cilinders (aantal × cilinders per bundel). */
  bundleCylinders: number;
}

type Countable = { isBundle: boolean; packSize: number };

/** Telt cilinders en bundels apart op, zodat ze niet als één "stuks" samengevoegd worden. */
export function summarizeByUnit<T extends Countable>(items: T[], value: (item: T) => number): UnitTotals {
  return items.reduce<UnitTotals>(
    (acc, it) => {
      const v = value(it);
      if (it.isBundle) {
        acc.bundles += v;
        acc.bundleCylinders += v * Math.max(1, it.packSize || 1);
      } else {
        acc.cylinders += v;
      }
      return acc;
    },
    { cylinders: 0, bundles: 0, bundleCylinders: 0 }
  );
}

/** Deel van de verwachte vraag dat uit bestaande voorraad komt (nooit negatief). */
export function coveredByStock(demand: number, fill: number): number {
  return Math.max(0, demand - fill);
}

/** Tekort na de vraag van die dag t.o.v. het bufferdoel: verklaart het bijvul-advies. */
export function shortageAfterDemand(it: Pick<FillPlanDayProductItem, "projectedStockBefore" | "expectedDemand" | "safetyTarget">): number {
  return Math.max(0, it.safetyTarget - (it.projectedStockBefore - it.expectedDemand));
}

const fmtDay = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("nl-NL", { weekday: "short", day: "numeric", month: "short" });

/** Bijv. "ma 30 nov t/m vr 4 dec". */
export function dayRangeLabel(days: Pick<FillPlanDay, "date">[]): string {
  if (days.length === 0) return "";
  const first = fmtDay(days[0].date);
  if (days.length === 1) return first;
  return `${first} t/m ${fmtDay(days[days.length - 1].date)}`;
}

export function unitWord(isBundle: boolean, n: number): string {
  if (isBundle) return n === 1 ? "bundel" : "bundels";
  return n === 1 ? "cilinder" : "cilinders";
}

export function formatLiters(l: number): string {
  return `${l.toLocaleString("nl-NL", { maximumFractionDigits: 1 })} L`;
}
