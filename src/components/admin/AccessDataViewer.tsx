import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Search, Trash2, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

const PAGE_SIZE = 50;

interface SyncRow {
  id: string;
  table_name: string;
  external_id: string | null;
  row_data: Record<string, unknown>;
  synced_at: string;
  updated_at: string;
}

interface SyncLogEntry {
  id: string;
  table_name: string;
  status: string;
  rows_received: number;
  rows_upserted: number;
  error_message: string | null;
  created_at: string;
  source_ip: string | null;
}

export function AccessDataViewer() {
  const [tableNames, setTableNames] = useState<string[]>([]);
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [rows, setRows] = useState<SyncRow[]>([]);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [logLoading, setLogLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Fetch distinct table names
  useEffect(() => {
    const fetchTables = async () => {
      const { data } = await supabase
        .from("access_sync_data")
        .select("table_name")
        .order("table_name");
      if (data) {
        const unique = [...new Set(data.map((r) => r.table_name))];
        setTableNames(unique);
        if (unique.length > 0 && !selectedTable) {
          setSelectedTable(unique[0]);
        }
      }
    };
    fetchTables();
  }, []);

  // Fetch rows for selected table
  useEffect(() => {
    if (!selectedTable) return;
    const fetchRows = async () => {
      setLoading(true);
      setPage(0);
      const { data, error } = await supabase
        .from("access_sync_data")
        .select("*")
        .eq("table_name", selectedTable)
        .order("updated_at", { ascending: false });
      if (error) {
        toast.error("Fout bij ophalen data: " + error.message);
      } else {
        setRows((data as SyncRow[]) || []);
      }
      setLoading(false);
    };
    fetchRows();
  }, [selectedTable]);

  // Fetch sync log
  useEffect(() => {
    const fetchLog = async () => {
      setLogLoading(true);
      const { data } = await supabase
        .from("access_sync_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      setSyncLog((data as SyncLogEntry[]) || []);
      setLogLoading(false);
    };
    fetchLog();
  }, []);

  // Extract dynamic columns from row_data
  const columns = useMemo(() => {
    const keys = new Set<string>();
    rows.forEach((r) => {
      if (r.row_data && typeof r.row_data === "object") {
        Object.keys(r.row_data).forEach((k) => keys.add(k));
      }
    });
    return Array.from(keys);
  }, [rows]);

  // Filter rows by search
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => {
      if (r.external_id?.toLowerCase().includes(q)) return true;
      return Object.values(r.row_data || {}).some((v) =>
        String(v ?? "").toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pagedRows = filteredRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const handleDelete = async () => {
    if (!selectedTable) return;
    const { error } = await supabase
      .from("access_sync_data")
      .delete()
      .eq("table_name", selectedTable);
    if (error) {
      toast.error("Verwijderen mislukt: " + error.message);
    } else {
      toast.success(`Alle data voor "${selectedTable}" verwijderd`);
      setRows([]);
      setTableNames((prev) => prev.filter((t) => t !== selectedTable));
      setSelectedTable(tableNames.filter((t) => t !== selectedTable)[0] || "");
    }
  };

  const formatDate = (d: string) => {
    try {
      return format(new Date(d), "dd MMM yyyy HH:mm", { locale: nl });
    } catch {
      return d;
    }
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div className="flex flex-col gap-2 mb-6">
        <h2 className="text-2xl font-bold tracking-tight">Access Data Synchronisatie</h2>
        <p className="text-muted-foreground">Bekijk en doorzoek gesynchroniseerde Access-tabellen.</p>
      </div>

      {/* Controls */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
            <Select value={selectedTable} onValueChange={setSelectedTable}>
              <SelectTrigger className="w-full sm:w-[240px]">
                <SelectValue placeholder="Selecteer tabel..." />
              </SelectTrigger>
              <SelectContent>
                {tableNames.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Zoeken in alle velden..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                className="pl-9"
              />
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSelectedTable((t) => t)}
                title="Vernieuwen"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon" disabled={!selectedTable} title="Verwijder tabeldata">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Tabeldata verwijderen?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Alle {rows.length} rijen van "{selectedTable}" worden permanent verwijderd. Dit kan niet ongedaan worden.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Annuleren</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete}>Verwijderen</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>

          {/* Stats */}
          <div className="flex gap-4 mt-3 text-sm text-muted-foreground">
            <span>{filteredRows.length} {filteredRows.length === 1 ? "rij" : "rijen"}</span>
            <span>{columns.length} kolommen</span>
          </div>
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : pagedRows.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {search ? "Geen resultaten gevonden." : "Geen data beschikbaar."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">ID</TableHead>
                    {columns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap">{col}</TableHead>
                    ))}
                    <TableHead className="whitespace-nowrap">Gesynchroniseerd</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {row.external_id || row.id.slice(0, 8)}
                      </TableCell>
                      {columns.map((col) => (
                        <TableCell key={col} className="max-w-[300px] truncate">
                          {String(row.row_data?.[col] ?? "")}
                        </TableCell>
                      ))}
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {formatDate(row.synced_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t">
              <span className="text-sm text-muted-foreground">
                Pagina {page + 1} van {totalPages}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="icon" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Sync Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Sync Logboek</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {logLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : syncLog.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">Nog geen sync logs.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tabel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ontvangen</TableHead>
                  <TableHead>Verwerkt</TableHead>
                  <TableHead>Tijdstip</TableHead>
                  <TableHead>Foutmelding</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {syncLog.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="font-medium">{log.table_name}</TableCell>
                    <TableCell>
                      <Badge variant={log.status === "success" ? "default" : "destructive"}>
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{log.rows_received}</TableCell>
                    <TableCell>{log.rows_upserted}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(log.created_at)}
                    </TableCell>
                    <TableCell className="text-xs text-destructive max-w-[200px] truncate">
                      {log.error_message || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
