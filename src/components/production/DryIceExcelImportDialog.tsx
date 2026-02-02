import { useState, useCallback, useEffect } from "react";
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
import { Label } from "@/components/ui/label";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatNumber } from "@/lib/utils";
import { format } from "date-fns";
import { CustomerSelect } from "./CustomerSelect";

interface DryIceExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

interface ParsedDryIceOrder {
  date: Date;
  productType: string; // "09 mm." or "03 mm."
  packagingCapacity: number; // 22, 120, 200, 240, 360 kg
  boxCount: number;
  totalKg: number;
}

interface ImportStats {
  total: number;
  imported: number;
  skipped: number;
  errors: string[];
}

interface ProductType {
  id: string;
  name: string;
}

interface Packaging {
  id: string;
  name: string;
  capacity_kg: number | null;
}

export function DryIceExcelImportDialog({
  open,
  onOpenChange,
  onImported,
}: DryIceExcelImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [parsedData, setParsedData] = useState<ParsedDryIceOrder[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [stats, setStats] = useState<ImportStats | null>(null);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [step, setStep] = useState<"upload" | "preview" | "importing" | "done">("upload");
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<Packaging[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("");

  useEffect(() => {
    if (open) {
      fetchProductTypes();
      fetchPackaging();
    }
  }, [open]);

  const fetchProductTypes = async () => {
    const { data } = await supabase
      .from("dry_ice_product_types")
      .select("id, name")
      .eq("is_active", true);
    if (data) setProductTypes(data);
  };

  const fetchPackaging = async () => {
    const { data } = await supabase
      .from("dry_ice_packaging")
      .select("id, name, capacity_kg")
      .eq("is_active", true);
    if (data) setPackagingOptions(data);
  };

  // Match product type (e.g., "09 mm." -> find matching product type)
  const matchProductTypeId = (diameter: string): string | null => {
    const diameterStr = diameter.toLowerCase().trim();
    
    // Extract numeric value (e.g., "09 mm." → "9", "03 mm." → "3")
    const numericMatch = diameterStr.match(/(\d+)/);
    if (!numericMatch) {
      return productTypes[0]?.id || null;
    }
    
    const numericValue = parseInt(numericMatch[1], 10).toString(); // "09" → "9"
    
    // Find product type containing this number
    const match = productTypes.find(pt => {
      const ptName = pt.name.toLowerCase();
      // Check for exact numeric match in product name
      return ptName.includes(numericValue + "mm") || 
             ptName.includes(numericValue + " mm") ||
             ptName.includes(numericValue);
    });
    
    return match?.id || productTypes[0]?.id || null;
  };

  // Match packaging based on capacity
  const matchPackagingId = (capacityKg: number): string | null => {
    // Try to find exact match first
    const exactMatch = packagingOptions.find(p => p.capacity_kg === capacityKg);
    if (exactMatch) return exactMatch.id;
    
    // Try to find closest match
    const sorted = [...packagingOptions]
      .filter(p => p.capacity_kg !== null)
      .sort((a, b) => Math.abs((a.capacity_kg || 0) - capacityKg) - Math.abs((b.capacity_kg || 0) - capacityKg));
    
    return sorted[0]?.id || null;
  };

  // Parse Excel date in DD/MM/YY format
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
      // Try DD/MM/YY format (e.g., "02/01/25")
      const ddmmyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
      if (ddmmyy) {
        const day = parseInt(ddmmyy[1]);
        const month = parseInt(ddmmyy[2]) - 1;
        let year = parseInt(ddmmyy[3]);
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
    
    // Fetch product types and packaging for matching
    await Promise.all([fetchProductTypes(), fetchPackaging()]);
    
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
        
        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // Convert to JSON
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as unknown[][];
        
        // Find header row (contains "Datum", "Diameter", "Doos/Container", "Aantal")
        let headerRowIndex = -1;
        let columnMap: { [key: string]: number } = {};
        
        for (let i = 0; i < Math.min(20, jsonData.length); i++) {
          const row = jsonData[i];
          if (!row) continue;
          
          const rowStr = row.map(cell => String(cell || "").toLowerCase()).join("|");
          if (rowStr.includes("datum") && (rowStr.includes("diameter") || rowStr.includes("inhoud"))) {
            headerRowIndex = i;
            row.forEach((cell, idx) => {
              const cellStr = String(cell || "").toLowerCase().trim();
              if (cellStr === "datum") columnMap.date = idx;
              if (cellStr === "diameter" || cellStr.includes("type")) columnMap.productType = idx;
              if (cellStr.includes("doos") || cellStr.includes("container") || cellStr === "inhoud") columnMap.packaging = idx;
              if (cellStr === "aantal") columnMap.count = idx;
              if (cellStr.includes("totaal")) columnMap.total = idx;
            });
            break;
          }
        }
        
        // Fallback to fixed indices based on the analyzed structure
        if (headerRowIndex === -1) {
          // Structure: Datum | Diameter | Doos/Container (Inhoud) | Aantal | Totaal aantal KG
          columnMap = { date: 0, productType: 1, packaging: 2, count: 3, total: 4 };
        }
        
        console.log("Column mapping:", columnMap, "Header row:", headerRowIndex);
        
        // Parse data rows
        const orders: ParsedDryIceOrder[] = [];
        const startRow = headerRowIndex > -1 ? headerRowIndex + 1 : 0;
        
        for (let i = startRow; i < jsonData.length; i++) {
          const row = jsonData[i];
          if (!row || row.length < 4) continue;
          
          // Skip month header rows (e.g., "Januari 2025")
          const firstCell = String(row[0] || "").toLowerCase();
          if (firstCell.includes("januari") || firstCell.includes("februari") || 
              firstCell.includes("maart") || firstCell.includes("april") ||
              firstCell.includes("mei") || firstCell.includes("juni") ||
              firstCell.includes("juli") || firstCell.includes("augustus") ||
              firstCell.includes("september") || firstCell.includes("oktober") ||
              firstCell.includes("november") || firstCell.includes("december") ||
              firstCell.includes("subtotaal") || firstCell.includes("totaal")) {
            continue;
          }
          
          // Check if first column is a date
          const dateValue = parseExcelDate(row[columnMap.date ?? 0]);
          if (!dateValue || dateValue.getFullYear() < 2020) continue;
          
          const productType = String(row[columnMap.productType ?? 1] || "").trim();
          const packagingCapacity = parseFloat(String(row[columnMap.packaging ?? 2] || "0").replace(",", "."));
          const boxCount = parseFloat(String(row[columnMap.count ?? 3] || "0").replace(",", "."));
          
          // Calculate total or use provided value
          let totalKg = packagingCapacity * boxCount;
          if (columnMap.total !== undefined && row[columnMap.total]) {
            const providedTotal = parseFloat(String(row[columnMap.total]).replace(",", ".").replace(/[^\d.]/g, ""));
            if (!isNaN(providedTotal) && providedTotal > 0) {
              totalKg = providedTotal;
            }
          }
          
          if (!productType || boxCount <= 0 || packagingCapacity <= 0) continue;
          
          orders.push({
            date: dateValue,
            productType,
            packagingCapacity,
            boxCount,
            totalKg,
          });
        }
        
        setParsedData(orders);
        setStep("preview");
        toast.success(`${orders.length} droogijs orders gevonden in Excel bestand`);
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
    return `DI-IMP-${date}-${index.toString().padStart(5, "0")}-${uuid}`;
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
        customer_id: selectedCustomerId || null,
        customer_name: selectedCustomerName || "Import",
        product_type: "pellets" as const, // Default enum value
        product_type_id: matchProductTypeId(order.productType),
        packaging_id: matchPackagingId(order.packagingCapacity),
        quantity_kg: order.totalKg,
        box_count: Math.round(order.boxCount),
        scheduled_date: format(order.date, "yyyy-MM-dd"),
        notes: `Geïmporteerd: ${order.productType}, ${order.packagingCapacity}kg x ${order.boxCount}`,
        created_by: currentProfileId,
        status: "completed" as const,
      }));
      
      let insertData = createInsertData();
      let { error } = await supabase
        .from("dry_ice_orders")
        .insert(insertData);
      
      // Retry with new order numbers if duplicate key error
      if (error?.message?.includes("duplicate key")) {
        console.log(`Batch ${batchIndex + 1}: Duplicate key detected, retrying...`);
        insertData = createInsertData();
        const retryResult = await supabase
          .from("dry_ice_orders")
          .insert(insertData);
        error = retryResult.error;
        
        // Fallback to individual inserts
        if (error?.message?.includes("duplicate key")) {
          console.log(`Batch ${batchIndex + 1}: Retry failed, falling back to individual inserts...`);
          let batchSuccess = 0;
          let batchFailed = 0;
          
          for (let i = 0; i < batch.length; i++) {
            const order = batch[i];
            const singleInsert = {
              order_number: generateOrderNumber(start + i),
              customer_id: selectedCustomerId || null,
              customer_name: selectedCustomerName || "Import",
              product_type: "pellets" as const,
              product_type_id: matchProductTypeId(order.productType),
              packaging_id: matchPackagingId(order.packagingCapacity),
              quantity_kg: order.totalKg,
              box_count: Math.round(order.boxCount),
              scheduled_date: format(order.date, "yyyy-MM-dd"),
              notes: `Geïmporteerd: ${order.productType}, ${order.packagingCapacity}kg x ${order.boxCount}`,
              created_by: currentProfileId,
              status: "completed" as const,
            };
            
            const { error: singleError } = await supabase
              .from("dry_ice_orders")
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
      toast.success(`${stats.imported} droogijs orders succesvol geïmporteerd`);
      onImported();
    }
  };

  const handleClose = () => {
    setFile(null);
    setParsedData([]);
    setProgress(0);
    setStats(null);
    setStep("upload");
    setSelectedCustomerId("");
    setSelectedCustomerName("");
    onOpenChange(false);
  };

  // Group parsed data by month for preview
  const groupedByMonth = parsedData.reduce((acc, order) => {
    const monthKey = format(order.date, "MMMM yyyy");
    if (!acc[monthKey]) acc[monthKey] = [];
    acc[monthKey].push(order);
    return acc;
  }, {} as Record<string, ParsedDryIceOrder[]>);

  const totalKg = parsedData.reduce((sum, o) => sum + o.totalKg, 0);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Snowflake className="h-5 w-5 text-cyan-500" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">Droogijs Excel Import</DialogTitle>
              <DialogDescription>
                Importeer droogijs productiedata vanuit een Excel bestand
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {step === "upload" && (
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Sleep een Excel bestand hierheen of klik om te selecteren
              </p>
              <p className="text-xs text-muted-foreground mb-4">
                Verwacht formaat: Datum | Diameter | Inhoud (kg) | Aantal | Totaal kg
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileSelect}
                className="hidden"
                id="dry-ice-excel-upload"
              />
              <label htmlFor="dry-ice-excel-upload">
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
                <div className="flex gap-2">
                  <Badge variant="secondary">{parsedData.length} orders</Badge>
                  <Badge variant="outline">{formatNumber(totalKg, 0)} kg totaal</Badge>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Klant voor geïmporteerde orders</Label>
                <CustomerSelect
                  value={selectedCustomerId}
                  onValueChange={(id, name) => {
                    setSelectedCustomerId(id);
                    setSelectedCustomerName(name);
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Alle geïmporteerde orders worden aan deze klant gekoppeld
                </p>
              </div>
              
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="p-4">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 pr-4 font-medium">Datum</th>
                        <th className="text-left py-2 pr-4 font-medium">Type</th>
                        <th className="text-right py-2 pr-4 font-medium">Verpakking</th>
                        <th className="text-right py-2 pr-4 font-medium">Aantal</th>
                        <th className="text-right py-2 font-medium">Totaal kg</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(groupedByMonth).map(([month, monthOrders]) => (
                        <>
                          <tr key={`header-${month}`} className="bg-muted/50">
                            <td colSpan={4} className="py-2 px-2 font-medium">{month}</td>
                            <td className="py-2 text-right font-medium">
                              {formatNumber(monthOrders.reduce((sum, o) => sum + o.totalKg, 0), 0)} kg
                            </td>
                          </tr>
                          {monthOrders.slice(0, 10).map((order, i) => (
                            <tr key={`${month}-${i}`} className="border-b border-muted/30">
                              <td className="py-1.5 pr-4">{format(order.date, "dd/MM/yyyy")}</td>
                              <td className="py-1.5 pr-4">
                                <Badge variant="outline" className="text-xs">
                                  {order.productType}
                                </Badge>
                              </td>
                              <td className="py-1.5 pr-4 text-right">{order.packagingCapacity} kg</td>
                              <td className="py-1.5 pr-4 text-right">{order.boxCount}</td>
                              <td className="py-1.5 text-right font-medium">{formatNumber(order.totalKg, 0)}</td>
                            </tr>
                          ))}
                          {monthOrders.length > 10 && (
                            <tr key={`more-${month}`}>
                              <td colSpan={5} className="py-1.5 text-center text-muted-foreground text-xs">
                                ... en {monthOrders.length - 10} meer orders
                              </td>
                            </tr>
                          )}
                        </>
                      ))}
                    </tbody>
                  </table>
                </div>
              </ScrollArea>
            </div>
          )}

          {step === "importing" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Importeren...</span>
              </div>
              <Progress value={progress} />
              <p className="text-xs text-muted-foreground text-center">
                {progress}% voltooid
              </p>
            </div>
          )}

          {step === "done" && stats && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-500">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Import voltooid</span>
              </div>
              
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-green-500">{stats.imported}</div>
                  <div className="text-xs text-muted-foreground">Geïmporteerd</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-yellow-500">{stats.skipped}</div>
                  <div className="text-xs text-muted-foreground">Overgeslagen</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-xs text-muted-foreground">Totaal</div>
                </div>
              </div>
              
              {stats.errors.length > 0 && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2 text-destructive mb-2">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">Fouten tijdens import:</span>
                  </div>
                  <ul className="text-xs text-destructive space-y-1">
                    {stats.errors.slice(0, 5).map((error, i) => (
                      <li key={i}>• {error}</li>
                    ))}
                    {stats.errors.length > 5 && (
                      <li>... en {stats.errors.length - 5} meer fouten</li>
                    )}
                  </ul>
                </div>
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
              <Button variant="outline" onClick={() => {
                setStep("upload");
                setFile(null);
                setParsedData([]);
              }}>
                Terug
              </Button>
              <Button 
                onClick={handleImport} 
                disabled={parsedData.length === 0}
                variant="dryice"
              >
                <Upload className="h-4 w-4 mr-2" />
                {parsedData.length} orders importeren
              </Button>
            </>
          )}
          
          {step === "importing" && (
            <Button variant="outline" disabled>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Bezig met importeren...
            </Button>
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
