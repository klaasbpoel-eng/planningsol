import { differenceInCalendarDays, isSameDay, startOfYear, subDays, subYears } from "date-fns";

export type ProductionLocationKey = "sol_emmen" | "sol_tilburg" | "unknown";

export function mapProductionLocation(value: unknown): ProductionLocationKey {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized.includes("emmen")) return "sol_emmen";
  if (normalized.includes("tilburg")) return "sol_tilburg";
  return "unknown";
}

export function isYearToDateRange(from: Date, to: Date, today = new Date()): boolean {
  const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const normalizedTo = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return isSameDay(from, startOfYear(from))
    && from.getFullYear() === normalizedToday.getFullYear()
    && normalizedTo <= normalizedToday;
}

export function getComparisonRange(from: Date, to: Date, today = new Date()): { from: Date; to: Date; label: string } {
  if (isYearToDateRange(from, to, today)) {
    return {
      from: subYears(from, 1),
      to: subYears(to, 1),
      label: "dezelfde periode vorig jaar",
    };
  }

  const length = differenceInCalendarDays(to, from);
  const previousTo = subDays(from, 1);
  return {
    from: subDays(previousTo, length),
    to: previousTo,
    label: "vorige periode",
  };
}

export function calculatePercentageChange(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return ((current - previous) / previous) * 100;
}

export function calculatePercentageTrend(current: number, previous: number): number | null {
  const change = calculatePercentageChange(current, previous);
  if (change === null) return null;
  const percentage = Math.round(change);
  return Math.max(-500, Math.min(500, percentage));
}