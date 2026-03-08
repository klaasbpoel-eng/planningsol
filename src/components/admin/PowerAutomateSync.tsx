import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Cloud, Copy, RefreshCw, CheckCircle2, XCircle, Info, FileSpreadsheet, Zap } from "lucide-react";
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

export function ExternalDataSync() {
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

  const appsScriptCode = `// ===== CONFIGURATIE =====
var WEBHOOK_URL = "${webhookUrl}";
var WEBHOOK_SECRET = "PLAK_HIER_JE_SECRET";  // Vervang met je eigen secret

// ===== SYNCHRONISATIE FUNCTIE =====
function syncAllTabs() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = sheet.getSheets();
  var results = [];

  tabs.forEach(function(tab) {
    var tabName = tab.getName();
    
    // Sla tabs over die beginnen met "_" (hulptabbladen)
    if (tabName.startsWith("_")) return;
    
    var data = tab.getDataRange().getValues();
    if (data.length < 2) return; // Geen data (alleen headers)
    
    var headers = data[0].map(function(h) { return String(h).trim(); });
    var rows = [];
    
    for (var i = 1; i < data.length; i++) {
      var row = {};
      var hasData = false;
      for (var j = 0; j < headers.length; j++) {
        if (headers[j] === "") continue;
        var val = data[i][j];
        // Converteer Date objecten naar ISO strings
        if (val instanceof Date) {
          val = val.toISOString();
        }
        row[headers[j]] = val;
        if (val !== "" && val !== null) hasData = true;
      }
      if (hasData) rows.push(row);
    }
    
    if (rows.length === 0) return;
    
    var payload = {
      table_name: tabName,
      rows: rows,
      id_field: headers[0]  // Eerste kolom als unieke ID
    };
    
    try {
      var response = UrlFetchApp.fetch(WEBHOOK_URL, {
        method: "post",
        contentType: "application/json",
        headers: { "x-webhook-secret": WEBHOOK_SECRET },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      
      var code = response.getResponseCode();
      var body = JSON.parse(response.getContentText());
      
      results.push({
        tab: tabName,
        rows: rows.length,
        status: code === 200 ? "OK" : "FOUT",
        detail: code === 200 ? body.rows_upserted + " rijen gesync" : body.error
      });
    } catch (e) {
      results.push({ tab: tabName, rows: rows.length, status: "FOUT", detail: e.message });
    }
  });
  
  // Log resultaten
  Logger.log("Sync resultaten: " + JSON.stringify(results, null, 2));
  return results;
}

// ===== HANDMATIGE TEST =====
function testSync() {
  var results = syncAllTabs();
  var msg = results.map(function(r) {
    return r.tab + ": " + r.status + " (" + r.detail + ")";
  }).join("\\n");
  
  SpreadsheetApp.getUi().alert("Sync Resultaten", msg, SpreadsheetApp.getUi().ButtonSet.OK);
}

// ===== TRIGGER INSTELLEN (eenmalig uitvoeren) =====
function setupHourlyTrigger() {
  // Verwijder bestaande triggers
  var triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(function(t) {
    if (t.getHandlerFunction() === "syncAllTabs") {
      ScriptApp.deleteTrigger(t);
    }
  });
  
  // Maak nieuwe trigger aan: elk uur
  ScriptApp.newTrigger("syncAllTabs")
    .timeBased()
    .everyHours(1)
    .create();
  
  SpreadsheetApp.getUi().alert("Trigger ingesteld! De synchronisatie draait nu elk uur automatisch.");
}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="h-5 w-5 text-primary" />
          Externe Data Synchronisatie
        </CardTitle>
        <CardDescription>
          Synchroniseer data vanuit een MS Access database via Google Sheets of Power Automate.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Webhook URL — altijd zichtbaar */}
        <div className="space-y-2">
          <Label className="font-semibold">Webhook Endpoint</Label>
          <div className="flex gap-2">
            <Input readOnly value={webhookUrl} className="font-mono text-xs" />
            <Button variant="outline" size="icon" onClick={() => copyToClipboard(webhookUrl)}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Dit endpoint ontvangt data via een POST-request met JSON body en <code className="bg-muted px-1 rounded">x-webhook-secret</code> header.
          </p>
        </div>

        {/* Methode tabs */}
        <Tabs defaultValue="google-sheets" className="space-y-4">
          <TabsList className="w-full">
            <TabsTrigger value="google-sheets" className="flex-1 gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Google Sheets
            </TabsTrigger>
            <TabsTrigger value="power-automate" className="flex-1 gap-2">
              <Zap className="h-4 w-4" />
              Power Automate
            </TabsTrigger>
          </TabsList>

          {/* Google Sheets Tab */}
          <TabsContent value="google-sheets" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Gratis methode — geen Microsoft 365 nodig</p>
                <p className="text-sm text-muted-foreground">
                  Exporteer je Access-tabellen als Excel naar Google Drive, open ze als Google Sheet, 
                  en laat een Apps Script de data automatisch elk uur synchroniseren.
                </p>
              </AlertDescription>
            </Alert>

            <Accordion type="single" collapsible className="w-full">
              {/* Stap 1 */}
              <AccordionItem value="step-1">
                <AccordionTrigger className="text-sm font-medium">
                  Stap 1: Access-tabellen exporteren naar Excel
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Open je Access-database en exporteer elke tabel:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Klik met rechtermuisknop op een tabel → <strong>Exporteren</strong> → <strong>Excel-werkmap</strong></li>
                    <li>Sla het bestand op in je <strong>Google Drive</strong> map (als je de desktop-app hebt) of upload het handmatig</li>
                    <li>Herhaal voor elke tabel die je wilt synchroniseren</li>
                  </ol>
                  <p className="text-xs mt-2">
                    💡 <strong>Tip:</strong> Je kunt ook alle tabellen in één Excel-bestand zetten, elk op een apart tabblad.
                  </p>
                </AccordionContent>
              </AccordionItem>

              {/* Stap 2 */}
              <AccordionItem value="step-2">
                <AccordionTrigger className="text-sm font-medium">
                  Stap 2: Openen als Google Sheet
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Ga naar <a href="https://drive.google.com" target="_blank" rel="noopener" className="text-primary underline">Google Drive</a></li>
                    <li>Dubbelklik op het Excel-bestand</li>
                    <li>Klik bovenaan op <strong>"Openen met Google Spreadsheets"</strong></li>
                    <li>Controleer dat elk tabblad overeenkomt met een Access-tabel</li>
                    <li>Zorg dat <strong>rij 1 de kolomnamen</strong> bevat (headers)</li>
                  </ol>
                </AccordionContent>
              </AccordionItem>

              {/* Stap 3 */}
              <AccordionItem value="step-3">
                <AccordionTrigger className="text-sm font-medium">
                  Stap 3: Apps Script installeren
                </AccordionTrigger>
                <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Open je Google Sheet</li>
                    <li>Ga naar <strong>Extensies → Apps Script</strong></li>
                    <li>Verwijder alle bestaande code</li>
                    <li>Plak onderstaande code en klik <strong>Opslaan</strong> (💾)</li>
                    <li>Vervang <code className="bg-muted px-1 rounded">PLAK_HIER_JE_SECRET</code> met je eigen webhook secret</li>
                  </ol>

                  <div className="relative">
                    <pre className="bg-muted/50 p-3 rounded-md text-xs overflow-auto max-h-[300px] whitespace-pre font-mono border">
                      {appsScriptCode}
                    </pre>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2 gap-1"
                      onClick={() => copyToClipboard(appsScriptCode)}
                    >
                      <Copy className="h-3 w-3" />
                      Kopieer
                    </Button>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Stap 4 */}
              <AccordionItem value="step-4">
                <AccordionTrigger className="text-sm font-medium">
                  Stap 4: Testen en trigger activeren
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                  <p><strong>Handmatig testen:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Selecteer de functie <code className="bg-muted px-1 rounded">testSync</code> in de dropdown bovenaan</li>
                    <li>Klik op <strong>▶ Uitvoeren</strong></li>
                    <li>Geef toestemming wanneer daarom gevraagd wordt (eenmalig)</li>
                    <li>Een pop-up toont het resultaat per tabblad</li>
                  </ol>
                  <p className="mt-2"><strong>Automatische trigger instellen:</strong></p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Selecteer de functie <code className="bg-muted px-1 rounded">setupHourlyTrigger</code></li>
                    <li>Klik op <strong>▶ Uitvoeren</strong></li>
                    <li>Klaar! De synchronisatie draait nu automatisch elk uur</li>
                  </ol>
                  <p className="text-xs mt-2">
                    💡 Controleer hieronder de <strong>Synchronisatie Log</strong> om te zien of de data binnenkomt.
                  </p>
                </AccordionContent>
              </AccordionItem>

              {/* Stap 5 */}
              <AccordionItem value="step-5">
                <AccordionTrigger className="text-sm font-medium">
                  Stap 5: Data bijwerken
                </AccordionTrigger>
                <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                  <p>Wanneer je Access-data wijzigt:</p>
                  <ol className="list-decimal list-inside space-y-1 ml-2">
                    <li>Exporteer de gewijzigde tabel(len) opnieuw als Excel</li>
                    <li>Upload naar Google Drive (overschrijf het bestaande bestand)</li>
                    <li>De Google Sheet wordt automatisch bijgewerkt</li>
                    <li>Bij de volgende automatische run (elk uur) wordt de data gesynchroniseerd</li>
                  </ol>
                  <p className="text-xs mt-2">
                    💡 <strong>Tip:</strong> Maak een Access-macro die automatisch exporteert — dan hoef je alleen nog op een knop te drukken.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>

          {/* Power Automate Tab */}
          <TabsContent value="power-automate" className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription className="space-y-2">
                <p className="font-medium">Vereist: Microsoft 365 werk- of schoolaccount</p>
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  <li>Maak een nieuwe <strong>Scheduled Cloud Flow</strong> (elk uur)</li>
                  <li>Voeg actie toe: <strong>"List rows present in a table"</strong> (OneDrive → Access)</li>
                  <li>Voeg actie toe: <strong>"HTTP"</strong> met methode POST naar bovenstaande URL</li>
                  <li>Stel de header in: <code className="bg-muted px-1 rounded">x-webhook-secret</code> met het gedeelde geheim</li>
                  <li>Body: <code className="bg-muted px-1 rounded">{`{"table_name": "TabelNaam", "rows": @{body('List_rows')}, "id_field": "ID"}`}</code></li>
                  <li>Herhaal stap 2-5 voor elke Access-tabel</li>
                </ol>
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {/* Synced Tables */}
        {tables.length > 0 && (
          <div className="space-y-2 border-t pt-4">
            <Label className="font-semibold">Gesynchroniseerde tabellen</Label>
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
        <div className="space-y-2 border-t pt-4">
          <div className="flex items-center justify-between">
            <Label className="font-semibold">Synchronisatie Log</Label>
            <Button variant="ghost" size="sm" onClick={fetchData} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
              Vernieuwen
            </Button>
          </div>

          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Nog geen synchronisaties ontvangen. Volg de stappen hierboven om te beginnen.
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
