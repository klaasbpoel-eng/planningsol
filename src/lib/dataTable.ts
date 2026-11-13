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

export type ColumnFilterOp = "eq" | "ilike" | "gt" | "gte" | "lt" | "lte";

/** One condition on a single column. Several conditions are combined with AND by the caller. */
export interface ColumnFilter {
  key: string;
  op: ColumnFilterOp;
  value: unknown;
}

const COMPARISON = /^(>=|<=|>|<|=)\s*(.+)$/;
const OP_BY_SYMBOL: Record<string, ColumnFilterOp> = { "=": "eq", ">": "gt", ">=": "gte", "<": "lt", "<=": "lte" };

/** Dutch number text ("1.234,5", ">10") to an operator and a number; null when it isn't a number. */
function parseNumberTerm(term: string): { op: ColumnFilterOp; value: number } | null {
  const match = COMPARISON.exec(term);
  const body = (match?.[2] ?? term).trim();
  if (!body) return null;
  const normalized = body.includes(",") ? body.replace(/\./g, "").replace(",", ".") : body;
  if (!/^-?\d+(?:\.\d+)?$/.test(normalized)) return null;
  return { op: OP_BY_SYMBOL[match?.[1] ?? "="] ?? "eq", value: Number(normalized) };
}

const DAY_PATTERN = /^(?:(\d{4})-(\d{1,2})-(\d{1,2})|(\d{1,2})[.-](\d{1,2})[.-](\d{4}))$/;
const MONTH_PATTERN = /^(?:(\d{1,2})[.-](\d{4})|(\d{4})-(\d{1,2}))$/;
const DAY_MS = 86400000;

const pad2 = (n: number) => String(n).padStart(2, "0");
const isoDay = (utcMs: number) => {
  const date = new Date(utcMs);
  return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`;
};

/** Day, month or year text to a [start, end) ISO-day range; null when it isn't a date. */
function parseDateRange(term: string): [string, string] | null {
  const text = term.trim();
  const day = DAY_PATTERN.exec(text) ?? DAY_PATTERN.exec(text.split(/[T ]/)[0] ?? "");
  if (day) {
    const [y, m, d] = day[1]
      ? [Number(day[1]), Number(day[2]), Number(day[3])]
      : [Number(day[6]), Number(day[5]), Number(day[4])];
    if (m < 1 || m > 12 || d < 1 || d > 31) return null;
    const start = Date.UTC(y, m - 1, d);
    // Rejects impossible days such as 31-02.
    if (new Date(start).getUTCMonth() !== m - 1) return null;
    return [isoDay(start), isoDay(start + DAY_MS)];
  }
  const month = MONTH_PATTERN.exec(text);
  if (month) {
    const [y, m] = month[1] ? [Number(month[2]), Number(month[1])] : [Number(month[3]), Number(month[4])];
    if (m < 1 || m > 12) return null;
    return [isoDay(Date.UTC(y, m - 1, 1)), isoDay(Date.UTC(y, m, 1))];
  }
  if (/^\d{4}$/.test(text)) {
    const y = Number(text);
    return [isoDay(Date.UTC(y, 0, 1)), isoDay(Date.UTC(y + 1, 0, 1))];
  }
  return null;
}

const TRUE_WORDS = new Set(["ja", "yes", "y", "true", "waar", "1"]);
const FALSE_WORDS = new Set(["nee", "no", "n", "false", "onwaar", "0"]);

/**
 * Conditions that keep only the rows whose column matches the typed text. The value is read the way the
 * column is shown: text searches "contains", numbers accept >, >=, <, <= and =, dates accept a day,
 * month or year, booleans accept ja/nee. Nothing comes back when the text cannot be used for that column.
 */
export function buildColumnFilters(column: DataColumn | undefined, term: string): ColumnFilter[] {
  const cleaned = term.trim().replace(/[,()*"\\]/g, " ").replace(/\s+/g, " ").trim();
  if (!column || !cleaned) return [];
  if (column.kind === "number") {
    const parsed = parseNumberTerm(cleaned);
    return parsed ? [{ key: column.key, op: parsed.op, value: parsed.value }] : [];
  }
  if (column.kind === "boolean") {
    const word = cleaned.toLowerCase();
    if (TRUE_WORDS.has(word)) return [{ key: column.key, op: "eq", value: true }];
    if (FALSE_WORDS.has(word)) return [{ key: column.key, op: "eq", value: false }];
    return [];
  }
  if (column.kind === "date") {
    const range = parseDateRange(cleaned);
    return range
      ? [
          { key: column.key, op: "gte", value: range[0] },
          { key: column.key, op: "lt", value: range[1] },
        ]
      : [];
  }
  return [{ key: column.key, op: "ilike", value: `*${cleaned}*` }];
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
