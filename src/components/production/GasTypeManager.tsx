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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Flame, Plus, Pencil, Trash2, Save, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { api } from "@/lib/api";
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
  category_id: string | null;
}

interface GasTypeCategory {
  id: string;
  name: string;
}

interface GasTypeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type SortColumn = "name" | "description" | "is_active";
type SortDirection = "asc" | "desc";

export function GasTypeManager({ open, onOpenChange }: GasTypeManagerProps) {
  const [gasTypes, setGasTypes] = useState<GasType[]>([]);
  const [categories, setCategories] = useState<GasTypeCategory[]>([]);
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
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      const data = await api.gasTypeCategories.getAll();
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
    }
  };

  const fetchGasTypes = async () => {
    try {
      const data = await api.gasTypes.getAll();
      // Client-side sort because API doesn't support dynamic sort params yet
      if (data) {
        const sorted = [...data].sort((a: any, b: any) => {
          const aVal = a[sortColumn];
          const bVal = b[sortColumn];
          if (aVal === bVal) return 0;
          if (aVal === null) return 1;
          if (bVal === null) return -1;

          const comparison = aVal < bVal ? -1 : 1;
          return sortDirection === "asc" ? comparison : -comparison;
        });
        setGasTypes(sorted);
      } else {
        setGasTypes([]);
      }
    } catch (error) {
      console.error("Error fetching gas types:", error);
    } finally {
      setLoading(false);
    }
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

  const getCategoryName = (id: string | null) => {
    if (!id) return "-";
    const cat = categories.find(c => c.id === id);
    return cat ? cat.name : "-";
  };

  useEffect(() => {
    if (open) {
      setCurrentPage(1);
      fetchGasTypes();
      fetchCategories();
    }
  }, [open, sortColumn, sortDirection]);

  // Filtering calculations
  const filteredGasTypes = gasTypes.filter(type => {
    if (categoryFilter === "all") return true;
    if (categoryFilter === "none") return type.category_id === null;
    return type.category_id === categoryFilter;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredGasTypes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedGasTypes = filteredGasTypes.slice(startIndex, endIndex);

  const openEditDialog = (type: GasType | null) => {
    if (type) {
      setName(type.name);
      setDescription(type.description || "");
      setColor(type.color);
      setIsActive(type.is_active);
      setCategoryId(type.category_id);
    } else {
      setName("");
      setDescription("");
      setColor("#3b82f6");
      setIsActive(true);
      setCategoryId(null);
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
      category_id: categoryId,
    };

    try {
      if (editingType) {
        await api.gasTypes.update(editingType.id, typeData);
        toast.success("Gastype bijgewerkt");
      } else {
        await api.gasTypes.create(typeData);
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

    try {
      await api.gasTypes.delete(typeToDelete.id);
      toast.success("Gastype verwijderd");
      fetchGasTypes();
    } catch (error) {
      console.error("Error deleting gas type:", error);
      toast.error("Fout bij verwijderen");
    }
    setDeleteDialogOpen(false);
    setTypeToDelete(null);
  };

  const handleToggleActive = async (type: GasType) => {
    try {
      await api.gasTypes.update(type.id, { is_active: !type.is_active });
      fetchGasTypes();
    } catch (error) {
      console.error(error);
      toast.error("Fout bij bijwerken");
    }
  };

  const handleBulkDelete = async () => {
    if (gasTypes.length === 0) return;

    setBulkDeleting(true);
    try {
      // NOTE: Clearing references directly is not yet supported in API for MySQL.
      // We rely on simple deletion for now. 
      // Ideally we should add a method to API to clear references or handle CASCADE in DB.

      const promises = gasTypes
        .filter(t => t.id !== "00000000-0000-0000-0000-000000000000") // Skip unassigned/sys types if any
        .map(t => api.gasTypes.delete(t.id));

      await Promise.all(promises);

      toast.success(`${gasTypes.length} gastypes verwijderd`);
      fetchGasTypes();
      setBulkDeleteDialogOpen(false);
    } catch (error: any) {
      console.error("Error bulk deleting gas types:", error);
      toast.error("Fout bij verwijderen van gastypes. Mogelijk zijn ze in gebruik.");
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className="sm:max-w-[1000px]"
          onInteractOutside={(e) => {
            if (bulkDeleteDialogOpen || deleteDialogOpen || editDialogOpen) {
              e.preventDefault();
            }
          }}
        >
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
            <div className="flex flex-col sm:flex-row justify-between mb-4 gap-4">
              <div className="flex items-center gap-2">
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Filter op categorie" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle categorieën</SelectItem>
                    <SelectItem value="none">Geen categorie</SelectItem>
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="destructive"
                  size="sm"
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenChange(false); // Close main dialog first
                    setTimeout(() => setBulkDeleteDialogOpen(true), 100); // Then open confirm dialog
                  }}
                  disabled={gasTypes.length === 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Alles verwijderen
                </Button>
              </div>

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
                    <TableHead>Categorie</TableHead>
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
                      <TableCell className="text-sm">
                        {getCategoryName(type.category_id)}
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
            <div className="space-y-2">
              <Label htmlFor="typeCategory">Categorie</Label>
              <Select
                value={categoryId || "none"}
                onValueChange={(v) => setCategoryId(v === "none" ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer categorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen categorie</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
      <AlertDialog
        open={bulkDeleteDialogOpen}
        onOpenChange={(isOpen) => {
          setBulkDeleteDialogOpen(isOpen);
          if (!isOpen) {
            // Reopen main dialog when alert is closed
            onOpenChange(true);
          }
        }}
      >
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
