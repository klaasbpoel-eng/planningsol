/** Helpers for showing database rows whose columns are not known in advance. */

export type DataRow = Record<string, unknown>;

export type ColumnKind = "number" | "boolean" | "date" | "text";

export interface DataColumn {
  key: string;
  label: string;
  kind: ColumnKind;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const HIDDEN_COLUMNS = new Set(["id"]);

/** Turns `ArtikelCode`, `artikel_code` or `artikelCode` into "Artikel code". */
export function humanizeColumnName(key: string): string {
  const words = key
    .replace(/[_-]+/g, " ")
    .replace(/([a-z\d])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function detectKind(values: unknown[]): ColumnKind {
  const present = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (present.length === 0) return "text";
  if (present.every((v) => typeof v === "number")) return "number";
  if (present.every((v) => typeof v === "boolean")) return "boolean";
  if (present.every((v) => typeof v === "string" && ISO_DATE.test(v))) return "date";
  return "text";
}

/** Columns in the order they first appear, technical `id` left out when other columns exist. */
export function deriveColumns(rows: DataRow[]): DataColumn[] {
  const keys: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key);
  }
  const visible = keys.filter((k) => !HIDDEN_COLUMNS.has(k));
  return (visible.length ? visible : keys).map((key) => ({
    key,
    label: humanizeColumnName(key),
    kind: detectKind(rows.map((r) => r[key])),
  }));
}

const TIMESTAMP_KEY = /timestamp|tijdstip|datetime/i;
/** Exact keys that always win over the loose timestamp match (RamsesCorrecties uses `dt_dn`). */
const PREFERRED_TIMESTAMP_KEYS = ["dt_dn", "dtdn"];

/** Column whose value groups rows that belong together: `dt_dn`, else a timestamp-like key, else the first date column. */
export function findTimestampColumn(columns: DataColumn[]): string | null {
  const preferred = columns.find((c) => PREFERRED_TIMESTAMP_KEYS.includes(c.key.toLowerCase()));
  if (preferred) return preferred.key;
  const named = columns.find((c) => TIMESTAMP_KEY.test(c.key));
  if (named) return named.key;
  return columns.find((c) => c.kind === "date")?.key ?? null;
}

export interface TimestampGroup {
  /** Displayed value shared by the rows in this run, e.g. "03-11-2026 10:45". Empty string when the value is missing. */
  label: string;
  /** True when the rows have no value in the timestamp column. */
  empty: boolean;
  /** Row indexes (in display order) belonging to this run. */
  indexes: number[];
  /** Color alternation (0/1) matching the row backgrounds; null for rows without a value. */
  parity: 0 | 1 | null;
}

/**
 * Splits rows into runs of equal displayed timestamp values, in display order, so each run can be shown
 * under its own collapsible header. `toGroupKey` lets callers group on the displayed value (e.g. to the
 * minute), so rows that look identical on screen share a group even if seconds differ.
 * Color alternation follows first appearance, so equal timestamps keep their color even when sorted apart.
 */
export function groupRowsByTimestamp(
  rows: DataRow[],
  key: string,
  toGroupKey: (value: unknown) => string = (value) => String(value),
): TimestampGroup[] {
  const groups: TimestampGroup[] = [];
  const parityByValue = new Map<string, 0 | 1>();
  rows.forEach((row, index) => {
    const value = row[key];
    const empty = value === null || value === undefined || value === "";
    const label = empty ? "" : toGroupKey(value);
    const current = groups[groups.length - 1];
    if (current && current.label === label) {
      current.indexes.push(index);
      return;
    }
    let parity: 0 | 1 | null = null;
    if (!empty) {
      let known = parityByValue.get(label);
      if (known === undefined) {
        known = (parityByValue.size % 2) as 0 | 1;
        parityByValue.set(label, known);
      }
      parity = known;
    }
    groups.push({ label, empty, indexes: [index], parity });
  });
  return groups;
}

/**
 * Parity (0/1) per row so rows sharing a timestamp get the same color and neighbouring groups alternate.
 * Rows without a value get null (no group color).
 */
export function timestampGroupParity(
  rows: DataRow[],
  key: string,
  toGroupKey: (value: unknown) => string = (value) => String(value),
): (0 | 1 | null)[] {
  const parity: (0 | 1 | null)[] = new Array(rows.length).fill(null);
  for (const group of groupRowsByTimestamp(rows, key, toGroupKey)) {
    for (const index of group.indexes) parity[index] = group.parity;
  }
  return parity;
}

const numberFormat = new Intl.NumberFormat("nl-NL", { maximumFractionDigits: 3 });

/** Dutch display value: dot for thousands, comma for decimals, dd-mm-jjjj dates. */
export function formatCellValue(value: unknown, kind: ColumnKind): string {
  if (value === null || value === undefined || value === "") return "—";
  if (kind === "number" && typeof value === "number") return numberFormat.format(value);
  if (kind === "boolean" || typeof value === "boolean") return value ? "Ja" : "Nee";
  if (kind === "date" && typeof value === "string") {
    const hasTime = /[T ]\d{2}:\d{2}/.test(value);
    const date = hasTime ? new Date(value) : new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString("nl-NL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      ...(hasTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    });
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** PostgREST column reference: quoted when the name contains spaces or other special characters. */
export function quoteColumnName(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : `"${key.replace(/"/g, "")}"`;
}

/** PostgREST `or` filter that searches all text columns; null when there is nothing to search. */
export function buildSearchFilter(columns: DataColumn[], term: string): string | null {
  const cleaned = term.trim().replace(/[,()*"\\]/g, " ").replace(/\s+/g, " ").trim();
  const textColumns = columns.filter((c) => c.kind === "text");
  if (!cleaned || textColumns.length === 0) return null;
  return textColumns.map((c) => `${quoteColumnName(c.key)}.ilike.*${cleaned}*`).join(",");
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Semicolon-separated CSV so Dutch Excel opens it in columns. */
export function rowsToCsv(columns: DataColumn[], rows: DataRow[]): string {
  const header = columns.map((c) => csvCell(c.label)).join(";");
  const body = rows.map((row) =>
    columns
      .map((c) => {
        const v = row[c.key];
        return csvCell(typeof v === "number" ? String(v).replace(".", ",") : v);
      })
      .join(";"),
  );
  return [header, ...body].join("\r\n");
}
