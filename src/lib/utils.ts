import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Format a number with Dutch locale (dot as thousand separator)
 * e.g., 1234 -> "1.234", 1234.56 -> "1.234,56"
 */
export function formatNumber(value: number | string, decimals?: number): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";

  return num.toLocaleString("nl-NL", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals ?? 2,
  });
}

/**
 * Normalize a "Datum" value (from MSSQL Productie source) to ISO yyyy-MM-dd.
 * Accepts:
 *  - already-ISO strings (yyyy-MM-dd or yyyy-MM-ddTHH:mm:ss)
 *  - dd-MM-yyyy / dd/MM/yyyy
 *  - Date objects / numeric timestamps
 * Returns "" when the value cannot be parsed.
 */
export function normalizeDatum(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") {
    const d = new Date(value);
    return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  }
  const raw = String(value).trim();
  if (!raw) return "";

  // ISO yyyy-MM-dd (optionally with time)
  const isoMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;

  // dd-MM-yyyy or dd/MM/yyyy
  const dmy = raw.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    return `${dmy[3]}-${mm}-${dd}`;
  }

  const d = new Date(raw);
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}
