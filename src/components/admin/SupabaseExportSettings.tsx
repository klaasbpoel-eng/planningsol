import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Database, Loader2, Download } from "lucide-react";

interface SupabaseExportSettingsProps {
  selectedTables: string[];
}

export function SupabaseExportSettings({ selectedTables }: SupabaseExportSettingsProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (selectedTables.length === 0) {
      toast.error("Selecteer minimaal één tabel");
      return;
    }
    setExporting(true);
    try {
      const allData: Record<string, any[]> = {};
      let totalRows = 0;

      for (let i = 0; i < selectedTables.length; i++) {
        const table = selectedTables[i];
        toast.info(`Exporteren: ${table} (${i + 1}/${selectedTables.length})...`);

        let allRows: any[] = [];
        let offset = 0;
        while (true) {
          const { data, error } = await (supabase.from as any)(table)
            .select("*")
            .range(offset, offset + 999);
          if (error) throw new Error(`Fout bij ${table}: ${error.message}`);
          if (!data || data.length === 0) break;
          allRows = [...allRows, ...data];
          offset += data.length;
          if (data.length < 1000) break;
        }
        allData[table] = allRows;
        totalRows += allRows.length;
      }

      const jsonString = JSON.stringify(allData, null, 2);

      let downloadBlob: Blob;
      let filename: string;
      try {
        const cs = new CompressionStream("gzip");
        const writer = cs.writable.getWriter();
        writer.write(new TextEncoder().encode(jsonString));
        writer.close();
        const reader = cs.readable.getReader();
        const chunks: BlobPart[] = [];
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(new Blob([value]));
        }
        downloadBlob = new Blob(chunks, { type: "application/gzip" });
        filename = `supabase_export_${new Date().toISOString().slice(0, 10)}.json.gz`;
      } catch {
        downloadBlob = new Blob([jsonString], { type: "application/json" });
        filename = `supabase_export_${new Date().toISOString().slice(0, 10)}.json`;
      }

      const url = URL.createObjectURL(downloadBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Supabase export gedownload! (${totalRows} rijen)`);
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
          Supabase Export
        </CardTitle>
        <CardDescription>
          Download de geselecteerde tabellen als een JSON(.gz) bestand.
          Dit bestand kun je importeren in een externe Supabase-instantie.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Button
          onClick={handleExport}
          disabled={exporting || selectedTables.length === 0}
          className="gap-2"
        >
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {exporting ? "Exporteren..." : `Download .json.gz (${selectedTables.length} tabellen)`}
        </Button>
      </CardContent>
    </Card>
  );
}
