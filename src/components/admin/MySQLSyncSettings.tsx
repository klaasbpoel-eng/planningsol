import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Loader2, Download } from "lucide-react";

interface MySQLSyncSettingsProps {
  selectedTables: string[];
}

export function MySQLSyncSettings({ selectedTables }: MySQLSyncSettingsProps) {
  const [exporting, setExporting] = useState(false);

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

      const fullSql = sqlParts.join("\n");

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
        downloadBlob = new Blob([fullSql], { type: "application/sql" });
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5 text-primary" />
          MySQL Export
        </CardTitle>
        <CardDescription>
          Download de geselecteerde tabellen als een MySQL-compatibel .sql.gz bestand.
          Dit bestand kun je importeren via phpMyAdmin.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleExportDump}
          disabled={exporting || selectedTables.length === 0}
          className="gap-2"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {exporting ? "Exporteren..." : `Download .sql.gz (${selectedTables.length} tabellen)`}
        </Button>
      </CardContent>
    </Card>
  );
}
