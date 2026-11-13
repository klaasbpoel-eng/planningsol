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

/** PostgREST `or` filter that searches all text columns; null when there is nothing to search. */
export function buildSearchFilter(columns: DataColumn[], term: string): string | null {
  const cleaned = term.trim().replace(/[,()*"\\]/g, " ").replace(/\s+/g, " ").trim();
  const textColumns = columns.filter((c) => c.kind === "text");
  if (!cleaned || textColumns.length === 0) return null;
  return textColumns.map((c) => `"${c.key}".ilike.*${cleaned}*`).join(",");
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
