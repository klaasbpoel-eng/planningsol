import type { DataColumn } from "@/lib/dataTable";

/**
 * Column names a user picked, stored in the backend (app_settings) so they survive refreshes
 * and apply for everyone, while the underlying database column keeps its technical name.
 */
export type ColumnLabelMap = Record<string, string>;

/** Settings key under which the column names of one table are stored. */
export function columnLabelsKey(table: string): string {
  return `column_labels_${table}`;
}

/** Reads stored JSON back into a map. Unusable input (missing row, broken JSON, list) yields an empty map. */
export function parseColumnLabels(value: unknown): ColumnLabelMap {
  if (typeof value !== "string" || value.trim() === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return {};
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
  const out: ColumnLabelMap = {};
  for (const [key, label] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof label === "string" && label.trim() !== "") out[key] = label.trim();
  }
  return out;
}

/** Swaps the automatic column names for the stored ones. Columns without a stored name are untouched. */
export function applyColumnLabels(columns: DataColumn[], labels: ColumnLabelMap): DataColumn[] {
  return columns.map((column) => {
    const label = labels[column.key]?.trim();
    return label ? { ...column, label } : column;
  });
}

/** Starting point for the edit form: every column's currently shown name. */
export function columnLabelDrafts(columns: DataColumn[]): ColumnLabelMap {
  const drafts: ColumnLabelMap = {};
  for (const column of columns) drafts[column.key] = column.label;
  return drafts;
}

/**
 * What to store: only names that differ from the automatic one. A name typed back to the automatic
 * one, or left blank, is dropped so that column follows the automatic naming again.
 */
export function buildColumnLabelMap(baseColumns: DataColumn[], drafts: ColumnLabelMap): ColumnLabelMap {
  const out: ColumnLabelMap = {};
  for (const column of baseColumns) {
    const draft = (drafts[column.key] ?? "").trim();
    if (draft && draft !== column.label) out[column.key] = draft;
  }
  return out;
}
