import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Upload, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ImportResult {
  success: boolean;
  totalParsed: number;
  insertedCount: number;
  errorCount: number;
  errors?: string[];
}

export function CustomerImport() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Selecteer een CSV-bestand");
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const csvContent = await file.text();
      
      const { data, error } = await supabase.functions.invoke("import-customers", {
        body: { csvContent },
      });

      if (error) throw error;

      setResult(data as ImportResult);
      
      if (data.success) {
        toast.success(`${data.insertedCount} klanten geïmporteerd`);
      } else {
        toast.error("Er ging iets mis bij het importeren");
      }
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Fout bij importeren van klanten");
    } finally {
      setLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Klanten Importeren
        </CardTitle>
        <CardDescription>
          Importeer klanten vanuit een CSV-bestand
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            disabled={loading}
            className="max-w-xs"
          />
          {loading && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Importeren...</span>
            </div>
          )}
        </div>

        {result && (
          <div className={`p-4 rounded-lg ${result.success ? "bg-green-500/10" : "bg-red-500/10"}`}>
            <div className="flex items-center gap-2 mb-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-red-500" />
              )}
              <span className="font-medium">
                {result.success ? "Import voltooid" : "Import mislukt"}
              </span>
            </div>
            <div className="text-sm space-y-1">
              <p>Unieke klanten gevonden: {result.totalParsed}</p>
              <p>Succesvol geïmporteerd: {result.insertedCount}</p>
              {(result as ImportResult & { skippedCount?: number }).skippedCount && (result as ImportResult & { skippedCount?: number }).skippedCount! > 0 && (
                <p className="text-muted-foreground">Overgeslagen (al bestaand): {(result as ImportResult & { skippedCount?: number }).skippedCount}</p>
              )}
              {result.errorCount > 0 && (
                <p className="text-red-500">Fouten: {result.errorCount}</p>
              )}
            </div>
          </div>
        )}

        <p className="text-sm text-muted-foreground">
          Het CSV-bestand moet puntkomma-gescheiden zijn met kolommen voor klantnaam, adres, postcode en stad.
        </p>
      </CardContent>
    </Card>
  );
}
