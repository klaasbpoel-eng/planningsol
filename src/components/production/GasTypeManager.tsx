import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Flame, Plus, Pencil, Trash2, Save, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface GasType {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  sort_order: number;
}

interface GasTypeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortColumn = "name" | "description" | "is_active";
type SortDirection = "asc" | "desc";

export function GasTypeManager({ open, onOpenChange }: GasTypeManagerProps) {
  const [gasTypes, setGasTypes] = useState<GasType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<GasType | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<GasType | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  // Sort state
  const [sortColumn, setSortColumn] = useState<SortColumn>("name");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchGasTypes = async () => {
    const { data, error } = await supabase
      .from("gas_types")
      .select("*")
      .order(sortColumn, { ascending: sortDirection === "asc", nullsFirst: false });

    if (error) {
      console.error("Error fetching gas types:", error);
    } else {
      setGasTypes(data || []);
    }
    setLoading(false);
  };

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  useEffect(() => {
    if (open) {
      setCurrentPage(1);
      fetchGasTypes();
    }
  }, [open, sortColumn, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(gasTypes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGasTypes = gasTypes.slice(startIndex, endIndex);

  const openEditDialog = (type: GasType | null) => {
    if (type) {
      setName(type.name);
      setDescription(type.description || "");
      setColor(type.color);
      setIsActive(type.is_active);
    } else {
      setName("");
      setDescription("");
      setColor("#3b82f6");
      setIsActive(true);
    }
    setEditingType(type);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Voer een naam in");
      return;
    }

    setSaving(true);
    const typeData = {
      name: name.trim(),
      description: description.trim() || null,
      color,
      is_active: isActive,
      sort_order: editingType ? editingType.sort_order : gasTypes.length,
    };

    try {
      if (editingType) {
        const { error } = await supabase
          .from("gas_types")
          .update(typeData)
          .eq("id", editingType.id);
        if (error) throw error;
        toast.success("Gastype bijgewerkt");
      } else {
        const { error } = await supabase
          .from("gas_types")
          .insert(typeData);
        if (error) throw error;
        toast.success("Gastype toegevoegd");
      }
      fetchGasTypes();
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error saving gas type:", error);
      toast.error("Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;

    const { error } = await supabase
      .from("gas_types")
      .delete()
      .eq("id", typeToDelete.id);

    if (error) {
      console.error("Error deleting gas type:", error);
      toast.error("Fout bij verwijderen");
    } else {
      toast.success("Gastype verwijderd");
      fetchGasTypes();
    }
    setDeleteDialogOpen(false);
    setTypeToDelete(null);
  };

  const handleToggleActive = async (type: GasType) => {
    const { error } = await supabase
      .from("gas_types")
      .update({ is_active: !type.is_active })
      .eq("id", type.id);

    if (error) {
      toast.error("Fout bij bijwerken");
    } else {
      fetchGasTypes();
    }
  };

  const handleBulkDelete = async () => {
    if (gasTypes.length === 0) return;

    setBulkDeleting(true);
    try {
      const { error } = await supabase
        .from("gas_types")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000"); // Delete all

      if (error) throw error;
      
      toast.success(`${gasTypes.length} gastypes verwijderd`);
      fetchGasTypes();
      setBulkDeleteDialogOpen(false);
    } catch (error) {
      console.error("Error bulk deleting gas types:", error);
      toast.error("Fout bij verwijderen van gastypes");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Flame className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <DialogTitle>Gastypes beheren</DialogTitle>
                <DialogDescription>
                  Beheer de beschikbare gassoorten
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <div className="flex justify-between mb-4">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setBulkDeleteDialogOpen(true)}
                disabled={gasTypes.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Alles verwijderen ({gasTypes.length})
              </Button>
              <Button size="sm" onClick={() => openEditDialog(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuw gastype
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : gasTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Geen gastypes gevonden
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">Kleur</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center">
                        Naam
                        <SortIcon column="name" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("description")}
                    >
                      <div className="flex items-center">
                        Omschrijving
                        <SortIcon column="description" />
                      </div>
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("is_active")}
                    >
                      <div className="flex items-center">
                        Status
                        <SortIcon column="is_active" />
                      </div>
                    </TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedGasTypes.map((type) => (
                    <TableRow key={type.id}>
                      <TableCell>
                        <div
                          className="w-6 h-6 rounded-full border"
                          style={{ backgroundColor: type.color }}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{type.name}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {type.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={type.is_active ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => handleToggleActive(type)}
                        >
                          {type.is_active ? "Actief" : "Inactief"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(type)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setTypeToDelete(type);
                              setDeleteDialogOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {!loading && gasTypes.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {startIndex + 1}-{Math.min(endIndex, gasTypes.length)} van {gasTypes.length} items
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Vorige
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    Pagina {currentPage} van {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Volgende
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Sluiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Create Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Gastype bewerken" : "Nieuw gastype"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="typeName">
                Naam <span className="text-destructive">*</span>
              </Label>
              <Input
                id="typeName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="bijv. Stikstof"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="typeDescription">Omschrijving</Label>
              <Textarea
                id="typeDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionele omschrijving..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="typeColor">Kleur</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="typeColor"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <Label>Actief</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)} disabled={saving}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Opslaan..." : "Opslaan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Gastype verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{typeToDelete?.name}" wilt verwijderen?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation */}
      <AlertDialog open={bulkDeleteDialogOpen} onOpenChange={setBulkDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Alle gastypes verwijderen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je <strong>alle {gasTypes.length} gastypes</strong> wilt verwijderen?
              Dit kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkDeleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {bulkDeleting ? "Verwijderen..." : `Ja, verwijder alles (${gasTypes.length})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
