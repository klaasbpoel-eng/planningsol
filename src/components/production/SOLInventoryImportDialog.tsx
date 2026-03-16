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
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Scale } from "lucide-react";
import { toast } from "sonner";
import { type StockItem } from "./StockExcelImportDialog";
import { formatNumber } from "@/lib/utils";

interface SOLInventoryImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (data: StockItem[]) => void;
  locationLabel?: string;
  targetLocation?: string;
}

// Gas weight in kg per liter water capacity at ~200 bar
const GAS_WEIGHT_PER_LITER: Record<string, number> = {
  zuurstof: 0.263,
  oxygen: 0.263,
  o2: 0.263,
  stikstof: 0.232,
  nitrogen: 0.232,
  n2: 0.232,
  argon: 0.330,
  ar: 0.330,
  kooldioxide: 0.750,
  co2: 0.750,
  helium: 0.033,
  he: 0.033,
  distikstofoxide: 0.750,
  n2o: 0.750,
  lachgas: 0.750,
  lucht: 0.240,
  air: 0.240,
  acetyleen: 0.250,
  acetylene: 0.250,
  waterstof: 0.017,
  hydrogen: 0.017,
  h2: 0.017,
  lasersol: 0.280, // mix, approximate
  formeergas: 0.240,
};

interface AggregatedRow {
  contentCode: string;
  contentDescription: string;
  capacity: number;
  containerType: string;
  countVol: number;
  countLeeg: number;
  countTotal: number;
  location: "tilburg" | "emmen" | "mixed";
  weightPerCylinderKg: number;
  totalWeightKg: number;
}

function detectGasWeight(description: string, capacity: number): number {
  const lower = description.toLowerCase();
  for (const [keyword, weightPerLiter] of Object.entries(GAS_WEIGHT_PER_LITER)) {
    if (lower.includes(keyword)) {
      return Math.round(capacity * weightPerLiter * 10) / 10;
    }
  }
  // Fallback: assume air-like density
  return Math.round(capacity * 0.240 * 10) / 10;
}

function detectLocation(dsCenter: string, locationId: number | string): { location: "tilburg" | "emmen"; isFull: boolean } {
  const locId = Number(locationId);
  // LocationId mapping: 109=leeg Tilburg, 110=vol Tilburg, 139=leeg Emmen, 140=vol Emmen
  if (locId === 110) return { location: "tilburg", isFull: true };
  if (locId === 109) return { location: "tilburg", isFull: false };
  if (locId === 140) return { location: "emmen", isFull: true };
  if (locId === 139) return { location: "emmen", isFull: false };

  // Fallback to DS_CENTER_DESCRIPTION
  const desc = (dsCenter || "").toLowerCase();
  const isFull = desc.includes("vol ") || desc.includes("warehouse distribution");
  if (desc.includes("tilburg")) return { location: "tilburg", isFull };
  if (desc.includes("emmen") || desc.includes("ntg")) return { location: "emmen", isFull };
  return { location: "tilburg", isFull };
}

export function SOLInventoryImportDialog({
  open,
  onOpenChange,
  onImported,
  locationLabel = "SOL Emmen",
  targetLocation = "sol_emmen",
}: SOLInventoryImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [aggregated, setAggregated] = useState<AggregatedRow[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [stats, setStats] = useState<{ totalRows: number; skipped: number; products: number; errors: string[] } | null>(null);

  const resetState = () => {
    setFile(null);
    setAggregated([]);
    setStep("upload");
    setStats(null);
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
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
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
              if (c === "contentcode") colMap.contentCode = idx;
              if (c === "contentdescription") colMap.contentDescription = idx;
              if (c === "mastercodedescription") colMap.masterCodeDescription = idx;
              if (c === "capacity") colMap.capacity = idx;
              if (c === "containertypedescr") colMap.containerType = idx;
              if (c === "locationid") colMap.locationId = idx;
              if (c === "ds_center_description") colMap.dsCenter = idx;
            });
            break;
          }
        }

        if (headerIdx === -1) {
          toast.error("Kan de kolomstructuur niet herkennen. Verwacht: ContentCode, Capacity, LocationId");
          return;
        }

        // Aggregate by ContentCode + Capacity + Location
        const groupMap = new Map<string, AggregatedRow>();
        let skipped = 0;
        const errors: string[] = [];
        const filterLocation = targetLocation === "sol_emmen" ? "emmen" : "tilburg";

        for (let i = headerIdx + 1; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 5) continue;

          const contentCode = String(row[colMap.contentCode] || "").trim();
          const contentDesc = String(row[colMap.contentDescription] || "").trim();
          const masterDesc = String(row[colMap.masterCodeDescription] || "").trim();
          const capacity = parseFloat(String(row[colMap.capacity] || "0"));
          const containerType = String(row[colMap.containerType] || "").trim();
          const locationId = String(row[colMap.locationId] || "");
          const dsCenter = String(row[colMap.dsCenter] || "");

          // Skip rows with NULL content (empty cylinders without product)
          if (!contentCode || contentCode === "NULL" || !contentDesc || contentDesc === "NULL") {
            skipped++;
            continue;
          }

          if (isNaN(capacity) || capacity <= 0) {
            skipped++;
            continue;
          }

          const { location, isFull } = detectLocation(dsCenter, locationId);

          // Only include items for the target location
          if (location !== filterLocation) {
            skipped++;
            continue;
          }

          const key = `${contentCode}__${capacity}`;
          const existing = groupMap.get(key);

          if (existing) {
            if (isFull) existing.countVol++;
            else existing.countLeeg++;
            existing.countTotal++;
          } else {
            const weightPerCylinder = detectGasWeight(contentDesc || masterDesc, capacity);
            groupMap.set(key, {
              contentCode,
              contentDescription: contentDesc,
              capacity,
              containerType,
              countVol: isFull ? 1 : 0,
              countLeeg: isFull ? 0 : 1,
              countTotal: 1,
              location,
              weightPerCylinderKg: weightPerCylinder,
              totalWeightKg: 0, // calculated after
            });
          }
        }

        // Calculate total weights and sort
        const results = Array.from(groupMap.values()).map(r => ({
          ...r,
          totalWeightKg: Math.round(r.countVol * r.weightPerCylinderKg * 10) / 10,
        }));
        results.sort((a, b) => a.contentDescription.localeCompare(b.contentDescription) || a.capacity - b.capacity);

        setAggregated(results);
        setStats({
          totalRows: jsonData.length - 1 - headerIdx,
          skipped,
          products: results.length,
          errors,
        });
        setStep("preview");

        if (results.length > 0) {
          toast.success(`${results.length} producten geaggregeerd uit ${jsonData.length - 1 - headerIdx} cilinderrijen`);
        } else {
          toast.error("Geen relevante data gevonden voor deze locatie");
        }
      } catch (error) {
        console.error("Error parsing SOL Excel:", error);
        toast.error("Fout bij het lezen van het Excel bestand");
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  }, [targetLocation]);

  const handleImport = () => {
    if (aggregated.length === 0) return;

    const stockItems: StockItem[] = aggregated.map(row => ({
      subCode: row.contentCode,
      description: `${row.contentDescription} (${row.capacity}L)`,
      averageConsumption: 0, // SOL inventory doesn't include consumption data
      numberOnStock: row.countVol,
      numberEmpty: row.countLeeg,
      difference: row.countVol, // No consumption baseline, so difference = stock
      filledInEmmen: row.location === "emmen",
    }));

    onImported(stockItems);
    setStep("done");
    toast.success(`${stockItems.length} producten geïmporteerd voor ${locationLabel}`);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const totalVolCylinders = aggregated.reduce((s, r) => s + r.countVol, 0);
  const totalLeegCylinders = aggregated.reduce((s, r) => s + r.countLeeg, 0);
  const totalWeightKg = aggregated.reduce((s, r) => s + r.totalWeightKg, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            SOL Inventaris Importeren
          </DialogTitle>
          <DialogDescription>
            Upload het SOL voorraad Excel-bestand. Individuele cilinderregistraties worden automatisch
            geaggregeerd per producttype en cilindergrootte. Gewichten worden automatisch berekend op basis van gastype.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Upload het SOL inventarisbestand (Voorraad_SOL.xlsx)
              </p>
              <Badge variant="outline" className="mb-4">
                Locatie: {locationLabel}
              </Badge>
              <p className="text-xs text-muted-foreground mb-4 max-w-md text-center">
                Het bestand moet kolommen bevatten: ContentCode, ContentDescription, Capacity,
                LocationId, DS_CENTER_DESCRIPTION
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="sol-inventory-upload"
              />
              <Button asChild>
                <label htmlFor="sol-inventory-upload" className="cursor-pointer">
                  Selecteer bestand
                </label>
              </Button>
            </div>
          )}

          {step === "preview" && aggregated.length > 0 && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="text-sm">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  {file?.name}
                </Badge>
                <Badge variant="secondary">{aggregated.length} producten</Badge>
                <Badge variant="default">{locationLabel}</Badge>
                <Badge className="bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30">
                  {totalVolCylinders} vol
                </Badge>
                <Badge className="bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30">
                  {totalLeegCylinders} leeg
                </Badge>
                <Badge className="bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30">
                  <Scale className="h-3 w-3 mr-1" />
                  {formatNumber(totalWeightKg, 1)} kg totaal
                </Badge>
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Product</th>
                      <th className="text-left p-2 font-medium">Code</th>
                      <th className="text-right p-2 font-medium">Liter</th>
                      <th className="text-right p-2 font-medium">Vol</th>
                      <th className="text-right p-2 font-medium">Leeg</th>
                      <th className="text-right p-2 font-medium">Totaal</th>
                      <th className="text-right p-2 font-medium">kg/cil</th>
                      <th className="text-right p-2 font-medium">Totaal kg</th>
                    </tr>
                  </thead>
                  <tbody>
                    {aggregated.map((row, idx) => (
                      <tr key={idx} className="border-t hover:bg-muted/30">
                        <td className="p-2 max-w-[250px] truncate" title={row.contentDescription}>
                          {row.contentDescription}
                        </td>
                        <td className="p-2 font-mono text-xs">{row.contentCode}</td>
                        <td className="p-2 text-right">{row.capacity}L</td>
                        <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400">
                          {row.countVol}
                        </td>
                        <td className="p-2 text-right text-orange-500">{row.countLeeg}</td>
                        <td className="p-2 text-right">{row.countTotal}</td>
                        <td className="p-2 text-right text-muted-foreground">
                          {formatNumber(row.weightPerCylinderKg, 1)}
                        </td>
                        <td className="p-2 text-right font-semibold">
                          {formatNumber(row.totalWeightKg, 1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-muted/50 border-t-2">
                    <tr>
                      <td className="p-2 font-semibold" colSpan={3}>Totaal</td>
                      <td className="p-2 text-right font-semibold text-green-600 dark:text-green-400">{totalVolCylinders}</td>
                      <td className="p-2 text-right font-semibold text-orange-500">{totalLeegCylinders}</td>
                      <td className="p-2 text-right font-semibold">{totalVolCylinders + totalLeegCylinders}</td>
                      <td className="p-2" />
                      <td className="p-2 text-right font-bold">{formatNumber(totalWeightKg, 1)}</td>
                    </tr>
                  </tfoot>
                </table>
              </ScrollArea>

              {stats && stats.skipped > 0 && (
                <p className="text-xs text-muted-foreground">
                  {stats.skipped} rijen overgeslagen (lege cilinders, andere locatie, of ongeldige data)
                </p>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Import Voltooid!</h3>
              <p className="text-sm text-muted-foreground">
                {aggregated.length} producten ({totalVolCylinders} volle cilinders, {formatNumber(totalWeightKg, 1)} kg)
                zijn geïmporteerd voor {locationLabel}.
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
              <Button onClick={handleImport} disabled={aggregated.length === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Importeren ({aggregated.length} producten)
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
