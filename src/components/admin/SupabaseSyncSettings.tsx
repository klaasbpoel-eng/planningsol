import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
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
  ArrowDownToLine,
  RefreshCw,
  Database,
  Key,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Eye,
  EyeOff,
  TableProperties,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const STORAGE_KEY = "supabase_sync_config";

const ALL_TABLES = [
  "app_settings",
  "gas_type_categories",
  "cylinder_sizes",
  "dry_ice_packaging",
  "dry_ice_product_types",
  "task_types",
  "time_off_types",
  "gas_types",
  "customers",
  "gas_cylinder_orders",
  "dry_ice_orders",
];

interface SyncResult {
  success: boolean;
  direction: string;
  summary: { totalRows: number; totalInserted: number; totalErrors: number };
  details: Record<string, { rows: number; inserted: number; errors: string[] }>;
}

export function SupabaseSyncSettings() {
  const [externalUrl, setExternalUrl] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).url || "" : "";
    } catch { return ""; }
  });
  const [externalDbUrl, setExternalDbUrl] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).dbUrl || "" : "";
    } catch { return ""; }
  });
  const [externalKey, setExternalKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [showDbUrl, setShowDbUrl] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>(ALL_TABLES);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; table: string; rowsProcessed?: number } | null>(null);
  const [confirmDirection, setConfirmDirection] = useState<"push" | "pull" | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);
  const [creatingSchema, setCreatingSchema] = useState(false);
  const [confirmSchema, setConfirmSchema] = useState(false);
  const [schemaResult, setSchemaResult] = useState<any>(null);
  const [schemaResultOpen, setSchemaResultOpen] = useState(false);

  const saveConfig = (url: string, dbUrl?: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url, dbUrl: dbUrl ?? externalDbUrl }));
  };

  const handleUrlChange = (val: string) => {
    setExternalUrl(val);
    saveConfig(val);
  };

  const handleDbUrlChange = (val: string) => {
    setExternalDbUrl(val);
    saveConfig(externalUrl, val);
  };

  const handleCreateSchema = async () => {
    setConfirmSchema(false);
    if (!externalDbUrl) {
      toast.error("Vul de externe Database URL in");
      return;
    }
    setCreatingSchema(true);
    setSchemaResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-schema`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            externalDbUrl,
            tables: selectedTables,
          }),
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
        toast.success(`Schema succesvol aangemaakt (${data.summary.created} objecten)`);
      } else {
        toast.warning(`Schema aangemaakt met ${data.summary.errors} fouten`);
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Schema aanmaken mislukt");
    } finally {
      setCreatingSchema(false);
    }
  };

  const handleToggleTable = (table: string) => {
    setSelectedTables(prev =>
      prev.includes(table) ? prev.filter(t => t !== table) : [...prev, table]
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedTables(checked ? ALL_TABLES : []);
  };

  const handleSync = async (direction: "push" | "pull") => {
    setConfirmDirection(null);
    if (!externalUrl || !externalKey) {
      toast.error("Vul de externe Supabase URL en Service Role Key in");
      return;
    }
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

      // State for chaining
      let tableIndex = 0;
      let batchOffset = 0;
      let accumulatedResults: Record<string, any> = {};
      let currentTableRows = 0;
      let currentTableInserted = 0;
      let currentTableErrors: string[] = [];

      while (true) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sync-database`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              direction,
              externalUrl,
              externalServiceKey: externalKey,
              tables: selectedTables,
              tableIndex,
              batchOffset,
              accumulatedResults,
              currentTableRows,
              currentTableInserted,
              currentTableErrors,
            }),
          }
        );

        if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || err.message || `Sync mislukt (${response.status})`);
        }

        const data = await response.json();

        if (data.done) {
          setResult(data as SyncResult);
          setResultOpen(true);
          if (data.summary.totalErrors === 0) {
            toast.success(`Sync voltooid: ${data.summary.totalInserted} rijen ${direction === "push" ? "verzonden" : "ontvangen"}`);
          } else {
            toast.warning(`Sync voltooid met ${data.summary.totalErrors} fouten`);
          }
          break;
        }

        // Update progress
        const progress = data.progress;
        if (progress) {
          setSyncProgress({
            current: progress.tableNum - 1,
            total: progress.totalTables,
            table: progress.table,
            rowsProcessed: progress.rowsProcessed,
          });
        }

        // Carry forward state for next call
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

  return (
    <>
      <div className="space-y-6">
        {/* Connection Config */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-primary" />
              Externe Supabase Configuratie
            </CardTitle>
            <CardDescription>
              Configureer de verbinding met je eigen Supabase project voor bidirectionele synchronisatie.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Externe Supabase URL</Label>
                <Input
                  value={externalUrl}
                  onChange={(e) => handleUrlChange(e.target.value)}
                  placeholder="https://xxxxx.supabase.co"
                />
              </div>
              <div className="space-y-2">
                <Label>Service Role Key</Label>
                <div className="relative">
                  <Key className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={externalKey}
                    onChange={(e) => setExternalKey(e.target.value)}
                    className="pl-9 pr-10"
                    type={showKey ? "text" : "password"}
                    placeholder="eyJhbGciOi..."
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10"
                    onClick={() => setShowKey(!showKey)}
                  >
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Externe Database URL</Label>
                <div className="relative">
                  <Database className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={externalDbUrl}
                    onChange={(e) => handleDbUrlChange(e.target.value)}
                    className="pl-9 pr-10"
                    type={showDbUrl ? "text" : "password"}
                    placeholder="postgresql://postgres:[password]@db.xxxxx.supabase.co:5432/postgres"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-10 w-10"
                    onClick={() => setShowDbUrl(!showDbUrl)}
                  >
                    {showDbUrl ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Let op</AlertTitle>
              <AlertDescription>
                Gebruik de <strong>Service Role Key</strong> voor data sync en de <strong>Database URL</strong> voor
                schema aanmaken. De Database URL is te vinden onder Project Settings → Database in je externe project.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Table Selection */}
        <Card>
          <CardHeader>
            <CardTitle>Tabellen</CardTitle>
            <CardDescription>Selecteer welke tabellen gesynchroniseerd moeten worden.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2 mb-4">
              <Checkbox
                id="sync-select-all"
                checked={selectedTables.length === ALL_TABLES.length}
                onCheckedChange={handleSelectAll}
              />
              <Label htmlFor="sync-select-all" className="font-bold">Alles selecteren</Label>
              <Badge variant="secondary" className="ml-2">{selectedTables.length}/{ALL_TABLES.length}</Badge>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {ALL_TABLES.map((table) => (
                <div key={table} className="flex items-center space-x-2">
                  <Checkbox
                    id={`sync-${table}`}
                    checked={selectedTables.includes(table)}
                    onCheckedChange={() => handleToggleTable(table)}
                  />
                  <Label htmlFor={`sync-${table}`} className="text-sm font-mono cursor-pointer">
                    {table}
                  </Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sync Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Synchronisatie</CardTitle>
            <CardDescription>
              Kies de richting van de synchronisatie. Data wordt samengevoegd (upsert) op basis van ID.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => setConfirmDirection("push")}
                disabled={syncing || !externalUrl || !externalKey}
                className="gap-2"
              >
                <ArrowUpFromLine className="h-4 w-4" />
                Push naar extern
              </Button>
              <Button
                variant="outline"
                onClick={() => setConfirmDirection("pull")}
                disabled={syncing || !externalUrl || !externalKey}
                className="gap-2"
              >
                <ArrowDownToLine className="h-4 w-4" />
                Pull van extern
              </Button>
              <Button
                variant="secondary"
                onClick={() => setConfirmSchema(true)}
                disabled={syncing || creatingSchema || !externalDbUrl}
                className="gap-2"
              >
                <TableProperties className="h-4 w-4" />
                {creatingSchema ? "Schema aanmaken..." : "Schema aanmaken"}
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

      {/* Confirm Dialog */}
      <Dialog open={!!confirmDirection} onOpenChange={() => setConfirmDirection(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              {confirmDirection === "push" ? "Data verzenden" : "Data ophalen"}
            </DialogTitle>
            <DialogDescription>
              {confirmDirection === "push" ? (
                <>
                  Dit overschrijft bestaande data in je <strong>externe</strong> Supabase project
                  voor {selectedTables.length} tabel(len). Bestaande rijen met hetzelfde ID worden bijgewerkt.
                </>
              ) : (
                <>
                  Dit overschrijft bestaande data in <strong>deze</strong> database
                  voor {selectedTables.length} tabel(len). Bestaande rijen met hetzelfde ID worden bijgewerkt.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDirection(null)}>
              Annuleren
            </Button>
            <Button
              variant={confirmDirection === "pull" ? "destructive" : "default"}
              onClick={() => confirmDirection && handleSync(confirmDirection)}
            >
              {confirmDirection === "push" ? "Ja, verzenden" : "Ja, ophalen"}
            </Button>
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
              Sync Resultaat
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
                          {detail.errors.map((err, idx) => (
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

      {/* Confirm Schema Dialog */}
      <Dialog open={confirmSchema} onOpenChange={setConfirmSchema}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TableProperties className="h-5 w-5 text-primary" />
              Schema aanmaken op extern project
            </DialogTitle>
            <DialogDescription>
              Dit maakt alle benodigde enum types en {selectedTables.length} tabel(len) aan op je externe
              Supabase project. Bestaande tabellen worden <strong>niet</strong> overschreven (IF NOT EXISTS).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmSchema(false)}>
              Annuleren
            </Button>
            <Button onClick={handleCreateSchema}>
              Ja, schema aanmaken
            </Button>
          </DialogFooter>
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
              Schema Resultaat
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
