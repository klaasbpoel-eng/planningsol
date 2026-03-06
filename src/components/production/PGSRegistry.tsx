import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronDown, ChevronRight, Download, Save, AlertTriangle, ShieldAlert, Pencil, X, Check } from "lucide-react";
import { toast } from "sonner";
import { cn, formatNumber } from "@/lib/utils";
import * as XLSX from "xlsx";

// GHS pictogram color mapping
const GHS_COLORS: Record<string, { bg: string; label: string }> = {
  GHS01: { bg: "bg-orange-500", label: "Explosief" },
  GHS02: { bg: "bg-red-500", label: "Ontvlambaar" },
  GHS03: { bg: "bg-yellow-500", label: "Oxiderend" },
  GHS04: { bg: "bg-blue-500", label: "Samengeperst gas" },
  GHS05: { bg: "bg-purple-500", label: "Corrosief" },
  GHS06: { bg: "bg-red-700", label: "Giftig" },
  GHS07: { bg: "bg-orange-400", label: "Schadelijk" },
  GHS08: { bg: "bg-pink-500", label: "Gezondheidsgevaar" },
  GHS09: { bg: "bg-emerald-500", label: "Milieugevaarlijk" },
};

interface PGSSubstance {
  id: string;
  gas_type_id: string | null;
  location: string;
  pgs_guideline: string;
  max_allowed_kg: number;
  current_stock_kg: number;
  storage_class: string | null;
  hazard_symbols: string[];
  un_number: string | null;
  cas_number: string | null;
  risk_phrases: string | null;
  safety_phrases: string | null;
  notes: string | null;
  is_active: boolean;
  gas_type_name?: string;
  gas_type_color?: string;
}

interface PGSRegistryProps {
  location: string;
  isAdmin?: boolean;
}

export function PGSRegistry({ location, isAdmin = false }: PGSRegistryProps) {
  const [substances, setSubstances] = useState<PGSSubstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterGuideline, setFilterGuideline] = useState<string>("all");
  const [filterStorageClass, setFilterStorageClass] = useState<string>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ max_allowed_kg: number; current_stock_kg: number }>({ max_allowed_kg: 0, current_stock_kg: 0 });

  const fetchSubstances = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("pgs_substances")
        .select("*")
        .eq("is_active", true)
        .order("pgs_guideline", { ascending: true });

      if (location !== "all") {
        query = query.eq("location", location as "sol_emmen" | "sol_tilburg");
      }

      const { data, error } = await query;
      if (error) throw error;

      // Fetch gas type names
      const gasTypeIds = [...new Set((data || []).map(s => s.gas_type_id).filter(Boolean))];
      let gasTypeMap: Record<string, { name: string; color: string }> = {};

      if (gasTypeIds.length > 0) {
        const { data: gasTypes } = await supabase
          .from("gas_types")
          .select("id, name, color")
          .in("id", gasTypeIds);

        if (gasTypes) {
          gasTypeMap = Object.fromEntries(gasTypes.map(gt => [gt.id, { name: gt.name, color: gt.color }]));
        }
      }

      setSubstances((data || []).map(s => ({
        ...s,
        hazard_symbols: s.hazard_symbols || [],
        gas_type_name: s.gas_type_id ? gasTypeMap[s.gas_type_id]?.name || "Onbekend" : "Onbekend",
        gas_type_color: s.gas_type_id ? gasTypeMap[s.gas_type_id]?.color || "#6b7280" : "#6b7280",
      })));
    } catch (err) {
      console.error("Error fetching PGS data:", err);
      toast.error("Fout bij ophalen PGS-gegevens");
    } finally {
      setLoading(false);
    }
  }, [location]);

  useEffect(() => {
    fetchSubstances();
  }, [fetchSubstances]);

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startEdit = (substance: PGSSubstance) => {
    setEditingId(substance.id);
    setEditValues({ max_allowed_kg: substance.max_allowed_kg, current_stock_kg: substance.current_stock_kg });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: string) => {
    try {
      const { error } = await supabase
        .from("pgs_substances")
        .update({
          max_allowed_kg: editValues.max_allowed_kg,
          current_stock_kg: editValues.current_stock_kg,
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;
      toast.success("Waarden opgeslagen");
      setEditingId(null);
      fetchSubstances();
    } catch (err) {
      console.error("Error saving:", err);
      toast.error("Fout bij opslaan");
    }
  };

  const exportToExcel = () => {
    const rows = filteredSubstances.map(s => ({
      Gas: s.gas_type_name,
      "PGS Richtlijn": s.pgs_guideline,
      "UN Nummer": s.un_number || "",
      "CAS Nummer": s.cas_number || "",
      "Opslagklasse": s.storage_class || "",
      "GHS Symbolen": (s.hazard_symbols || []).join(", "),
      "Max. Toegestaan (kg)": s.max_allowed_kg,
      "Huidige Voorraad (kg)": s.current_stock_kg,
      "Bezetting (%)": s.max_allowed_kg > 0 ? Math.round((s.current_stock_kg / s.max_allowed_kg) * 100) : 0,
      "H-zinnen": s.risk_phrases || "",
      "P-zinnen": s.safety_phrases || "",
      Locatie: s.location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg",
      Opmerkingen: s.notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "PGS Register");
    XLSX.writeFile(wb, `PGS_Register_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel geëxporteerd");
  };

  // Derive filter options
  const guidelines = [...new Set(substances.map(s => s.pgs_guideline))].sort();
  const storageClasses = [...new Set(substances.map(s => s.storage_class).filter(Boolean))].sort();

  const filteredSubstances = substances.filter(s => {
    if (filterGuideline !== "all" && s.pgs_guideline !== filterGuideline) return false;
    if (filterStorageClass !== "all" && s.storage_class !== filterStorageClass) return false;
    return true;
  });

  const warningCount = substances.filter(s => s.max_allowed_kg > 0 && (s.current_stock_kg / s.max_allowed_kg) >= 0.8).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-destructive" />
              <div>
                <CardTitle className="text-lg">PGS Register Gevaarlijke Stoffen</CardTitle>
                <CardDescription>
                  Overzicht aanwezige gevaarlijke stoffen conform PGS-richtlijnen
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {warningCount > 0 && (
                <Badge variant="destructive" className="flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {warningCount} stof(fen) &gt;80%
                </Badge>
              )}
              <Button variant="outline" size="sm" onClick={exportToExcel}>
                <Download className="h-4 w-4 mr-1" />
                Excel
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <Select value={filterGuideline} onValueChange={setFilterGuideline}>
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="PGS Richtlijn" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle richtlijnen</SelectItem>
              {guidelines.map(g => (
                <SelectItem key={g} value={g}>{g}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {storageClasses.length > 0 && (
          <div className="w-48">
            <Select value={filterStorageClass} onValueChange={setFilterStorageClass}>
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Opslagklasse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle klassen</SelectItem>
                {storageClasses.map(sc => (
                  <SelectItem key={sc!} value={sc!}>{sc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Badge variant="secondary" className="h-9 flex items-center text-xs">
          {filteredSubstances.length} stof(fen)
        </Badge>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8"></TableHead>
                <TableHead>Gas</TableHead>
                <TableHead>PGS</TableHead>
                <TableHead>UN</TableHead>
                <TableHead>GHS</TableHead>
                <TableHead>Voorraad</TableHead>
                <TableHead className="text-right">Max (kg)</TableHead>
                <TableHead className="text-right">Huidig (kg)</TableHead>
                {isAdmin && <TableHead className="w-16"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubstances.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-muted-foreground">
                    Geen PGS-registraties gevonden
                  </TableCell>
                </TableRow>
              ) : (
                filteredSubstances.map(substance => {
                  const pct = substance.max_allowed_kg > 0
                    ? (substance.current_stock_kg / substance.max_allowed_kg) * 100
                    : 0;
                  const isWarning = pct >= 80;
                  const isCritical = pct >= 95;
                  const isExpanded = expandedRows.has(substance.id);
                  const isEditing = editingId === substance.id;

                  return (
                    <Collapsible key={substance.id} open={isExpanded} onOpenChange={() => toggleRow(substance.id)} asChild>
                      <>
                        <TableRow className={cn(isWarning && "bg-destructive/5")}>
                          <TableCell className="p-2">
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: substance.gas_type_color }}
                              />
                              <span className="font-medium">{substance.gas_type_name}</span>
                              {substance.location && (
                                <Badge variant="outline" className="text-[10px] py-0">
                                  {substance.location === "sol_emmen" ? "Emmen" : "Tilburg"}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">{substance.pgs_guideline}</Badge>
                          </TableCell>
                          <TableCell className="text-sm font-mono">{substance.un_number || "—"}</TableCell>
                          <TableCell>
                            <TooltipProvider delayDuration={150}>
                              <div className="flex gap-1">
                                {(substance.hazard_symbols || []).map(sym => (
                                  <Tooltip key={sym}>
                                    <TooltipTrigger asChild>
                                      <span className={cn(
                                        "inline-flex items-center justify-center w-7 h-7 rounded text-[10px] font-bold text-white",
                                        GHS_COLORS[sym]?.bg || "bg-muted-foreground"
                                      )}>
                                        {sym.replace("GHS0", "").replace("GHS", "")}
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      {sym} — {GHS_COLORS[sym]?.label || sym}
                                    </TooltipContent>
                                  </Tooltip>
                                ))}
                              </div>
                            </TooltipProvider>
                          </TableCell>
                          <TableCell className="w-32">
                            <div className="space-y-1">
                              <Progress
                                value={Math.min(pct, 100)}
                                className={cn(
                                  "h-2",
                                  isCritical && "[&>div]:bg-red-600",
                                  isWarning && !isCritical && "[&>div]:bg-orange-500",
                                  !isWarning && "[&>div]:bg-emerald-500"
                                )}
                              />
                              <span className={cn(
                                "text-[10px]",
                                isCritical ? "text-red-600 font-bold" : isWarning ? "text-orange-500 font-medium" : "text-muted-foreground"
                              )}>
                                {formatNumber(pct, 0)}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editValues.max_allowed_kg}
                                onChange={e => setEditValues(v => ({ ...v, max_allowed_kg: Number(e.target.value) }))}
                                className="h-7 w-24 text-right text-sm ml-auto"
                              />
                            ) : (
                              <span className="text-sm">{formatNumber(substance.max_allowed_kg, 0)}</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            {isEditing ? (
                              <Input
                                type="number"
                                value={editValues.current_stock_kg}
                                onChange={e => setEditValues(v => ({ ...v, current_stock_kg: Number(e.target.value) }))}
                                className="h-7 w-24 text-right text-sm ml-auto"
                              />
                            ) : (
                              <span className={cn("text-sm", isWarning && "font-semibold text-destructive")}>
                                {formatNumber(substance.current_stock_kg, 0)}
                              </span>
                            )}
                          </TableCell>
                          {isAdmin && (
                            <TableCell>
                              {isEditing ? (
                                <div className="flex gap-1">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => saveEdit(substance.id)}>
                                    <Check className="h-3 w-3 text-emerald-500" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={cancelEdit}>
                                    <X className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                </div>
                              ) : (
                                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => startEdit(substance)}>
                                  <Pencil className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              )}
                            </TableCell>
                          )}
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={isAdmin ? 9 : 8} className="py-3">
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm px-2">
                                <div>
                                  <span className="text-muted-foreground font-medium">CAS-nummer:</span>{" "}
                                  <span className="font-mono">{substance.cas_number || "—"}</span>
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-medium">Opslagklasse:</span>{" "}
                                  {substance.storage_class || "—"}
                                </div>
                                <div>
                                  <span className="text-muted-foreground font-medium">Locatie:</span>{" "}
                                  {substance.location === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg"}
                                </div>
                                {substance.risk_phrases && (
                                  <div className="md:col-span-3">
                                    <span className="text-muted-foreground font-medium">H-zinnen:</span>{" "}
                                    <span className="text-destructive/80">{substance.risk_phrases}</span>
                                  </div>
                                )}
                                {substance.safety_phrases && (
                                  <div className="md:col-span-3">
                                    <span className="text-muted-foreground font-medium">P-zinnen:</span>{" "}
                                    <span className="text-blue-600 dark:text-blue-400">{substance.safety_phrases}</span>
                                  </div>
                                )}
                                {substance.notes && (
                                  <div className="md:col-span-3">
                                    <span className="text-muted-foreground font-medium">Opmerkingen:</span>{" "}
                                    {substance.notes}
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

export default PGSRegistry;
