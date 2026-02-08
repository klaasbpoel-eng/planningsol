import { useState, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Download, Upload, AlertTriangle, Database } from "lucide-react";

export function DatabaseBackupRestore() {
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackup = async () => {
    setBackupLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/backup-database`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
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
    // Reset input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRestore = async () => {
    if (!selectedFile) return;
    setConfirmOpen(false);
    setRestoreLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Niet ingelogd");

      const text = await selectedFile.text();
      const backup = JSON.parse(text);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/restore-database`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(backup),
        }
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Restore mislukt");
      }

      const result = await response.json();
      toast.success(result.message || "Database succesvol hersteld");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Restore mislukt");
    } finally {
      setRestoreLoading(false);
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

          {(backupLoading || restoreLoading) && (
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
