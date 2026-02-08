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
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const STORAGE_KEY = "supabase_sync_config";

const ALL_TABLES = [
  "gas_type_categories",
  "gas_types",
  "cylinder_sizes",
  "dry_ice_packaging",
  "dry_ice_product_types",
  "task_types",
  "time_off_types",
  "app_settings",
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
  const [externalKey, setExternalKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [selectedTables, setSelectedTables] = useState<string[]>(ALL_TABLES);
  const [syncing, setSyncing] = useState(false);
  const [confirmDirection, setConfirmDirection] = useState<"push" | "pull" | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);
  const [resultOpen, setResultOpen] = useState(false);

  const saveConfig = (url: string) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ url }));
  };

  const handleUrlChange = (val: string) => {
    setExternalUrl(val);
    saveConfig(val);
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

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

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
          }),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Sync mislukt");
      }

      const data: SyncResult = await response.json();
      setResult(data);
      setResultOpen(true);

      if (data.summary.totalErrors === 0) {
        toast.success(
          `Sync voltooid: ${data.summary.totalInserted} rijen ${direction === "push" ? "verzonden" : "ontvangen"}`
        );
      } else {
        toast.warning(
          `Sync voltooid met ${data.summary.totalErrors} fouten`
        );
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Sync mislukt");
    } finally {
      setSyncing(false);
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
            </div>
            <Alert>
              <ShieldAlert className="h-4 w-4" />
              <AlertTitle>Let op</AlertTitle>
              <AlertDescription>
                Gebruik de <strong>Service Role Key</strong> van je externe project. Deze wordt niet opgeslagen en
                alleen tijdens de sync verzonden via een beveiligde verbinding.
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
            </div>

            {syncing && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Synchronisatie bezig...
                </div>
                <Progress value={undefined} className="h-2" />
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
                    <div key={table} className="flex items-center justify-between border rounded p-2 text-sm">
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
