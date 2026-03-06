import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, CheckCircle2, Scale, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatNumber } from "@/lib/utils";

// Gas weight in kg per liter water capacity at ~200 bar
const GAS_WEIGHT_PER_LITER: Record<string, number> = {
  zuurstof: 0.263, oxygen: 0.263, o2: 0.263,
  stikstof: 0.232, nitrogen: 0.232, n2: 0.232,
  argon: 0.330, ar: 0.330,
  kooldioxide: 0.750, co2: 0.750,
  helium: 0.033, he: 0.033,
  distikstofoxide: 0.750, n2o: 0.750, lachgas: 0.750,
  lucht: 0.240, air: 0.240,
  acetyleen: 0.250, acetylene: 0.250,
  waterstof: 0.017, hydrogen: 0.017, h2: 0.017,
  lasersol: 0.280, formeergas: 0.240,
};

interface PGSSubstance {
  id: string;
  gas_type_name?: string;
  location: string;
  max_allowed_kg: number;
  current_stock_kg: number;
}

interface PGSMatch {
  substanceId: string;
  gasName: string;
  location: string;
  calculatedKg: number;
  currentKg: number;
  maxKg: number;
}

interface SOLPGSImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  substances: PGSSubstance[];
  locationTab: string;
  onUpdated: () => void;
}

function detectGasWeight(description: string, capacity: number): number {
  const lower = description.toLowerCase();
  for (const [keyword, weightPerLiter] of Object.entries(GAS_WEIGHT_PER_LITER)) {
    if (lower.includes(keyword)) {
      return Math.round(capacity * weightPerLiter * 10) / 10;
    }
  }
  return Math.round(capacity * 0.240 * 10) / 10;
}

function detectLocation(locationId: number | string): { location: "tilburg" | "emmen"; isFull: boolean } | null {
  const locId = Number(locationId);
  if (locId === 110) return { location: "tilburg", isFull: true };
  if (locId === 109) return { location: "tilburg", isFull: false };
  if (locId === 140) return { location: "emmen", isFull: true };
  if (locId === 139) return { location: "emmen", isFull: false };
  return null;
}

/** Normalize gas name for matching: strip purity grades and lowercase */
function normalizeGasName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+\d+\.\d+$/, "")
    .replace(/\s+e\.p\.$/, "")
    .replace(/\s+(industrieel|koeltechnisch|medicinaal\b.*|md apc)$/i, "")
    .trim();
}

/** Extract the primary gas keyword from a SOL ContentDescription */
function extractGasKeyword(description: string): string {
  const lower = description.toLowerCase();
  // Match known gas names
  const gasNames = [
    "zuurstof", "stikstof", "argon", "kooldioxide", "helium",
    "acetyleen", "waterstof", "distikstofoxide", "lachgas",
    "lucht", "lasersol", "formeergas",
  ];
  for (const gas of gasNames) {
    if (lower.includes(gas)) return gas;
  }
  // Try to use first word
  return lower.split(/\s+/)[0] || lower;
}

export function SOLPGSImportDialog({
  open,
  onOpenChange,
  substances,
  locationTab,
  onUpdated,
}: SOLPGSImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [matches, setMatches] = useState<PGSMatch[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [updating, setUpdating] = useState(false);

  const resetState = () => {
    setFile(null);
    setMatches([]);
    setStep("upload");
    setUpdating(false);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

        // Find header row
        let headerIdx = -1;
        let colMap: Record<string, number> = {};
        for (let i = 0; i < Math.min(10, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row) continue;
          const rowStr = row.map(c => String(c || "").toLowerCase()).join("|");
          if (rowStr.includes("contentcode") && rowStr.includes("capacity") && rowStr.includes("locationid")) {
            headerIdx = i;
            row.forEach((cell, idx) => {
              const c = String(cell || "").toLowerCase().trim();
              if (c === "contentdescription") colMap.contentDescription = idx;
              if (c === "mastercodedescription") colMap.masterCodeDescription = idx;
              if (c === "capacity") colMap.capacity = idx;
              if (c === "locationid") colMap.locationId = idx;
            });
            break;
          }
        }

        if (headerIdx === -1) {
          toast.error("Kan de kolomstructuur niet herkennen");
          return;
        }

        // Aggregate weights per gas keyword per location
        const weightMap = new Map<string, { emmen: number; tilburg: number }>();

        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 4) continue;

          const contentDesc = String(row[colMap.contentDescription] || "").trim();
          const masterDesc = String(row[colMap.masterCodeDescription] || "").trim();
          const capacity = parseFloat(String(row[colMap.capacity] || "0"));
          const locationId = String(row[colMap.locationId] || "");

          if (!contentDesc || contentDesc === "NULL" || isNaN(capacity) || capacity <= 0) continue;

          const locInfo = detectLocation(locationId);
          if (!locInfo || !locInfo.isFull) continue; // Only count full cylinders

          const gasKeyword = extractGasKeyword(contentDesc || masterDesc);
          const weight = detectGasWeight(contentDesc || masterDesc, capacity);

          const existing = weightMap.get(gasKeyword) || { emmen: 0, tilburg: 0 };
          existing[locInfo.location] += weight;
          weightMap.set(gasKeyword, existing);
        }

        // Match aggregated weights to PGS substances
        const pgsMatches: PGSMatch[] = [];

        for (const substance of substances) {
          if (!substance.gas_type_name) continue;
          const normalizedName = normalizeGasName(substance.gas_type_name);

          // Find best matching gas keyword
          let bestMatch: string | null = null;
          for (const [keyword] of weightMap) {
            if (normalizedName.includes(keyword) || keyword.includes(normalizedName)) {
              bestMatch = keyword;
              break;
            }
          }

          if (!bestMatch) continue;

          const weights = weightMap.get(bestMatch)!;
          const loc = substance.location === "sol_emmen" ? "emmen" : "tilburg";

          // Filter by selected location tab
          if (locationTab !== "all" && substance.location !== locationTab) continue;

          const calculatedKg = Math.round(weights[loc] * 10) / 10;
          if (calculatedKg <= 0) continue;

          pgsMatches.push({
            substanceId: substance.id,
            gasName: substance.gas_type_name,
            location: substance.location,
            calculatedKg,
            currentKg: substance.current_stock_kg,
            maxKg: substance.max_allowed_kg,
          });
        }

        // Deduplicate: if multiple substances match same gas, keep all
        setMatches(pgsMatches);
        setStep("preview");

        if (pgsMatches.length > 0) {
          toast.success(`${pgsMatches.length} PGS-stoffen gematcht met Excel data`);
        } else {
          toast.warning("Geen overeenkomende PGS-stoffen gevonden");
        }
      } catch (error) {
        console.error("Error parsing SOL Excel:", error);
        toast.error("Fout bij het lezen van het Excel bestand");
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  }, [substances, locationTab]);

  const handleUpdate = async () => {
    if (matches.length === 0) return;
    setUpdating(true);

    try {
      for (const match of matches) {
        const { error } = await supabase
          .from("pgs_substances")
          .update({
            current_stock_kg: match.calculatedKg,
            updated_at: new Date().toISOString(),
          })
          .eq("id", match.substanceId);

        if (error) throw error;
      }

      toast.success(`${matches.length} PGS-stoffen bijgewerkt`);
      setStep("done");
      onUpdated();
    } catch (err) {
      console.error("Error updating PGS substances:", err);
      toast.error("Fout bij het bijwerken van PGS-gegevens");
    } finally {
      setUpdating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            SOL Inventaris → PGS Register
          </DialogTitle>
          <DialogDescription>
            Upload het SOL voorraad Excel-bestand om de huidige voorraadgewichten in het PGS Register automatisch bij te werken.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Upload het SOL inventarisbestand (Voorraad_SOL.xlsx)
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="sol-pgs-upload"
              />
              <Button asChild>
                <label htmlFor="sol-pgs-upload" className="cursor-pointer">
                  Selecteer bestand
                </label>
              </Button>
            </div>
          )}

          {step === "preview" && matches.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  {file?.name}
                </Badge>
                <Badge variant="secondary">{matches.length} stoffen gematcht</Badge>
              </div>

              <ScrollArea className="h-[350px] border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Stof</th>
                      <th className="text-left p-2 font-medium">Locatie</th>
                      <th className="text-right p-2 font-medium">Huidig (kg)</th>
                      <th className="text-center p-2 font-medium"></th>
                      <th className="text-right p-2 font-medium">Nieuw (kg)</th>
                      <th className="text-right p-2 font-medium">Max (kg)</th>
                      <th className="text-right p-2 font-medium">Bezetting</th>
                    </tr>
                  </thead>
                  <tbody>
                    {matches.map((m, idx) => {
                      const newPct = m.maxKg > 0 ? Math.round((m.calculatedKg / m.maxKg) * 100) : 0;
                      const diff = m.calculatedKg - m.currentKg;
                      return (
                        <tr key={idx} className="border-t hover:bg-muted/30">
                          <td className="p-2 font-medium">{m.gasName}</td>
                          <td className="p-2 text-muted-foreground text-xs">
                            {m.location === "sol_emmen" ? "Emmen" : "Tilburg"}
                          </td>
                          <td className="p-2 text-right text-muted-foreground">
                            {formatNumber(m.currentKg, 1)}
                          </td>
                          <td className="p-2 text-center">
                            <ArrowRight className="h-3 w-3 mx-auto text-muted-foreground" />
                          </td>
                          <td className="p-2 text-right font-semibold">
                            <span className={diff > 0 ? "text-green-600 dark:text-green-400" : diff < 0 ? "text-orange-500" : ""}>
                              {formatNumber(m.calculatedKg, 1)}
                            </span>
                          </td>
                          <td className="p-2 text-right text-muted-foreground">
                            {formatNumber(m.maxKg, 0)}
                          </td>
                          <td className="p-2 text-right">
                            <Badge
                              variant="outline"
                              className={
                                newPct >= 95
                                  ? "bg-destructive/10 text-destructive border-destructive/30"
                                  : newPct >= 80
                                    ? "bg-orange-500/10 text-orange-600 border-orange-500/30"
                                    : "bg-green-500/10 text-green-600 border-green-500/30"
                              }
                            >
                              {newPct}%
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </ScrollArea>
            </div>
          )}

          {step === "preview" && matches.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12">
              <Scale className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground">
                Geen overeenkomende PGS-stoffen gevonden in het bestand.
              </p>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">PGS Register Bijgewerkt!</h3>
              <p className="text-sm text-muted-foreground">
                {matches.length} stoffen zijn bijgewerkt met de actuele voorraadgewichten.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>Annuleren</Button>
          )}
          {step === "preview" && (
            <>
              <Button variant="outline" onClick={resetState}>Opnieuw selecteren</Button>
              <Button onClick={handleUpdate} disabled={matches.length === 0 || updating}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {updating ? "Bijwerken..." : `PGS Register bijwerken (${matches.length} stoffen)`}
              </Button>
            </>
          )}
          {step === "done" && (
            <Button onClick={handleClose}>Sluiten</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
