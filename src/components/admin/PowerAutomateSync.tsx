import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Cloud, Copy, RefreshCw, CheckCircle2, XCircle, Clock, Info } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { format } from "date-fns";
import { nl } from "date-fns/locale";

interface SyncLog {
  id: string;
  table_name: string;
  rows_received: number;
  rows_upserted: number;
  status: string;
  error_message: string | null;
  created_at: string;
}

interface SyncDataSummary {
  table_name: string;
  count: number;
  last_synced: string;
}

export function PowerAutomateSync() {
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [tables, setTables] = useState<SyncDataSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const webhookUrl = `https://${projectId}.supabase.co/functions/v1/receive-access-data`;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [logsRes, dataRes] = await Promise.all([
        supabase
          .from("access_sync_log")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("access_sync_data")
          .select("table_name, synced_at")
      ]);

      if (logsRes.data) setLogs(logsRes.data);

      // Group by table_name
      if (dataRes.data) {
        const grouped: Record<string, { count: number; last: string }> = {};
        for (const row of dataRes.data) {
          if (!grouped[row.table_name]) {
            grouped[row.table_name] = { count: 0, last: row.synced_at };
          }
          grouped[row.table_name].count++;
          if (row.synced_at > grouped[row.table_name].last) {
            grouped[row.table_name].last = row.synced_at;
          }
        }
        setTables(Object.entries(grouped).map(([name, info]) => ({
          table_name: name,
          count: info.count,
          last_synced: info.last,
        })));
      }
    } catch (err) {
      console.error("Fetch sync data failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Gekopieerd naar klembord");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          Power Automate – Access Synchronisatie
        </CardTitle>
        <CardDescription>
          Synchroniseer data vanuit een MS Access database op OneDrive via Microsoft Power Automate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Setup Instructions */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="space-y-2">
            <p className="font-medium">Instellen in Power Automate:</p>
            <ol className="list-decimal list-inside space-y-1 text-sm">
              <li>Maak een nieuwe <strong>Scheduled Cloud Flow</strong> (elk uur)</li>
              <li>Voeg actie toe: <strong>"List rows present in a table"</strong> (OneDrive → Access)</li>
              <li>Voeg actie toe: <strong>"HTTP"</strong> met methode POST naar onderstaande URL</li>
              <li>Stel de header in: <code className="bg-muted px-1 rounded">x-webhook-secret</code> met het gedeelde geheim</li>
              <li>Body: <code className="bg-muted px-1 rounded">{`{"table_name": "TabelNaam", "rows": @{body('List_rows')}, "id_field": "ID"}`}</code></li>
              <li>Herhaal stap 2-5 voor elke Access-tabel</li>
            </ol>
          </AlertDescription>
        </Alert>

        {/* Webhook URL */}
        <div className="space-y-2">
          <Label>Webhook URL</Label>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Synced Tables */}
        {tables.length > 0 && (
          <div className="space-y-2">
            <Label>Gesynchroniseerde tabellen</Label>
            <div className="flex flex-wrap gap-2">
              {tables.map((t) => (
                <Badge key={t.table_name} variant="secondary" className="gap-1">
                  {t.table_name}
                  <span className="text-muted-foreground">({t.count} rijen)</span>
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Sync Log */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Synchronisatie Log</Label>
            <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Vernieuwen
            </Button>
          </div>

          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nog geen synchronisaties ontvangen. Configureer Power Automate om te beginnen.
            </p>
          ) : (
            <div className="rounded-md border overflow-auto max-h-[300px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tijd</TableHead>
                    <TableHead>Tabel</TableHead>
                    <TableHead>Rijen</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="text-xs whitespace-nowrap">
                        {format(new Date(log.created_at), "dd MMM HH:mm", { locale: nl })}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{log.table_name}</TableCell>
                      <TableCell className="text-xs">
                        {log.rows_upserted}/{log.rows_received}
                      </TableCell>
                      <TableCell>
                        {log.status === "success" ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <span className="flex items-center gap-1">
                            <XCircle className="h-4 w-4 text-destructive" />
                            <span className="text-xs text-destructive truncate max-w-[150px]" title={log.error_message || ""}>
                              {log.error_message}
                            </span>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
