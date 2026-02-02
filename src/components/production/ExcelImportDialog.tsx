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
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ParsedCylinderOrder {
  date: Date;
  gasType: string;
  cylinderSize: string;
  count: number;
  grade: "medical" | "technical";
  customer: string;
  notes: string;
  pressure: number;
  location: "sol_emmen" | "sol_tilburg";
}

interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

interface GasType {
  id: string;
  name: string;
}

export function ExcelImportDialog({
  open,
  onOpenChange,
  onImported,
}: ExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedCylinderOrder[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [gasTypes, setGasTypes] = useState<GasType[]>([]);
  const [cylinderSizes, setCylinderSizes] = useState<string[]>([]);

  // Fetch gas types when dialog opens
  const fetchGasTypes = async () => {
    const { data } = await supabase
      .from("gas_types")
      .select("id, name")
      .eq("is_active", true);
    if (data) setGasTypes(data);
  };

  // Fetch cylinder sizes when dialog opens
  const fetchCylinderSizes = async () => {
    const { data } = await supabase
      .from("cylinder_sizes")
      .select("name")
      .eq("is_active", true);
    if (data) setCylinderSizes(data.map(s => s.name));
  };

  // Match gas type name to ID from the gas_types table using priority-based matching
  const matchGasTypeId = (gasName: string): string | null => {
    const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const normalizedInput = normalize(gasName);
    
    // Prioriteit 1: Exacte match (genormaliseerd)
    const exactMatch = gasTypes.find(gt => normalize(gt.name) === normalizedInput);
    if (exactMatch) return exactMatch.id;
    
    // Prioriteit 2: Één bevat de andere volledig (kies de beste match op lengte-verschil)
    const containsMatches = gasTypes.filter(gt => {
      const gtNorm = normalize(gt.name);
      return normalizedInput.includes(gtNorm) || gtNorm.includes(normalizedInput);
    });
    
    if (containsMatches.length > 0) {
      // Sorteer op lengte-verschil (kleinste verschil = beste match)
      containsMatches.sort((a, b) => {
        const diffA = Math.abs(normalize(a.name).length - normalizedInput.length);
        const diffB = Math.abs(normalize(b.name).length - normalizedInput.length);
        return diffA - diffB;
      });
      return containsMatches[0].id;
    }
    
    // Geen match gevonden - retourneer null in plaats van incorrecte match
    return null;
  };

  // Gas type mapping from Excel names to database enum (for legacy support)
  const mapGasTypeToEnum = (gasName: string): "co2" | "nitrogen" | "argon" | "acetylene" | "oxygen" | "helium" | "other" => {
    const name = gasName.toLowerCase();
    if (name.includes("zuurstof") || name.includes("o2")) return "oxygen";
    if (name.includes("stikstof") || name.includes("n2")) return "nitrogen";
    if (name.includes("argon")) return "argon";
    if (name.includes("koolzuur") || name.includes("co2")) return "co2";
    if (name.includes("acetyleen")) return "acetylene";
    if (name.includes("helium")) return "helium";
    return "other";
  };

  // Parse cylinder size from Excel format with robust pattern matching
  const parseCylinderSize = (sizeStr: string, cylinderSizes: string[] = []): { size: string; pressure: number } => {
    const str = sizeStr.toLowerCase().trim();
    if (!str) return { size: "50L", pressure: 200 };
    
    let pressure = 200;
    
    // Extract pressure from string
    if (str.includes("300 bar") || str.includes("300bar")) pressure = 300;
    if (str.includes("4 bar") || str.includes("4bar")) pressure = 4; // Voor Dewars
    
    // Dewar patterns (uitgebreid) - check eerst voor specifieke capaciteit
    if (str.includes("dewar")) {
      const dewarMatch = str.match(/dewar\s*(\d+)/i);
      if (dewarMatch) {
        const dewarSize = `Dewar ${dewarMatch[1]}L`;
        // Check of deze exact in de database staat
        const dbMatch = cylinderSizes.find(s => s.toLowerCase() === dewarSize.toLowerCase());
        return { size: dbMatch || dewarSize, pressure: 4 };
      }
      return { size: "Dewar 240L", pressure: 4 };
    }
    
    // PP bundel patterns (uitgebreid) - bijv. "PP 16 X 50L", "PP16x50", "pp 12 x 40"
    const ppMatch = str.match(/pp\s*(\d+)\s*x\s*(\d+)/i);
    if (ppMatch) {
      const ppSize = `PP ${ppMatch[1]} X ${ppMatch[2]}L`;
      const dbMatch = cylinderSizes.find(s => s.toLowerCase() === ppSize.toLowerCase());
      return { size: dbMatch || ppSize, pressure };
    }
    
    // Liter patroon met komma-ondersteuning (bijv. "0,5 liter", "10 liter cilinder", "50L")
    const literMatch = str.match(/(\d+[,.]?\d*)\s*l(?:iter)?/i);
    if (literMatch) {
      const liters = parseFloat(literMatch[1].replace(',', '.'));
      
      // Probeer exacte match met database cylinder_sizes
      const roundedLiters = Math.round(liters * 10) / 10; // Rond af op 1 decimaal
      
      // Exacte match proberen
      const exactMatch = cylinderSizes.find(s => {
        const sLiters = parseFloat(s.replace(/[^\d.,]/g, '').replace(',', '.'));
        return Math.abs(sLiters - roundedLiters) < 0.1;
      });
      
      if (exactMatch) return { size: exactMatch, pressure };
      
      // Format as "XL" voor standaard sizes
      if (roundedLiters < 1) {
        return { size: `${roundedLiters.toString().replace('.', ',')}L`, pressure };
      }
      return { size: `${Math.round(roundedLiters)}L`, pressure };
    }
    
    // Fallback - probeer toch een getal te vinden
    const numMatch = str.match(/(\d+)/);
    if (numMatch) {
      const num = parseInt(numMatch[1]);
      if (num > 0 && num <= 100) {
        const sizeStr = `${num}L`;
        const dbMatch = cylinderSizes.find(s => s === sizeStr);
        return { size: dbMatch || sizeStr, pressure };
      }
    }
    
    return { size: "50L", pressure };
  };

  // Parse location from Excel format
  const parseLocation = (locationStr: string | undefined): "sol_emmen" | "sol_tilburg" => {
    if (!locationStr) return "sol_emmen";
    
    const str = locationStr.toLowerCase().trim();
    
    // Match Tilburg variations
    if (str.includes("tilburg")) {
      return "sol_tilburg";
    }
    
    // Match Emmen variations (including "depot emmen")
    if (str.includes("emmen")) {
      return "sol_emmen";
    }
    
    // Default to Emmen for unknown locations
    return "sol_emmen";
  };

  // Parse Excel date
  const parseExcelDate = (value: unknown): Date | null => {
    if (!value) return null;
    
    // Excel serial date number
    if (typeof value === "number") {
      const excelEpoch = new Date(1899, 11, 30);
      const date = new Date(excelEpoch.getTime() + value * 86400000);
      return date;
    }
    
    // String date formats
    if (typeof value === "string") {
      // Try parsing M/D/YY format (e.g., "1/2/25")
      const parts = value.split("/");
      if (parts.length === 3) {
        const month = parseInt(parts[0]) - 1;
        const day = parseInt(parts[1]);
        let year = parseInt(parts[2]);
        if (year < 100) year += 2000;
        return new Date(year, month, day);
      }
      
      // Try standard date parsing
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed;
    }
    
    return null;
  };

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    
    setFile(selectedFile);
    
    // Fetch gas types and cylinder sizes for matching
    await Promise.all([fetchGasTypes(), fetchCylinderSizes()]);
    
    // Get current user profile
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      
      if (profile) {
        setCurrentProfileId(profile.id);
      }
    }
    
    // Parse Excel file
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });
        
        // Get first sheet (Cilinder Vullingen)
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
          
          // Look for header row with "Datum", "Gassoort", etc.
          const rowStr = row.map(cell => String(cell || "").toLowerCase()).join("|");
          if (rowStr.includes("datum") && (rowStr.includes("gassoort") || rowStr.includes("gastype"))) {
            headerRowIndex = i;
            // Map column names to indices
            row.forEach((cell, idx) => {
              const cellStr = String(cell || "").toLowerCase().trim();
              if (cellStr.includes("datum")) columnMap.date = idx;
              if (cellStr.includes("gassoort") || cellStr.includes("gastype")) columnMap.gasType = idx;
              // Detect size column - expanded patterns including "omschrijving" and "inhoud"
              if (columnMap.size === undefined) {
                if (cellStr.includes("type vulling") || cellStr.includes("vulling type") || 
                    cellStr.includes("cilinderinhoud") || cellStr.includes("cilinder inhoud") ||
                    cellStr.includes("formaat") || cellStr.includes("size") || 
                    cellStr.includes("grootte") || cellStr === "inhoud") {
                  columnMap.size = idx;
                }
              }
              if (cellStr === "aantal") columnMap.count = idx;
              if (cellStr === "m/t") columnMap.grade = idx;
              // Detect location column
              if (cellStr.includes("locatie") || cellStr.includes("location") || 
                  cellStr.includes("productielocatie") || cellStr.includes("site") || 
                  cellStr.includes("vestiging")) {
                columnMap.location = idx;
              }
              // Detect customer column - "klant" or "vulling tbv"
              if (cellStr.includes("vulling tbv") || cellStr.includes("tbv") || 
                  cellStr === "klant" || cellStr.includes("customer")) {
                columnMap.customer = idx;
              }
              // Detect notes column - "opmerkingen" or "omschrijving"
              if (cellStr.includes("opmerkingen") || cellStr.includes("opmerking") ||
                  cellStr.includes("omschrijving") || cellStr === "notes") {
                columnMap.notes = idx;
              }
              // Detect pressure column
              if (cellStr.includes("pressure") || cellStr.includes("druk") || 
                  cellStr === "bar") {
                columnMap.pressure = idx;
              }
            });
            break;
          }
        }
        
        // Fallback to fixed indices if header not found (matching Excel structure: Datum, Gastype, Cilinderinhoud, Aantal, M/T, Locatie, Klant, Omschrijving)
        if (headerRowIndex === -1) {
          columnMap = { date: 0, gasType: 1, size: 2, count: 3, grade: 4, location: 5, customer: 6, notes: 7, pressure: 8 };
        }
        
        console.log("Column mapping:", columnMap, "Header row:", headerRowIndex);
        
        // Find data start (skip header rows)
        const orders: ParsedCylinderOrder[] = [];
        const startRow = headerRowIndex > -1 ? headerRowIndex + 1 : 0;
        
        for (let i = startRow; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 5) continue;
          
          // Check if first column is a date
          const dateValue = parseExcelDate(row[columnMap.date ?? 0]);
          if (!dateValue || dateValue.getFullYear() < 2020) continue;
          
          const gasType = String(row[columnMap.gasType ?? 1] || "").trim();
          let sizeStr = String(row[columnMap.size ?? 2] || "").trim();
          const count = parseInt(String(row[columnMap.count ?? 3] || "0"));
          const gradeCode = String(row[columnMap.grade ?? 4] || "T").toUpperCase();
          const customer = String(row[columnMap.customer ?? 5] || "").trim();
          const notes = String(row[columnMap.notes ?? 6] || "").trim();
          const locationStr = columnMap.location !== undefined 
            ? String(row[columnMap.location] || "").trim() 
            : undefined;
          
          // Fallback: als size leeg is, probeer notes/omschrijving kolom
          if (!sizeStr && notes) {
            sizeStr = notes;
          }
          
          if (!gasType || count <= 0) continue;
          
          // Parse pressure from dedicated column, fallback to description parsing
          let pressure = 200;
          if (columnMap.pressure !== undefined) {
            const pressureVal = parseInt(String(row[columnMap.pressure] || "200"));
            if (!isNaN(pressureVal) && pressureVal > 0) {
              pressure = pressureVal;
            }
          } else {
            // Try to extract pressure from sizeStr or notes
            const pressureSource = sizeStr || notes;
            const { pressure: descPressure } = parseCylinderSize(pressureSource, cylinderSizes);
            pressure = descPressure;
          }
          
          const { size } = parseCylinderSize(sizeStr, cylinderSizes);
          const location = parseLocation(locationStr);
          
          orders.push({
            date: dateValue,
            gasType,
            cylinderSize: size,
            count,
            grade: gradeCode === "M" ? "medical" : "technical",
            customer: customer || "Onbekend",
            notes,
            pressure,
            location,
          });
        }
        
        setParsedData(orders);
        setStep("preview");
        toast.success(`${orders.length} orders gevonden in Excel bestand`);
      } catch (error) {
        console.error("Error parsing Excel:", error);
        toast.error("Fout bij het lezen van het Excel bestand");
      }
    };
    
    reader.readAsArrayBuffer(selectedFile);
  }, []);

  const generateOrderNumber = (index: number) => {
    const date = format(new Date(), "yyyyMMdd");
    const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
    return `GC-IMP-${date}-${index.toString().padStart(5, "0")}-${uuid}`;
  };

  const handleImport = async () => {
    if (!currentProfileId || parsedData.length === 0) {
      toast.error("Geen data om te importeren");
      return;
    }
    
    setImporting(true);
    setStep("importing");
    setProgress(0);
    
    const stats: ImportStats = {
      total: parsedData.length,
      imported: 0,
      skipped: 0,
      errors: [],
    };
    
    // Process in batches of 50
    const batchSize = 50;
    const batches = Math.ceil(parsedData.length / batchSize);
    
    for (let batchIndex = 0; batchIndex < batches; batchIndex++) {
      const start = batchIndex * batchSize;
      const end = Math.min(start + batchSize, parsedData.length);
      const batch = parsedData.slice(start, end);
      
      const createInsertData = () => batch.map((order, idx) => ({
        order_number: generateOrderNumber(start + idx),
        customer_name: order.customer,
        gas_type: mapGasTypeToEnum(order.gasType),
        gas_type_id: matchGasTypeId(order.gasType),
        gas_grade: order.grade,
        cylinder_count: order.count,
        cylinder_size: order.cylinderSize,
        pressure: order.pressure,
        scheduled_date: format(order.date, "yyyy-MM-dd"),
        notes: order.notes || null,
        created_by: currentProfileId,
        status: "completed" as const,
        location: order.location,
      }));
      
      let insertData = createInsertData();
      let { error } = await supabase
        .from("gas_cylinder_orders")
        .insert(insertData);
      
      // Retry with new order numbers if duplicate key error
      if (error?.message?.includes("duplicate key")) {
        console.log(`Batch ${batchIndex + 1}: Duplicate key detected, retrying with new order numbers...`);
        insertData = createInsertData();
        const retryResult = await supabase
          .from("gas_cylinder_orders")
          .insert(insertData);
        error = retryResult.error;
        
        // If still failing, try individual inserts as fallback
        if (error?.message?.includes("duplicate key")) {
          console.log(`Batch ${batchIndex + 1}: Retry failed, falling back to individual inserts...`);
          let batchSuccess = 0;
          let batchFailed = 0;
          
          for (let i = 0; i < batch.length; i++) {
            const order = batch[i];
            const singleInsert = {
              order_number: generateOrderNumber(start + i),
              customer_name: order.customer,
              gas_type: mapGasTypeToEnum(order.gasType),
              gas_type_id: matchGasTypeId(order.gasType),
              gas_grade: order.grade,
              cylinder_count: order.count,
              cylinder_size: order.cylinderSize,
              pressure: order.pressure,
              scheduled_date: format(order.date, "yyyy-MM-dd"),
              notes: order.notes || null,
              created_by: currentProfileId,
              status: "completed" as const,
              location: order.location,
            };
            
            const { error: singleError } = await supabase
              .from("gas_cylinder_orders")
              .insert(singleInsert);
            
            if (singleError) {
              batchFailed++;
            } else {
              batchSuccess++;
            }
          }
          
          stats.imported += batchSuccess;
          stats.skipped += batchFailed;
          if (batchFailed > 0) {
            stats.errors.push(`Batch ${batchIndex + 1}: ${batchFailed} records konden niet worden geïmporteerd`);
          }
          setProgress(Math.round(((batchIndex + 1) / batches) * 100));
          continue;
        }
      }
      
      if (error) {
        console.error("Batch insert error:", error);
        stats.errors.push(`Batch ${batchIndex + 1}: ${error.message}`);
        stats.skipped += batch.length;
      } else {
        stats.imported += batch.length;
      }
      
      setProgress(Math.round(((batchIndex + 1) / batches) * 100));
    }
    
    setStats(stats);
    setImporting(false);
    setStep("done");
    
    if (stats.imported > 0) {
      toast.success(`${stats.imported} orders succesvol geïmporteerd`);
      onImported();
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setProgress(0);
    setStats(null);
    setStep("upload");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <FileSpreadsheet className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">Excel Import</DialogTitle>
              <DialogDescription>
                Importeer productiedata vanuit een Excel bestand
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {step === "upload" && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Sleep een Excel bestand hierheen of klik om te selecteren
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="excel-upload"
              />
              <label htmlFor="excel-upload">
                <Button variant="outline" asChild>
                  <span>Bestand selecteren</span>
                </Button>
              </label>
            </div>
          )}

          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">{file?.name}</span>
                </div>
                <Badge variant="secondary">{parsedData.length} orders</Badge>
              </div>
              
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Datum</th>
                        <th className="text-left py-2">Gastype</th>
                        <th className="text-left py-2">Grootte</th>
                        <th className="text-right py-2">Aantal</th>
                        <th className="text-right py-2">Bar</th>
                        <th className="text-left py-2">Klant</th>
                        <th className="text-left py-2">Locatie</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsedData.slice(0, 100).map((order, idx) => (
                        <tr key={idx} className="border-b border-muted">
                          <td className="py-1.5">{format(order.date, "dd-MM-yyyy")}</td>
                          <td className="py-1.5">{order.gasType}</td>
                          <td className="py-1.5">{order.cylinderSize}</td>
                          <td className="py-1.5 text-right">{order.count}</td>
                          <td className="py-1.5 text-right">{order.pressure}</td>
                          <td className="py-1.5">{order.customer}</td>
                          <td className="py-1.5">
                            <span className={`text-xs px-1.5 py-0.5 rounded ${order.location === "sol_tilburg" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" : "bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300"}`}>
                              {order.location === "sol_tilburg" ? "Tilburg" : "Emmen"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {parsedData.length > 100 && (
                    <p className="text-center text-sm text-muted-foreground mt-4">
                      ... en {parsedData.length - 100} meer orders
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}

          {step === "importing" && (
            <div className="space-y-4 py-8">
              <div className="flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
              <p className="text-center text-sm text-muted-foreground">
                Bezig met importeren...
              </p>
              <Progress value={progress} className="w-full" />
              <p className="text-center text-sm font-medium">{progress}%</p>
            </div>
          )}

          {step === "done" && stats && (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center">
                {stats.errors.length === 0 ? (
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                ) : (
                  <AlertCircle className="h-12 w-12 text-yellow-500" />
                )}
              </div>
              
              <div className="text-center">
                <h3 className="font-semibold text-lg">Import voltooid</h3>
                <p className="text-sm text-muted-foreground">
                  {stats.imported} van {stats.total} orders geïmporteerd
                </p>
              </div>
              
              <div className="flex justify-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.imported}</div>
                  <div className="text-xs text-muted-foreground">Geïmporteerd</div>
                </div>
                {stats.skipped > 0 && (
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{stats.skipped}</div>
                    <div className="text-xs text-muted-foreground">Overgeslagen</div>
                  </div>
                )}
              </div>
              
              {stats.errors.length > 0 && (
                <ScrollArea className="h-[100px] rounded-md border p-2">
                  {stats.errors.map((error, idx) => (
                    <p key={idx} className="text-xs text-destructive">{error}</p>
                  ))}
                </ScrollArea>
              )}
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
              <Button variant="outline" onClick={handleClose}>
                Annuleren
              </Button>
              <Button onClick={handleImport} disabled={parsedData.length === 0}>
                <Upload className="h-4 w-4 mr-2" />
                {parsedData.length} orders importeren
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
