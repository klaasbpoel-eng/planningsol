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
