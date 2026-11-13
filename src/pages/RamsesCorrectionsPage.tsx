import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Navigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Download, FileSpreadsheet, Filter, Pencil, RefreshCw, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageLayout } from "@/components/layout/PageLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import type { AppRole } from "@/hooks/useUserPermissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import {
  applyColumnLabels,
  buildColumnLabelMap,
  columnLabelDrafts,
  columnLabelsKey,
  parseColumnLabels,
  type ColumnLabelMap,
} from "@/lib/columnLabels";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { buildColumnFilters, buildSearchFilter, deriveColumns, findTimestampColumn, formatCellValue, groupRowsByTimestamp, quoteColumnName, rowsToCsv, type DataColumn, type DataRow, type TimestampGroup } from "@/lib/dataTable";

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
  // Column names picked by an admin, loaded from and saved to the backend.
  const [columnLabels, setColumnLabels] = useState<ColumnLabelMap>({});
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [labelDrafts, setLabelDrafts] = useState<ColumnLabelMap>({});
  const [savingLabels, setSavingLabels] = useState(false);
  // Filter on one column: the picked column and the value typed for it.
  const [filterColumn, setFilterColumn] = useState("none");
  const [filterInput, setFilterInput] = useState("");
  const [filterTerm, setFilterTerm] = useState("");

  // Stored column names are optional: when they cannot be read, the automatic names stay in place.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stored = await api.appSettings.getByKey(columnLabelsKey(TABLE_NAME));
        if (!cancelled) setColumnLabels(parseColumnLabels(stored?.value));
      } catch {
        /* automatic names are fine */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Short pause while typing so we don't query on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Same short pause for the column filter, so typing does not query per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setFilterTerm(filterInput);
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [filterInput]);

  const activeFilterColumn = useMemo(() => (columns ?? []).find((col) => col.key === filterColumn), [columns, filterColumn]);
  const columnFilters = useMemo(() => buildColumnFilters(activeFilterColumn, filterTerm), [activeFilterColumn, filterTerm]);

  const buildQuery = useCallback(
    (withCount: boolean) => {
      let query = (supabase as any).from(TABLE_NAME).select("*", withCount ? { count: "exact" } : undefined);
      const filter = columns ? buildSearchFilter(columns, search) : null;
      if (filter) query = query.or(filter);
      for (const columnFilter of columnFilters) query = query.filter(quoteColumnName(columnFilter.key), columnFilter.op, columnFilter.value);
      if (sort) query = query.order(sort.key, { ascending: sort.ascending, nullsFirst: false });
      return query;
    },
    [columns, search, sort, columnFilters],
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

  const baseColumns = useMemo(() => columns ?? deriveColumns(rows), [columns, rows]);
  const visibleColumns = useMemo(() => applyColumnLabels(baseColumns, columnLabels), [baseColumns, columnLabels]);
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

  const anyFilter = search.trim() !== "" || filterTerm.trim() !== "";
  // What the value box expects depends on the kind of the picked column.
  const filterPlaceholder =
    activeFilterColumn?.kind === "number"
      ? "Bijv. 5 of >10"
      : activeFilterColumn?.kind === "date"
        ? "Bijv. 03-11-2026 of 11-2026"
        : activeFilterColumn?.kind === "boolean"
          ? "Ja of Nee"
          : "Waarde invoegen…";
  const filterInvalid =
    filterTerm.trim() !== "" && !!activeFilterColumn && activeFilterColumn.kind !== "text" && columnFilters.length === 0;
  const filterHint = activeFilterColumn ? `Gebruik voor "${activeFilterColumn.label}" ${filterPlaceholder}` : "";

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((current) => {
      if (current?.key !== key) return { key, ascending: true };
      if (current.ascending) return { key, ascending: false };
      return null;
    });
  };

  const toggleGroup = (label: string) =>
    setCollapsedGroups((current) => (current.includes(label) ? current.filter((l) => l !== label) : [...current, label]));

  const clearFilter = () => {
    setFilterColumn("none");
    setFilterInput("");
    setFilterTerm("");
    setPage(0);
  };

  const openLabels = () => {
    setLabelDrafts(columnLabelDrafts(visibleColumns));
    setLabelsOpen(true);
  };

  const saveLabels = async () => {
    setSavingLabels(true);
    try {
      const map = buildColumnLabelMap(baseColumns, labelDrafts);
      await api.appSettings.upsert(columnLabelsKey(TABLE_NAME), JSON.stringify(map), `Kolomnamen voor ${TABLE_NAME}`);
      setColumnLabels(map);
      setLabelsOpen(false);
      toast({
        title: "Kolomnamen opgeslagen",
        description: `${Object.keys(map).length} ${Object.keys(map).length === 1 ? "kolom" : "kolommen"} aangepast.`,
      });
    } catch (e: any) {
      toast({ title: "Opslaan mislukt", description: e.message, variant: "destructive" });
    } finally {
      setSavingLabels(false);
    }
  };

  const resetLabels = async () => {
    setSavingLabels(true);
    try {
      await api.appSettings.upsert(columnLabelsKey(TABLE_NAME), "{}", `Kolomnamen voor ${TABLE_NAME}`);
      setColumnLabels({});
      setLabelDrafts(columnLabelDrafts(baseColumns));
      toast({ title: "Kolomnamen hersteld", description: "De automatische namen zijn weer in gebruik." });
    } catch (e: any) {
      toast({ title: "Herstellen mislukt", description: e.message, variant: "destructive" });
    } finally {
      setSavingLabels(false);
    }
  };

  const stripeClass = (parity: 0 | 1 | null) =>
    parity === null ? "" : `border-l-4 ${parity === 0 ? "border-l-primary" : "border-l-accent"}`;

  // Each time group gets its own tint so neighbours are easy to tell apart.
  const rowTint = (parity: 0 | 1 | null) =>
    parity === 0 ? "bg-primary/20 hover:bg-primary/30" : parity === 1 ? "bg-accent/20 hover:bg-accent/30" : "";

  const headerTint = (parity: 0 | 1 | null) =>
    parity === 0 ? "bg-primary/10 hover:bg-primary/10" : parity === 1 ? "bg-accent/10 hover:bg-accent/10" : "bg-muted/50 hover:bg-muted/50";

  const swatchClass = (parity: 0 | 1 | null) =>
    parity === 0 ? "bg-primary" : parity === 1 ? "bg-accent" : "bg-muted-foreground/40";

  const renderRow = (row: DataRow, index: number, parity: 0 | 1 | null) => (
    <TableRow key={String(row.id ?? index)} className={`${rowTint(parity)} ${loading ? "opacity-60" : ""}`}>
      {visibleColumns.map((col, colIndex) => (
        <TableCell
          key={col.key}
          className={`whitespace-nowrap ${col.kind === "number" ? "text-right tabular-nums" : ""} ${
            colIndex === 0 ? stripeClass(parity) : ""
          }`}
        >
          {formatCellValue(row[col.key], col.kind)}
        </TableCell>
      ))}
    </TableRow>
  );

  const renderGroupHeader = (group: TimestampGroup) => {
    const open = !collapsed.has(group.label);
    const count = group.indexes.length;
    return (
      <TableRow key={`groep-${group.label}-${group.indexes[0]}`} className={headerTint(group.parity)}>
        <TableCell colSpan={Math.max(visibleColumns.length, 1)} className={`p-0 ${stripeClass(group.parity)}`}>
          <button
            type="button"
            onClick={() => toggleGroup(group.label)}
            aria-expanded={open}
            aria-label={`${open ? "Klap" : "Open"} tijdgroep ${group.empty ? "zonder tijdstip" : group.label}`}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            <ChevronRight className={`h-3.5 w-3.5 shrink-0 transition-transform ${open ? "rotate-90" : ""}`} />
            <span className={`h-2.5 w-2.5 shrink-0 rounded-[2px] ${swatchClass(group.parity)}`} aria-hidden="true" />
            <span className="whitespace-nowrap">{group.empty ? "Zonder tijdstip" : group.label}</span>
            <span className="whitespace-nowrap text-muted-foreground/70">
              {count.toLocaleString("nl-NL")} {count === 1 ? "regel" : "regels"}
            </span>
          </button>
        </TableCell>
      </TableRow>
    );
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
      const csv = rowsToCsv(applyColumnLabels(columns ?? deriveColumns(all), columnLabels), all);
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
              {loading ? "Laden…" : `${total.toLocaleString("nl-NL")} ${total === 1 ? "regel" : "regels"}${anyFilter ? " gevonden" : ""}`}
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
            <Button variant="outline" onClick={openLabels} disabled={!columns}>
              <Pencil className="mr-2 h-4 w-4" />
              Kolomnamen
            </Button>
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Filter className="h-3.5 w-3.5" />
              Filteren op kolom
            </span>
            <SearchableSelect
              options={[
                { value: "none", label: "Alle kolommen" },
                ...visibleColumns.map((col) => ({ value: col.key, label: col.label })),
              ]}
              value={filterColumn}
              onValueChange={(value) => {
                setFilterColumn(value);
                setPage(0);
              }}
              placeholder="Kies een kolom"
              searchPlaceholder="Zoek een kolom…"
              className="w-full sm:w-60"
              disabled={!columns}
              ariaLabel={`Kolom kiezen om op te filteren, nu: ${
                visibleColumns.find((col) => col.key === filterColumn)?.label ?? "Alle kolommen"
              }`}
            />
            <Input
              value={filterInput}
              onChange={(e) => setFilterInput(e.target.value)}
              placeholder={filterPlaceholder}
              className="w-full sm:w-56"
              aria-label="Filterwaarde"
              disabled={!columns || filterColumn === "none"}
            />
            {(filterColumn !== "none" || filterInput !== "") && (
              <Button variant="ghost" size="sm" onClick={clearFilter}>
                Filter wissen
              </Button>
            )}
            {filterInvalid && <p className="w-full text-xs text-muted-foreground">{filterHint}</p>}
          </div>
          {error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm">
              <p className="font-medium text-destructive">De correcties konden niet worden geladen.</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          ) : (
            <>
              {groups && groups.length > 1 && (
                <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                  <span>
                    {groups.length.toLocaleString("nl-NL")} tijdgroepen op deze pagina
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setCollapsedGroups([])}
                      disabled={collapsedGroups.length === 0}
                    >
                      Alles openen
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs"
                      onClick={() => setCollapsedGroups(groups.map((g) => g.label))}
                      disabled={groups.every((g) => collapsed.has(g.label))}
                    >
                      Alles sluiten
                    </Button>
                  </div>
                </div>
              )}
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
                        {anyFilter ? "Geen correcties gevonden voor deze filter." : "Er zijn (nog) geen correcties zichtbaar."}
                      </TableCell>
                    </TableRow>
                  ) : groups ? (
                    groups.map((group) => (
                      <Fragment key={`groep-${group.label}-${group.indexes[0]}`}>
                        {renderGroupHeader(group)}
                        {!collapsed.has(group.label) && group.indexes.map((i) => renderRow(rows[i], i, group.parity))}
                      </Fragment>
                    ))
                  ) : (
                    rows.map((row, i) => renderRow(row, i, null))
                  )}
                </TableBody>
              </Table>
              </div>
            </>
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

      <Dialog open={labelsOpen} onOpenChange={setLabelsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Kolomnamen</DialogTitle>
            <DialogDescription>
              Geef elke kolom een eigen naam. De namen worden in de database opgeslagen en gelden voor iedereen.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {baseColumns.map((col) => (
              <div key={col.key} className="space-y-1">
                <label htmlFor={`kolomnaam-${col.key}`} className="text-xs text-muted-foreground">
                  Achter de schermen: {col.key}
                </label>
                <Input
                  id={`kolomnaam-${col.key}`}
                  value={labelDrafts[col.key] ?? ""}
                  onChange={(e) => setLabelDrafts((current) => ({ ...current, [col.key]: e.target.value }))}
                  placeholder={col.label}
                />
              </div>
            ))}
          </div>
          <DialogFooter className="flex-wrap gap-2 sm:justify-between">
            <Button
              variant="ghost"
              onClick={resetLabels}
              disabled={savingLabels || Object.keys(columnLabels).length === 0}
            >
              Automatische namen herstellen
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setLabelsOpen(false)} disabled={savingLabels}>
                Sluiten
              </Button>
              <Button onClick={saveLabels} disabled={savingLabels}>
                {savingLabels ? "Opslaan…" : "Opslaan"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}
