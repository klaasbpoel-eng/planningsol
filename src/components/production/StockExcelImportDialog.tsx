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
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";

interface StockExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (data: StockItem[]) => void;
}

export interface StockItem {
  subCode: string;
  description: string;
  averageConsumption: number;
  numberOnStock: number;
  difference: number;
}

interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

export function StockExcelImportDialog({
  open,
  onOpenChange,
  onImported,
}: StockExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<StockItem[]>([]);
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [stats, setStats] = useState<ImportStats | null>(null);

  const resetState = () => {
    setFile(null);
    setParsedData([]);
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

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];

        // Find header row to get column indices
        let headerRowIndex = -1;
        let columnMap: { [key: string]: number } = {};

        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row) continue;

          const rowStr = row.map(cell => String(cell || "").toLowerCase()).join("|");
          
          // Look for header row with stock-related columns
          if (
            (rowStr.includes("subcode") || rowStr.includes("sub code") || rowStr.includes("artikelcode")) &&
            (rowStr.includes("omschrijving") || rowStr.includes("description")) &&
            (rowStr.includes("voorraad") || rowStr.includes("stock") || rowStr.includes("aantal"))
          ) {
            headerRowIndex = i;
            row.forEach((cell, idx) => {
              const cellStr = String(cell || "").toLowerCase().trim();
              if (cellStr.includes("subcode") || cellStr.includes("sub code") || cellStr.includes("artikelcode") || cellStr === "code") {
                columnMap.subCode = idx;
              }
              if (cellStr.includes("omschrijving") || cellStr.includes("description") || cellStr === "naam" || cellStr === "product") {
                columnMap.description = idx;
              }
              if (cellStr.includes("gem") && (cellStr.includes("verbr") || cellStr.includes("cons"))) {
                columnMap.averageConsumption = idx;
              }
              if (cellStr.includes("voorraad") || cellStr.includes("stock") || cellStr.includes("aantal op voorraad")) {
                columnMap.numberOnStock = idx;
              }
              if (cellStr.includes("verschil") || cellStr.includes("difference") || cellStr.includes("diff")) {
                columnMap.difference = idx;
              }
            });
            break;
          }
        }

        // Fallback to fixed indices if header not found
        if (headerRowIndex === -1) {
          columnMap = { subCode: 0, description: 1, averageConsumption: 2, numberOnStock: 3, difference: 4 };
          headerRowIndex = 0;
        }

        console.log("Stock column mapping:", columnMap, "Header row:", headerRowIndex);

        // Parse data rows
        const items: StockItem[] = [];
        const startRow = headerRowIndex + 1;
        const errors: string[] = [];

        for (let i = startRow; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 3) continue;

          const subCode = String(row[columnMap.subCode ?? 0] || "").trim();
          const description = String(row[columnMap.description ?? 1] || "").trim();
          
          // Skip empty rows
          if (!subCode && !description) continue;

          const avgConsumption = parseFloat(String(row[columnMap.averageConsumption ?? 2] || "0").replace(",", "."));
          const stockCount = parseFloat(String(row[columnMap.numberOnStock ?? 3] || "0").replace(",", "."));
          
          // Calculate difference if not provided
          let difference: number;
          if (columnMap.difference !== undefined && row[columnMap.difference] !== undefined) {
            difference = parseFloat(String(row[columnMap.difference] || "0").replace(",", "."));
          } else {
            difference = stockCount - avgConsumption;
          }

          if (isNaN(avgConsumption) || isNaN(stockCount)) {
            errors.push(`Rij ${i + 1}: Ongeldige numerieke waarden`);
            continue;
          }

          items.push({
            subCode: subCode || `AUTO-${i}`,
            description: description || "Onbekend product",
            averageConsumption: Math.round(avgConsumption),
            numberOnStock: Math.round(stockCount),
            difference: Math.round(difference),
          });
        }

        setParsedData(items);
        setStats({
          total: items.length + errors.length,
          imported: items.length,
          skipped: errors.length,
          errors,
        });
        setStep("preview");
        
        if (items.length > 0) {
          toast.success(`${items.length} voorraad items gevonden in Excel bestand`);
        } else {
          toast.error("Geen geldige data gevonden in het Excel bestand");
        }
      } catch (error) {
        console.error("Error parsing Excel:", error);
        toast.error("Fout bij het lezen van het Excel bestand");
      }
    };

    reader.readAsArrayBuffer(selectedFile);
  }, []);

  const handleImport = () => {
    if (parsedData.length === 0) {
      toast.error("Geen data om te importeren");
      return;
    }

    onImported(parsedData);
    setStep("done");
    toast.success(`${parsedData.length} voorraad items geïmporteerd`);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Voorraad Importeren vanuit Excel
          </DialogTitle>
          <DialogDescription>
            Upload een Excel bestand met voorraadgegevens. Het bestand moet kolommen bevatten voor artikelcode, omschrijving, gemiddeld verbruik en voorraad.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          {step === "upload" && (
            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
              <Upload className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Sleep een Excel bestand hierheen of klik om te selecteren
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="stock-excel-upload"
              />
              <Button asChild>
                <label htmlFor="stock-excel-upload" className="cursor-pointer">
                  Selecteer bestand
                </label>
              </Button>
            </div>
          )}

          {step === "preview" && parsedData.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-sm">
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  {file?.name}
                </Badge>
                <Badge variant="secondary">
                  {parsedData.length} items
                </Badge>
                {stats && stats.skipped > 0 && (
                  <Badge variant="destructive">
                    {stats.skipped} overgeslagen
                  </Badge>
                )}
              </div>

              <ScrollArea className="h-[400px] border rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 font-medium">Code</th>
                      <th className="text-left p-2 font-medium">Omschrijving</th>
                      <th className="text-right p-2 font-medium">Gem. Verbr.</th>
                      <th className="text-right p-2 font-medium">Voorraad</th>
                      <th className="text-right p-2 font-medium">Verschil</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsedData.map((item, idx) => (
                      <tr key={idx} className="border-t hover:bg-muted/30">
                        <td className="p-2 font-mono text-xs">{item.subCode}</td>
                        <td className="p-2 max-w-[200px] truncate">{item.description}</td>
                        <td className="p-2 text-right">{item.averageConsumption}</td>
                        <td className="p-2 text-right">{item.numberOnStock}</td>
                        <td className={`p-2 text-right font-semibold ${
                          item.difference < 0 ? "text-red-500" : 
                          item.difference > 0 ? "text-green-500" : 
                          "text-muted-foreground"
                        }`}>
                          {item.difference > 0 ? "+" : ""}{item.difference}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </ScrollArea>

              {stats && stats.errors.length > 0 && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-2">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    {stats.errors.length} rijen overgeslagen:
                  </p>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    {stats.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {stats.errors.length > 5 && (
                      <li>... en {stats.errors.length - 5} meer</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center justify-center py-12">
              <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Import Voltooid!</h3>
              <p className="text-sm text-muted-foreground">
                {parsedData.length} voorraad items zijn succesvol geïmporteerd.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === "upload" && (
            <Button variant="outline" onClick={handleClose}>
              Annuleren
            </Button>
          )}

          {step === "preview" && (
            <>
              <Button variant="outline" onClick={resetState}>
                Opnieuw selecteren
              </Button>
              <Button onClick={handleImport} disabled={parsedData.length === 0}>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Importeren ({parsedData.length} items)
              </Button>
            </>
          )}

          {step === "done" && (
            <Button onClick={handleClose}>
              Sluiten
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
