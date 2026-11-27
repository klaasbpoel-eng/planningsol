import { differenceInCalendarDays, endOfYear, startOfYear } from "date-fns";
import { calculatePercentageChange } from "./productionMetrics";

export function reportChange(current: number, previous: number): string {
  const change = calculatePercentageChange(current, previous);
  if (change === null) return "Geen basis";
  return `${change > 0 ? "+" : ""}${change.toLocaleString("nl-NL", { maximumFractionDigits: 1 })}%`;
}

export function shareOfTotal(value: number, total: number): number | null {
  return total > 0 ? value / total * 100 : null;
}

export function targetProgress(value: number, target: number) {
  if (target <= 0) return null;
  const percentage = value / target * 100;
  return { percentage, barPercentage: Math.max(0, Math.min(100, percentage)) };
}

export function calendarYearProgress(date: Date) {
  const start = startOfYear(date);
  const elapsedDays = differenceInCalendarDays(date, start) + 1;
  const totalDays = differenceInCalendarDays(endOfYear(date), start) + 1;
  return { elapsedDays, totalDays, fraction: elapsedDays / totalDays };
}

export function splitSeriesName(name: string): [string, string] {
  const separator = name.lastIndexOf("_");
  return separator < 0 ? [name, ""] : [name.slice(0, separator), name.slice(separator + 1)];
}