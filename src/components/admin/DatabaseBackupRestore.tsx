import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, AlertTriangle, Database } from "lucide-react";

const RESTORE_ORDER = [
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

const BATCH_SIZE = 500;

export function DatabaseBackupRestore() {
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStatus, setRestoreStatus] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Niet ingelogd");
    return {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    };
  };

  const callRestore = async (body: Record<string, unknown>) => {
    const headers = await getAuthHeaders();
    const response = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-database`,
      { method: "POST", headers, body: JSON.stringify(body) }
    );
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || "Restore mislukt");
    }
    return response.json();
  };

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-database`,
        { method: "POST", headers }
      );
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Backup mislukt");
      }
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Backup succesvol gedownload");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Backup mislukt");
    } finally {
      setBackupLoading(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".json")) {
      toast.error("Selecteer een .json bestand");
      return;
    }
    setSelectedFile(file);
    setConfirmOpen(true);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRestore = async () => {
    if (!selectedFile) return;
    setConfirmOpen(false);
    setRestoreLoading(true);
    setRestoreProgress(0);
    setRestoreStatus("Backup bestand lezen...");

    try {
      const text = await selectedFile.text();
      const backup = JSON.parse(text);

      if (!backup.version || !backup.tables) {
        throw new Error("Ongeldig backup-bestand: version en tables velden zijn vereist");
      }

      // Validate all tables exist
      for (const table of RESTORE_ORDER) {
        if (!Array.isArray(backup.tables[table])) {
          throw new Error(`Ongeldig backup-bestand: tabel "${table}" ontbreekt`);
        }
      }

      // Calculate total batches for progress
      let totalBatches = 1; // 1 for clear
      for (const table of RESTORE_ORDER) {
        const rows = backup.tables[table];
        totalBatches += Math.max(1, Math.ceil(rows.length / BATCH_SIZE));
      }
      let completedBatches = 0;

      // Phase 1: Clear all tables
      setRestoreStatus("Bestaande data verwijderen...");
      await callRestore({ action: "clear" });
      completedBatches++;
      setRestoreProgress(Math.round((completedBatches / totalBatches) * 100));

      // Phase 2: Insert table by table
      for (const table of RESTORE_ORDER) {
        const rows = backup.tables[table];
        if (rows.length === 0) {
          completedBatches++;
          setRestoreProgress(Math.round((completedBatches / totalBatches) * 100));
          continue;
        }

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          setRestoreStatus(`${table} herstellen... (${Math.min(i + BATCH_SIZE, rows.length)}/${rows.length})`);
          await callRestore({ action: "insert", table, rows: batch });
          completedBatches++;
          setRestoreProgress(Math.round((completedBatches / totalBatches) * 100));
        }
      }

      setRestoreStatus("");
      toast.success("Database succesvol hersteld");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore mislukt");
    } finally {
      setRestoreLoading(false);
      setRestoreProgress(0);
      setRestoreStatus("");
      setSelectedFile(null);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Database Backup & Restore
          </CardTitle>
          <CardDescription>
            Maak een volledige backup van de database of herstel een eerder gemaakte backup.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <Button onClick={handleBackup} disabled={backupLoading || restoreLoading}>
              <Download className="h-4 w-4" />
              {backupLoading ? "Backup maken..." : "Backup downloaden"}
            </Button>

            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              disabled={backupLoading || restoreLoading}
            >
              <Upload className="h-4 w-4" />
              {restoreLoading ? "Herstellen..." : "Backup herstellen"}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {restoreLoading && (
            <div className="space-y-2">
              <Progress value={restoreProgress} className="h-2" />
              <p className="text-sm text-muted-foreground">{restoreStatus} ({restoreProgress}%)</p>
            </div>
          )}

          {backupLoading && (
            <Progress value={undefined} className="h-2" />
          )}
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Database herstellen
            </DialogTitle>
            <DialogDescription>
              Dit overschrijft <strong>alle huidige data</strong> in de database met de data uit het backup-bestand.
              Dit kan niet ongedaan worden gemaakt. Weet je het zeker?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Annuleren
            </Button>
            <Button variant="destructive" onClick={handleRestore}>
              Ja, database herstellen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
