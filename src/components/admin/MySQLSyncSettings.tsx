import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ArrowUpFromLine,
  RefreshCw,
  Database,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  TableProperties,
  Plug,
  Loader2,
  Download,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const MYSQL_STORAGE_KEY = "mysql_sync_config";

interface MySQLSyncSettingsProps {
  selectedTables: string[];
}

interface SyncResult {
  success: boolean;
  direction: string;
  summary: { totalRows: number; totalInserted: number; totalErrors: number };
  details: Record<string, { rows: number; inserted: number; errors: string[] }>;
}

export function MySQLSyncSettings({ selectedTables }: MySQLSyncSettingsProps) {
  const [mysqlHost, setMysqlHost] = useState(() => {
    try {
      const saved = localStorage.getItem(MYSQL_STORAGE_KEY);
      return saved ? JSON.parse(saved).host || "" : "";
    } catch { return ""; }
  });
  const [mysqlPort, setMysqlPort] = useState(() => {
    try {
      const saved = localStorage.getItem(MYSQL_STORAGE_KEY);
      return saved ? JSON.parse(saved).port || "3306" : "3306";
    } catch { return "3306"; }
  });
  const [mysqlUser, setMysqlUser] = useState(() => {
    try {
      const saved = localStorage.getItem(MYSQL_STORAGE_KEY);
      return saved ? JSON.parse(saved).user || "" : "";
    } catch { return ""; }
  });
  const [mysqlDatabase, setMysqlDatabase] = useState(() => {
    try {
      const saved = localStorage.getItem(MYSQL_STORAGE_KEY);
      return saved ? JSON.parse(saved).database || "" : "";
    } catch { return ""; }
  });
  const [mysqlPassword, setMysqlPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [syncing, setSyncing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; table: string; rowsProcessed?: number } | null>(null);
  const [creatingSchema, setCreatingSchema] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionResult, setConnectionResult] = useState<{
    success: boolean;
    version?: string;
    latency_ms?: number;
    existing_tables?: string[];
    error?: string;
  } | null>(null);

  const [confirmPush, setConfirmPush] = useState(false);
  const [confirmSchema, setConfirmSchema] = useState(false);

  const [result, setResult] = useState<SyncResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [schemaResult, setSchemaResult] = useState<any>(null);
  const [schemaResultOpen, setSchemaResultOpen] = useState(false);

  const mysqlCredentials = { mysqlHost, mysqlPort, mysqlUser, mysqlPassword, mysqlDatabase };
  const isConfigured = mysqlHost && mysqlUser && mysqlDatabase && mysqlPassword;

  const saveConfig = () => {
    localStorage.setItem(MYSQL_STORAGE_KEY, JSON.stringify({
      host: mysqlHost, port: mysqlPort, user: mysqlUser, database: mysqlDatabase,
    }));
  };

  const handleFieldChange = (setter: (v: string) => void) => (val: string) => {
    setter(val);
    // Save on next tick after state update
    setTimeout(saveConfig, 0);
  };

  const sanitizeHost = (value: string): string => {
    let host = value.trim();
    // Remove protocol (http://, https://, etc.)
    host = host.replace(/^[a-zA-Z]+:\/\//, "");
    // Remove path, query string, and fragment
    host = host.split("/")[0].split("?")[0].split("#")[0];
    // Remove port if present (port is in a separate field)
    host = host.replace(/:\d+$/, "");
    return host;
  };

  const handleHostBlur = () => {
    const cleaned = sanitizeHost(mysqlHost);
    if (cleaned !== mysqlHost) {
      setMysqlHost(cleaned);
      toast.info(`Host automatisch aangepast naar: ${cleaned}`);
      setTimeout(saveConfig, 0);
    }
  };
  const handleTestConnection = async () => {
    setTestingConnection(true);
    setConnectionResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/test-mysql-connection`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(mysqlCredentials),
        }
      );

      const data = await response.json();
      setConnectionResult(data);
      if (data.success) {
        toast.success(`Verbinding succesvol! MySQL ${data.version} (${data.latency_ms}ms)`);
      } else {
        toast.error(`Verbinding mislukt: ${data.error}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Verbinding mislukt";
      setConnectionResult({ success: false, error: msg });
      toast.error(msg);
    } finally {
      setTestingConnection(false);
    }
  };

  const handleCreateSchema = async () => {
    setConfirmSchema(false);
    setCreatingSchema(true);
    setSchemaResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-mysql-schema`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ ...mysqlCredentials, tables: selectedTables }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || `Schema aanmaken mislukt (${response.status})`);
      }

      const data = await response.json();
      setSchemaResult(data);
      setSchemaResultOpen(true);
      if (data.success) {
        toast.success(`MySQL schema aangemaakt (${data.summary.created} tabellen)`);
      } else {
        toast.warning(`Schema aangemaakt met ${data.summary.errors} fouten`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schema aanmaken mislukt");
    } finally {
      setCreatingSchema(false);
    }
  };

  const handlePushToMySQL = async () => {
    setConfirmPush(false);
    if (selectedTables.length === 0) {
      toast.error("Selecteer minimaal één tabel");
      return;
    }
    setSyncing(true);
    setResult(null);
    setSyncProgress({ current: 0, total: selectedTables.length, table: selectedTables[0] });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      let tableIndex = 0;
      let batchOffset = 0;
      let accumulatedResults: Record<string, any> = {};
      let currentTableRows = 0;
      let currentTableInserted = 0;
      let currentTableErrors: string[] = [];

      while (true) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-mysql`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              ...mysqlCredentials,
              tables: selectedTables,
              tableIndex, batchOffset, accumulatedResults,
              currentTableRows, currentTableInserted, currentTableErrors,
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `Sync mislukt (${response.status})`);
        }

        const data = await response.json();

        if (data.done) {
          setResult(data as SyncResult);
          setResultOpen(true);
          if (data.summary.totalErrors === 0) {
            toast.success(`MySQL sync voltooid: ${data.summary.totalInserted} rijen verzonden`);
          } else {
            toast.warning(`Sync voltooid met ${data.summary.totalErrors} fouten`);
          }
          break;
        }

        const progress = data.progress;
        if (progress) {
          setSyncProgress({
            current: progress.tableNum - 1,
            total: progress.totalTables,
            table: progress.table,
            rowsProcessed: progress.rowsProcessed,
          });
        }

        tableIndex = data.tableIndex;
        batchOffset = data.batchOffset;
        accumulatedResults = data.accumulatedResults;
        currentTableRows = data.currentTableRows ?? 0;
        currentTableInserted = data.currentTableInserted ?? 0;
        currentTableErrors = data.currentTableErrors ?? [];
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync mislukt");
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  };

  const handleExportDump = async () => {
    if (selectedTables.length === 0) {
      toast.error("Selecteer minimaal één tabel");
      return;
    }
    setExporting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      const sqlParts: string[] = [];
      let totalRows = 0;

      // Export table by table to avoid CPU timeout
      for (let i = 0; i < selectedTables.length; i++) {
        const table = selectedTables[i];
        toast.info(`Exporteren: ${table} (${i + 1}/${selectedTables.length})...`);

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-mysql-dump`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              table,
              includeHeader: i === 0,
              includeFooter: i === selectedTables.length - 1,
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || `Export mislukt voor ${table} (${response.status})`);
        }

        const data = await response.json();
        sqlParts.push(data.sql);
        totalRows += data.rows || 0;
      }

      // Combine and compress client-side
      const fullSql = sqlParts.join("\n");
      const blob = new Blob([fullSql], { type: "application/sql" });

      // Try gzip compression via CompressionStream
      let downloadBlob: Blob;
      let filename: string;
      try {
        const cs = new CompressionStream("gzip");
        const writer = cs.writable.getWriter();
        writer.write(new TextEncoder().encode(fullSql));
        writer.close();
        const reader = cs.readable.getReader();
        const chunks: BlobPart[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(new Blob([value]));
        }
        downloadBlob = new Blob(chunks, { type: "application/gzip" });
        filename = `mysql_dump_${new Date().toISOString().slice(0, 10)}.sql.gz`;
      } catch {
        // Fallback: plain SQL
        downloadBlob = blob;
        filename = `mysql_dump_${new Date().toISOString().slice(0, 10)}.sql`;
      }

      const url = URL.createObjectURL(downloadBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`MySQL dump gedownload! (${totalRows} rijen)`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export mislukt");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="space-y-6">
        {/* MySQL Connection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              MySQL Configuratie
            </CardTitle>
            <CardDescription>
              Configureer de verbinding met je externe MySQL database.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Host</Label>
                <Input
                  value={mysqlHost}
                  onChange={(e) => handleFieldChange(setMysqlHost)(e.target.value)}
                  onBlur={handleHostBlur}
                  placeholder="bijv. web0131.zxcs.nl"
                />
              </div>
              <div className="space-y-2">
                <Label>Poort</Label>
                <Input
                  value={mysqlPort}
                  onChange={(e) => handleFieldChange(setMysqlPort)(e.target.value)}
                  placeholder="3306"
                />
              </div>
              <div className="space-y-2">
                <Label>Gebruiker</Label>
                <Input
                  value={mysqlUser}
                  onChange={(e) => handleFieldChange(setMysqlUser)(e.target.value)}
                  placeholder="root"
                />
              </div>
              <div className="space-y-2">
                <Label>Database</Label>
                <Input
                  value={mysqlDatabase}
                  onChange={(e) => handleFieldChange(setMysqlDatabase)(e.target.value)}
                  placeholder="production_db"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Wachtwoord</Label>
                <div className="relative">
                  <Input
                    value={mysqlPassword}
                    onChange={(e) => setMysqlPassword(e.target.value)}
                    type={showPassword ? "text" : "password"}
                    className="pr-10"
                    placeholder="••••••••"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Let op</AlertTitle>
              <AlertDescription>
                Het wachtwoord wordt niet opgeslagen en alleen tijdens de sync verzonden.
                Zorg dat je MySQL server bereikbaar is vanaf het internet.
              </AlertDescription>
            </Alert>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={handleTestConnection}
                disabled={testingConnection || !isConfigured}
                className="gap-2"
              >
                {testingConnection ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plug className="h-4 w-4" />
                )}
                {testingConnection ? "Testen..." : "Test verbinding"}
              </Button>
              {connectionResult && (
                <div className="flex items-center gap-2 text-sm">
                  {connectionResult.success ? (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                      <span>MySQL {connectionResult.version} — {connectionResult.latency_ms}ms — {connectionResult.existing_tables?.length || 0} tabellen gevonden</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-destructive" />
                      <span className="text-destructive">{connectionResult.error}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* MySQL Actions */}
        <Card>
          <CardHeader>
            <CardTitle>MySQL Synchronisatie</CardTitle>
            <CardDescription>
              Push data naar je MySQL database. Data wordt samengevoegd (INSERT ... ON DUPLICATE KEY UPDATE) op basis van ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setConfirmPush(true)}
                disabled={syncing || creatingSchema || !isConfigured}
                className="gap-2"
              >
                <ArrowUpFromLine className="h-4 w-4" />
                Push naar MySQL
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmSchema(true)}
                disabled={syncing || creatingSchema || !isConfigured}
                className="gap-2"
              >
                <TableProperties className="h-4 w-4" />
                {creatingSchema ? "Schema aanmaken..." : "Schema aanmaken"}
              </Button>
              <Button
                variant="outline"
                onClick={handleExportDump}
                disabled={exporting || selectedTables.length === 0}
                className="gap-2"
              >
                {exporting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {exporting ? "Exporteren..." : "Download .sql.gz"}
              </Button>
            </div>

            {syncing && syncProgress && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="font-mono">{syncProgress.table}</span>
                  {" "}({syncProgress.current + 1}/{syncProgress.total})
                  {syncProgress.rowsProcessed ? ` — ${syncProgress.rowsProcessed} rijen` : ""}
                </div>
                <Progress value={(syncProgress.current / syncProgress.total) * 100} className="h-2" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Confirm Push Dialog */}
      <Dialog open={confirmPush} onOpenChange={setConfirmPush}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Data naar MySQL verzenden
            </DialogTitle>
            <DialogDescription>
              Dit synchroniseert {selectedTables.length} tabel(len) naar je MySQL database.
              Bestaande rijen met hetzelfde ID worden bijgewerkt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPush(false)}>Annuleren</Button>
            <Button onClick={handlePushToMySQL}>Ja, verzenden</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Schema Dialog */}
      <Dialog open={confirmSchema} onOpenChange={setConfirmSchema}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TableProperties className="h-5 w-5 text-primary" />
              MySQL schema aanmaken
            </DialogTitle>
            <DialogDescription>
              Dit maakt {selectedTables.length} tabel(len) aan in je MySQL database.
              Bestaande tabellen worden <strong>niet</strong> overschreven (IF NOT EXISTS).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSchema(false)}>Annuleren</Button>
            <Button onClick={handleCreateSchema}>Ja, schema aanmaken</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Results Dialog */}
      <Dialog open={resultOpen} onOpenChange={setResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {result?.summary.totalErrors === 0 ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              MySQL Sync Resultaat
            </DialogTitle>
          </DialogHeader>
          {result && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="border rounded-lg p-3">
                  <div className="text-2xl font-bold">{result.summary.totalRows}</div>
                  <div className="text-xs text-muted-foreground">Rijen gelezen</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600">{result.summary.totalInserted}</div>
                  <div className="text-xs text-muted-foreground">Gesynchroniseerd</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-2xl font-bold text-destructive">{result.summary.totalErrors}</div>
                  <div className="text-xs text-muted-foreground">Fouten</div>
                </div>
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {Object.entries(result.details).map(([table, detail]) => (
                    <div key={table} className="border rounded p-2 text-sm space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-mono">{table}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">{detail.rows} →</span>
                          {detail.errors.length > 0 ? (
                            <Badge variant="destructive" className="gap-1">
                              <XCircle className="h-3 w-3" />
                              {detail.errors.length} fout(en)
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              {detail.inserted}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {detail.errors.length > 0 && (
                        <div className="text-xs text-destructive bg-destructive/10 rounded p-2 mt-1 space-y-0.5">
                          {detail.errors.map((err: string, idx: number) => (
                            <div key={idx} className="break-all">{err}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Schema Results Dialog */}
      <Dialog open={schemaResultOpen} onOpenChange={setSchemaResultOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {schemaResult?.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-500" />
              )}
              MySQL Schema Resultaat
            </DialogTitle>
          </DialogHeader>
          {schemaResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="border rounded-lg p-3">
                  <div className="text-2xl font-bold text-green-600">{schemaResult.summary.created}</div>
                  <div className="text-xs text-muted-foreground">Aangemaakt</div>
                </div>
                <div className="border rounded-lg p-3">
                  <div className="text-2xl font-bold text-destructive">{schemaResult.summary.errors}</div>
                  <div className="text-xs text-muted-foreground">Fouten</div>
                </div>
              </div>
              <ScrollArea className="h-[200px]">
                <div className="space-y-2">
                  {schemaResult.results.map((item: any) => (
                    <div key={item.name} className="border rounded p-2 text-sm flex items-center justify-between">
                      <span className="font-mono">{item.name}</span>
                      {item.status === "error" ? (
                        <Badge variant="destructive" className="gap-1">
                          <XCircle className="h-3 w-3" />
                          {item.error?.substring(0, 60)}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          OK
                        </Badge>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
