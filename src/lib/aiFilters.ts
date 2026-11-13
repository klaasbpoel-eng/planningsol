/** Turns the filter plan that Lovable AI made from a plain-language request into database conditions. */
import { buildValueFilter, formatCellValue, type ColumnFilter, type DataColumn } from "@/lib/dataTable";

export type AiOperator = "contains" | "equals" | "one_of" | "gt" | "gte" | "lt" | "lte";

export interface AiPlanFilter {
  column: string;
  operator: AiOperator;
  value: string | null;
  values: string[];
}

export interface AiFilterPlan {
  filters: AiPlanFilter[];
  explanation: string;
}

/** One rule shown as a removable label; its conditions all apply together. */
export interface AiRule {
  id: string;
  description: string;
  filters: ColumnFilter[];
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const ISO_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?$/;
const COMPARE: Record<"gt" | "gte" | "lt" | "lte", ColumnFilter["op"]> = { gt: "gt", gte: "gte", lt: "lt", lte: "lte" };

const clean = (text: string) => text.replace(/[()*"\\]/g, " ").replace(/\s+/g, " ").trim();

function nextDay(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return next.toISOString().slice(0, 10);
}

function validDate(text: string): boolean {
  if (!ISO_DAY.test(text) && !ISO_DATE_TIME.test(text)) return false;
  const [y, m, d] = text.slice(0, 10).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

const showValue = (column: DataColumn, value: string) =>
  column.kind === "number" ? formatCellValue(Number(value), "number") : column.kind === "date" ? formatCellValue(value, "date") : `"${value}"`;

function words(column: DataColumn, op: "gt" | "gte" | "lt" | "lte"): string {
  if (column.kind === "date") return { gt: "na", gte: "vanaf", lt: "vóór", lte: "tot en met" }[op];
  return { gt: "groter dan", gte: "minimaal", lt: "kleiner dan", lte: "maximaal" }[op];
}

/** Conditions and a Dutch description for one AI filter; null when it does not fit the column. */
function toRule(column: DataColumn, filter: AiPlanFilter): Omit<AiRule, "id"> | null {
  const value = (filter.value ?? "").trim();
  const name = column.label;

  if (filter.operator === "one_of") {
    let values = filter.values.map((v) => v.trim()).filter(Boolean);
    if (column.kind === "number") values = values.filter((v) => Number.isFinite(Number(v)) && v !== "");
    else if (column.kind !== "text") return null;
    if (values.length === 0) return null;
    return {
      description: `${name} is ${values.map((v) => showValue(column, v)).join(" of ")}`,
      filters: buildValueFilter(column, values),
    };
  }

  if (!value) return null;

  if (filter.operator === "contains") {
    const text = clean(value);
    if (column.kind !== "text" || !text) return null;
    return { description: `${name} bevat "${text}"`, filters: [{ key: column.key, op: "ilike", value: `*${text}*` }] };
  }

  if (filter.operator === "equals") {
    if (column.kind === "boolean") {
      const v = value.toLowerCase();
      if (v !== "true" && v !== "false") return null;
      return { description: `${name} is ${v === "true" ? "Ja" : "Nee"}`, filters: [{ key: column.key, op: "eq", value: v === "true" }] };
    }
    if (column.kind === "number") {
      const n = Number(value);
      if (!Number.isFinite(n)) return null;
      return { description: `${name} is ${showValue(column, value)}`, filters: [{ key: column.key, op: "eq", value: n }] };
    }
    if (column.kind === "date") {
      if (!validDate(value)) return null;
      if (ISO_DAY.test(value)) {
        return {
          description: `${name} is ${showValue(column, value)}`,
          filters: [
            { key: column.key, op: "gte", value },
            { key: column.key, op: "lt", value: nextDay(value) },
          ],
        };
      }
      return { description: `${name} is ${showValue(column, value)}`, filters: [{ key: column.key, op: "eq", value }] };
    }
    const text = clean(value);
    if (!text) return null;
    // Same text, any capitals.
    return { description: `${name} is "${text}"`, filters: [{ key: column.key, op: "ilike", value: text }] };
  }

  const op = filter.operator;
  if (column.kind === "number") {
    const n = Number(value);
    if (!Number.isFinite(n)) return null;
    return { description: `${name} ${words(column, op)} ${showValue(column, value)}`, filters: [{ key: column.key, op: COMPARE[op], value: n }] };
  }
  if (column.kind === "date") {
    if (!validDate(value)) return null;
    // "Before the day after" reads better as "to and including" that day.
    if (op === "lt" && ISO_DAY.test(value)) {
      const [y, m, d] = value.split("-").map(Number);
      const last = new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
      return { description: `${name} tot en met ${showValue(column, last)}`, filters: [{ key: column.key, op: "lt", value }] };
    }
    return { description: `${name} ${words(column, op)} ${showValue(column, value)}`, filters: [{ key: column.key, op: COMPARE[op], value }] };
  }
  return null;
}

/** Usable rules from the AI's plan, plus how many suggestions had to be left out. */
export function planToRules(columns: DataColumn[], plan: AiFilterPlan): { rules: AiRule[]; skipped: number } {
  const rules: AiRule[] = [];
  let skipped = 0;
  plan.filters.forEach((filter, index) => {
    const column = columns.find((c) => c.key === filter.column);
    const rule = column ? toRule(column, filter) : null;
    if (rule) rules.push({ id: `ai-${index}`, ...rule });
    else skipped += 1;
  });
  return { rules, skipped };
}

/** A few example values per column for the AI, so it can match names and codes as they are written. */
export function sampleValues(columns: DataColumn[], rows: Record<string, unknown>[], extra: Record<string, string[]> = {}, limit = 15) {
  const samples: Record<string, string[]> = {};
  for (const column of columns) {
    if (column.kind !== "text" && column.kind !== "number") continue;
    const seen = new Set<string>(extra[column.key]?.slice(0, limit) ?? []);
    for (const row of rows) {
      if (seen.size >= limit) break;
      const v = row[column.key];
      if (v === null || v === undefined || v === "" || typeof v === "object") continue;
      seen.add(String(v).slice(0, 80));
    }
    if (seen.size) samples[column.key] = [...seen];
  }
  return samples;
}
