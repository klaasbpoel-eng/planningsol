/**
 * Personal table-column order, stored in app_settings so it follows an account
 * across browsers and devices instead of belonging to one local browser.
 */
export function columnOrderKey(table: string, userId: string): string {
  return `column_order_${table}_${userId}`;
}

/** Read a stored JSON array; broken or non-string entries never become column keys. */
export function parseColumnOrder(value: unknown): string[] {
  if (typeof value !== "string" || value.trim() === "") return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return [...new Set(parsed.filter((key): key is string => typeof key === "string" && key.trim() !== ""))];
  } catch {
    return [];
  }
}
