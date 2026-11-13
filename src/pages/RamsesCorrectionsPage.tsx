import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import type { AppRole } from "@/hooks/useUserPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { buildSearchFilter, deriveColumns, findTimestampColumn, formatCellValue, groupRowsByTimestamp, rowsToCsv, type DataColumn, type DataRow, type TimestampGroup } from "@/lib/dataTable";

const TABLE_NAME = "RamsesCorrecties";
const PAGE_SIZES = [25, 50, 100];
const EXPORT_BATCH = 1000;

export default function RamsesCorrectionsPage() {
  return (
    <ProtectedRoute>
      {({ user, role, isAdmin }) =>
        isAdmin ? <RamsesCorrectionsContent userEmail={user.email} role={role} /> : <Navigate to="/" replace />
      }
    </ProtectedRoute>
  );
}

function RamsesCorrectionsContent({ userEmail, role }: { userEmail?: string; role: AppRole }) {
  const { toast } = useToast();
  const [columns, setColumns] = useState<DataColumn[] | null>(null);
  const [rows, setRows] = useState<DataRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<{ key: string; ascending: boolean } | null>(null);
  const [exporting, setExporting] = useState(false);
  // Labels of the time groups the user has closed; open by default.
  const [collapsedGroups, setCollapsedGroups] = useState<string[]>([]);

  // Short pause while typing so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const buildQuery = useCallback(
    (withCount: boolean) => {
      let query = (supabase as any).from(TABLE_NAME).select("*", withCount ? { count: "exact" } : undefined);
      const filter = columns ? buildSearchFilter(columns, search) : null;
      if (filter) query = query.or(filter);
      if (sort) query = query.order(sort.key, { ascending: sort.ascending, nullsFirst: false });
      return query;
    },
    [columns, search, sort],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const from = page * pageSize;
    const { data, error: queryError, count } = await buildQuery(true).range(from, from + pageSize - 1);
    if (queryError) {
      setError(queryError.message);
      setRows([]);
      setTotal(0);
    } else {
      const result = (data ?? []) as DataRow[];
      setRows(result);
      setTotal(count ?? result.length);
      if (!columns && result.length > 0) setColumns(deriveColumns(result));
    }
    setLoading(false);
  }, [buildQuery, page, pageSize, columns]);

  useEffect(() => {
    load();
  }, [load]);

  const visibleColumns = useMemo(() => columns ?? deriveColumns(rows), [columns, rows]);
  const timestampKey = useMemo(() => findTimestampColumn(visibleColumns), [visibleColumns]);
  const groups = useMemo(() => {
    if (!timestampKey) return null;
    const kind = visibleColumns.find((c) => c.key === timestampKey)?.kind ?? "text";
    // Group on what the user sees (to the minute), not on hidden seconds.
    return groupRowsByTimestamp(rows, timestampKey, (value) => formatCellValue(value, kind));
  }, [rows, timestampKey, visibleColumns]);
  const collapsed = useMemo(() => new Set(collapsedGroups), [collapsedGroups]);
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const firstRow = total === 0 ? 0 : page * pageSize + 1;
  const lastRow = Math.min(total, (page + 1) * pageSize);

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((current) => {
      if (current?.key !== key) return { key, ascending: true };
      if (current.ascending) return { key, ascending: false };
      return null;
    });
  };

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all: DataRow[] = [];
      for (let from = 0; ; from += EXPORT_BATCH) {
        const { data, error: queryError } = await buildQuery(false).range(from, from + EXPORT_BATCH - 1);
        if (queryError) throw queryError;
        all.push(...((data ?? []) as DataRow[]));
        if (!data || data.length < EXPORT_BATCH) break;
      }
      const csv = rowsToCsv(columns ?? deriveColumns(all), all);
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ramses-correcties-${new Date().toLocaleDateString("nl-NL").replace(/\//g, "-")}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      toast({ title: "Export klaar", description: `${all.length.toLocaleString("nl-NL")} regels gedownload.` });
    } catch (e: any) {
      toast({ title: "Export mislukt", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <PageLayout
      userEmail={userEmail}
      role={role}
      isAdmin
      title="Ramses-correcties"
      description="Overzicht van alle correcties uit Ramses."
      titleIcon={<FileSpreadsheet className="h-6 w-6 text-primary" />}
    >
      <Card className="glass-card">
        <CardHeader className="gap-4 md:flex-row md:items-end md:justify-between md:space-y-0">
          <div>
            <CardTitle>Correcties</CardTitle>
            <CardDescription>
              {loading ? "Laden…" : `${total.toLocaleString("nl-NL")} ${total === 1 ? "regel" : "regels"}${search ? " gevonden" : ""}`}
            </CardDescription>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative sm:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Zoeken…"
                className="pl-9"
                aria-label="Zoeken in correcties"
                disabled={!columns}
              />
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              Vernieuwen
            </Button>
            <Button variant="outline" onClick={exportCsv} disabled={exporting || total === 0}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? "Exporteren…" : "Exporteer CSV"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">De correcties konden niet worden geladen.</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          ) : (
            <div className="max-h-[65vh] overflow-auto rounded-md border">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    {visibleColumns.map((col) => {
                      const active = sort?.key === col.key;
                      const Icon = !active ? ArrowUpDown : sort.ascending ? ArrowUp : ArrowDown;
                      return (
                        <TableHead key={col.key} className={`whitespace-nowrap ${col.kind === "number" ? "text-right" : ""}`}>
                          <button
                            type="button"
                            onClick={() => toggleSort(col.key)}
                            className={`inline-flex items-center gap-1 hover:text-foreground ${active ? "text-foreground" : ""}`}
                            aria-label={`Sorteer op ${col.label}`}
                          >
                            {col.label}
                            <Icon className="h-3.5 w-3.5 opacity-60" />
                          </button>
                        </TableHead>
                      );
                    })}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && rows.length === 0 ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={Math.max(visibleColumns.length, 1)}>
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={Math.max(visibleColumns.length, 1)} className="h-24 text-center text-muted-foreground">
                        {search ? "Geen correcties gevonden voor deze zoekopdracht." : "Er zijn (nog) geen correcties zichtbaar."}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row, i) => (
                      <TableRow
                        key={String(row.id ?? i)}
                        className={`${groupParities?.[i] === 0 ? "bg-primary/15 hover:bg-primary/20" : ""} ${loading ? "opacity-60" : ""}`}
                      >
                        {visibleColumns.map((col, colIndex) => (
                          <TableCell
                            key={col.key}
                            className={`whitespace-nowrap ${col.kind === "number" ? "text-right tabular-nums" : ""} ${
                              colIndex === 0 && groupParities?.[i] != null
                                ? `border-l-4 ${groupParities[i] === 0 ? "border-l-primary" : "border-l-muted-foreground/30"}`
                                : ""
                            }`}
                          >
                            {formatCellValue(row[col.key], col.kind)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground sm:flex-row">
            <div className="flex items-center gap-2">
              <span>Regels per pagina</span>
              <Select
                value={String(pageSize)}
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(0);
                }}
              >
                <SelectTrigger className="h-8 w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-3">
              <span>
                {firstRow.toLocaleString("nl-NL")}–{lastRow.toLocaleString("nl-NL")} van {total.toLocaleString("nl-NL")}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => p - 1)} disabled={page === 0 || loading} aria-label="Vorige pagina">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setPage((p) => p + 1)} disabled={page + 1 >= pageCount || loading} aria-label="Volgende pagina">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </PageLayout>
  );
}
