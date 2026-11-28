/** Helpers for showing database rows whose columns are not known in advance. */

export type DataRow = Record<string, unknown>;

export type ColumnKind = "number" | "boolean" | "date" | "text";

export interface DataColumn {
  key: string;
  label: string;
  kind: ColumnKind;
  /** Set when every value is a list (e.g. `["UMCG","AZG"]`): "array" when the database sends real arrays
   * (jsonb/array column), "text" when it sends the list as JSON text. Kind stays "text". */
  list?: "array" | "text";
}

/** Items of a list value (real array or JSON text like `["a","b"]`); null when the value is not a list. */
export function parseListValue(value: unknown): string[] | null {
  if (Array.isArray(value)) return value.map((v) => (v === null || v === undefined ? "" : String(v)));
  if (typeof value === "string") {
    const t = value.trim();
    if (!t.startsWith("[") || !t.endsWith("]")) return null;
    try {
      const parsed = JSON.parse(t);
      return Array.isArray(parsed) ? parsed.map((v) => (v === null || v === undefined ? "" : String(v))) : null;
    } catch {
      return null;
    }
  }
  return null;
}

function detectList(values: unknown[]): "array" | "text" | undefined {
  const present = values.filter((v) => v !== null && v !== undefined && v !== "");
  if (present.length === 0) return undefined;
  if (present.every((v) => Array.isArray(v))) return "array";
  if (present.every((v) => typeof v === "string" && parseListValue(v) !== null)) return "text";
  return undefined;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;
/** Technical columns that are never shown: the database key and the moment a row was loaded.
 * Matched on the normalized key, so `created_at`, `createdAt` and `Created at` all count. */
const HIDDEN_COLUMNS = new Set(["id", "createdat"]);

/** Keys (lowercase, letters and digits only) that stay text even when every value is a number,
 * because they are codes or identifiers, not quantities (RamsesCorrecties uses `Nr dn num`
 * and `OTHER_NR_DN_NUM`). */
const TEXT_ONLY_COLUMNS = new Set(["nrdnnum", "othernrdnnum", "debiteurnummer", "debiteurnummer2"]);

const normalizeKey = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");

/** List columns whose items are shown with a code in front of the name. Both columns hold one item per
 * customer in the same order, so item i of the code column belongs to item i of the name column
 * (RamsesCorrecties: `Klant` with `Debiteurnummer`). */
const PAIRED_CODE_COLUMNS: { name: string; code: string }[] = [
  { name: "klant", code: "debiteurnummer" },
  { name: "klant2", code: "debiteurnummer2" },
];

/** Column with the codes belonging to a name column, or null when this column has no codes of its own. */
export function findCodeColumn(columns: DataColumn[], nameColumn: DataColumn): DataColumn | null {
  if (!nameColumn.list) return null;
  const pair = PAIRED_CODE_COLUMNS.find((p) => p.name === normalizeKey(nameColumn.key));
  if (!pair) return null;
  return columns.find((c) => normalizeKey(c.key) === pair.code) ?? null;
}

/** "206091 UMCG": the code in front of the name, the name alone when there is no code. */
export function labelWithCode(name: string, code?: string | null): string {
  const clean = cleanDisplayText(name);
  const number = code?.trim() ?? "";
  return number ? `${number} ${clean}`.trim() : clean;
}

/** Display text per list item, with the code from the same position in front of it. */
export function listItemsWithCodes(row: DataRow, nameColumn: DataColumn, codeColumn: DataColumn | null): string[] {
  const asList = (v: unknown): string[] =>
    parseListValue(v) ?? (v === null || v === undefined || v === "" ? [] : [String(v)]);
  const items = asList(row[nameColumn.key]);
  const codes = codeColumn ? asList(row[codeColumn.key]) : [];
  return items.map((item, i) => labelWithCode(item, codes[i]));
}

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

/** Columns in the order they first appear, technical columns such as `id` and `created_at` left out when other columns exist. */
export function deriveColumns(rows: DataRow[]): DataColumn[] {
  const keys: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) if (!keys.includes(key)) keys.push(key);
  }
  const visible = keys.filter((k) => !HIDDEN_COLUMNS.has(normalizeKey(k)));
  return (visible.length ? visible : keys).map((key) => {
    const values = rows.map((r) => r[key]);
    const list = detectList(values);
    const column: DataColumn = {
      key,
      label: humanizeColumnName(key),
      kind: list || TEXT_ONLY_COLUMNS.has(normalizeKey(key)) ? "text" : detectKind(values),
    };
    if (list) column.list = list;
    return column;
  });
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

/** A line that only names the UN number of a gas, e.g. `UN 1066 Stikstof, samengeperst, 2.2 (E)`. */
const UN_NUMBER_LINE = /^\s*UN\s?\d{3,4}\b/i;
/** The `(Leeg)` marker Ramses puts behind a cylinder type. */
const LEEG_MARKER = /\s*\(\s*leeg\s*\)/gi;

/**
 * Text as shown on screen: the `(Leeg)` marker and the line with the UN-number description are dropped,
 * because the user does not need them. Stored values and every filter keep using the full text, so
 * searching and ticking still match what is in the database.
 */
export function cleanDisplayText(value: string): string {
  const withoutUnLines = value
    .split(/\r?\n/)
    .filter((line) => !UN_NUMBER_LINE.test(line))
    .join(" ");
  return withoutUnLines.replace(LEEG_MARKER, "").replace(/\s+/g, " ").trim();
}

/** Dutch display value: dot for thousands, comma for decimals, dd-mm-jjjj dates. */
export function formatCellValue(value: unknown, kind: ColumnKind): string {
  if (value === null || value === undefined || value === "") return "—";
  const items = Array.isArray(value) || kind === "text" ? parseListValue(value) : null;
  if (items) return items.map((item) => cleanDisplayText(item)).filter(Boolean).join(", ") || "—";
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
  return cleanDisplayText(String(value)) || "—";
}

/**
 * Display value without the time of day: "2026-11-03T10:45:02" and "2026-11-03" both become "03-11-2026".
 * Used when rows are grouped per day, so a group header does not show a time the user does not need.
 */
export function formatDateOnlyValue(value: unknown, kind: ColumnKind): string {
  if (typeof value === "string" && ISO_DATE.test(value.trim())) {
    return formatCellValue(value.trim().split(/[T ]/)[0], "date");
  }
  return formatCellValue(value, kind);
}

/** PostgREST column reference: quoted when the name contains spaces or other special characters. */
export function quoteColumnName(key: string): string {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(key) ? key : `"${key.replace(/"/g, "")}"`;
}

/** PostgREST `or` filter that searches all text columns; null when there is nothing to search. */
export function buildSearchFilter(columns: DataColumn[], term: string): string | null {
  const cleaned = term.trim().replace(/[,()*"\\]/g, " ").replace(/\s+/g, " ").trim();
  // Real arrays cannot be searched with "contains"; lists stored as text can.
  const textColumns = columns.filter((c) => c.kind === "text" && c.list !== "array");
  if (!cleaned || textColumns.length === 0) return null;
  return textColumns.map((c) => `${quoteColumnName(c.key)}.ilike.*${cleaned}*`).join(",");
}

/** "or" carries a complete PostgREST or-expression in `value` (used for "one of these list items"). */
export type ColumnFilterOp = "eq" | "ilike" | "gt" | "gte" | "lt" | "lte" | "in" | "cs" | "or";

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
  // Commas stay: this filter is sent on its own, so a comma is part of the value, not a separator.
  const cleaned = term.trim().replace(/[()*"\\]/g, " ").replace(/\s+/g, " ").trim();
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
  if (column.list === "array") return [{ key: column.key, op: "cs", value: JSON.stringify([cleaned]) }];
  return [{ key: column.key, op: "ilike", value: `*${cleaned}*` }];
}

/** A value that occurs in a column, with how often it occurs, for a tick list. */
export interface DistinctValue {
  /** Raw value as text, used to ask the database for it. */
  value: string;
  /** Value as shown in the table. */
  label: string;
  count: number;
}

/** Columns whose values can be ticked in a list: text and numbers (dates and ja/nee have their own input). */
export function canPickValues(column: DataColumn | undefined): boolean {
  return column?.kind === "text" || column?.kind === "number";
}

/**
 * Every filled value in a column once, with how often it occurs; numbers in numeric order, text alphabetically.
 * `codeColumn` adds the code of the same position in front of every list item, so a customer list reads
 * "206091 UMCG" while the value that is asked for stays the plain name.
 */
export function collectDistinctValues(rows: DataRow[], column: DataColumn, codeColumn?: DataColumn | null): DistinctValue[] {
  const counts = new Map<string, { raw: unknown; count: number; label: string }>();
  for (const row of rows) {
    const raw = row[column.key];
    if (raw === null || raw === undefined || raw === "") continue;
    if (column.list) {
      const items = parseListValue(raw) ?? [];
      const codes = codeColumn ? parseListValue(row[codeColumn.key]) ?? [] : [];
      items.forEach((item, i) => {
        if (!item) return;
        const entry = counts.get(item);
        if (entry) entry.count += 1;
        else counts.set(item, { raw: item, count: 1, label: labelWithCode(item, codes[i]) });
      });
      continue;
    }
    const value = typeof raw === "object" ? JSON.stringify(raw) : String(raw);
    const entry = counts.get(value);
    if (entry) entry.count += 1;
    else counts.set(value, { raw, count: 1, label: formatCellValue(raw, column.kind) });
  }
  const list = [...counts.entries()].map(([value, { raw, count, label }]) => ({ value, label, count, raw }));
  list.sort((a, b) =>
    typeof a.raw === "number" && typeof b.raw === "number"
      ? a.raw - b.raw
      : a.label.localeCompare(b.label, "nl-NL", { numeric: true, sensitivity: "base" }),
  );
  return list.map(({ value, label, count }) => ({ value, label, count }));
}

/** PostgREST `in` condition for the ticked values; text values are quoted so commas and brackets stay literal. */
export function buildValueFilter(column: DataColumn | undefined, values: string[]): ColumnFilter[] {
  if (!column || values.length === 0) return [];
  if (column.list) {
    const col = quoteColumnName(column.key);
    const parts = values.map((v) =>
      column.list === "array"
        ? `${col}.cs.${JSON.stringify([v])}`
        : `${col}.ilike.*${JSON.stringify(v).replace(/[(),*]/g, "?")}*`,
    );
    return [{ key: column.key, op: "or", value: parts.join(",") }];
  }
  const quote = (v: string) =>
    column.kind === "number" ? v : `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return [{ key: column.key, op: "in", value: `(${values.map(quote).join(",")})` }];
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const items = parseListValue(value);
  if (items) value = items.filter(Boolean).join("; ");
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

export type PeriodPreset = "week" | "maand" | "vorige-maand" | "jaar";

export const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "week", label: "Deze week" },
  { id: "maand", label: "Deze maand" },
  { id: "vorige-maand", label: "Vorige maand" },
  { id: "jaar", label: "Dit jaar" },
];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Start (inclusive) and end (exclusive) day of a period preset; weeks start on Monday (ISO 8601). */
export function periodRange(preset: PeriodPreset, now: Date): { from: string; to: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  if (preset === "week") {
    const start = new Date(y, m, now.getDate() - ((now.getDay() + 6) % 7));
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    return { from: ymd(start), to: ymd(end) };
  }
  if (preset === "maand") return { from: ymd(new Date(y, m, 1)), to: ymd(new Date(y, m + 1, 1)) };
  if (preset === "vorige-maand") return { from: ymd(new Date(y, m - 1, 1)), to: ymd(new Date(y, m, 1)) };
  return { from: ymd(new Date(y, 0, 1)), to: ymd(new Date(y + 1, 0, 1)) };
}

/** Conditions that keep rows whose date column falls inside the preset period. */
export function buildPeriodFilter(key: string | null, preset: PeriodPreset | null, now: Date): ColumnFilter[] {
  if (!key || !preset) return [];
  const { from, to } = periodRange(preset, now);
  return [
    { key, op: "gte", value: from },
    { key, op: "lt", value: to },
  ];
}
