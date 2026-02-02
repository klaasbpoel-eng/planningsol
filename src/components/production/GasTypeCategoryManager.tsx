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
import { FolderOpen, Plus, Pencil, Trash2, Save, GripVertical, ChevronLeft, ChevronRight } from "lucide-react";
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

interface GasTypeCategory {
  id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

interface GasTypeCategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GasTypeCategoryManager({ open, onOpenChange }: GasTypeCategoryManagerProps) {
  const [categories, setCategories] = useState<GasTypeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<GasTypeCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<GasTypeCategory | null>(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from("gas_type_categories")
      .select("*")
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Error fetching categories:", error);
    } else {
      setCategories(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      setCurrentPage(1);
      fetchCategories();
    }
  }, [open]);

  // Pagination calculations
  const totalPages = Math.ceil(categories.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedCategories = categories.slice(startIndex, endIndex);

  const openEditDialog = (category: GasTypeCategory | null) => {
    if (category) {
      setName(category.name);
      setDescription(category.description || "");
      setIsActive(category.is_active);
    } else {
      setName("");
      setDescription("");
      setIsActive(true);
    }
    setEditingCategory(category);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Voer een naam in");
      return;
    }

    setSaving(true);
    const categoryData = {
      name: name.trim(),
      description: description.trim() || null,
      is_active: isActive,
      sort_order: editingCategory ? editingCategory.sort_order : categories.length,
    };

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("gas_type_categories")
          .update(categoryData)
          .eq("id", editingCategory.id);
        if (error) throw error;
        toast.success("Categorie bijgewerkt");
      } else {
        const { error } = await supabase
          .from("gas_type_categories")
          .insert(categoryData);
        if (error) throw error;
        toast.success("Categorie toegevoegd");
      }
      fetchCategories();
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error saving category:", error);
      toast.error("Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!categoryToDelete) return;

    const { error } = await supabase
      .from("gas_type_categories")
      .delete()
      .eq("id", categoryToDelete.id);

    if (error) {
      console.error("Error deleting category:", error);
      toast.error("Fout bij verwijderen");
    } else {
      toast.success("Categorie verwijderd");
      fetchCategories();
    }
    setDeleteDialogOpen(false);
    setCategoryToDelete(null);
  };

  const handleToggleActive = async (category: GasTypeCategory) => {
    const { error } = await supabase
      .from("gas_type_categories")
      .update({ is_active: !category.is_active })
      .eq("id", category.id);

    if (error) {
      toast.error("Fout bij bijwerken");
    } else {
      fetchCategories();
    }
  };

  const handleMoveUp = async (index: number) => {
    if (index <= 0) return;
    const newCategories = [...categories];
    const temp = newCategories[index - 1];
    newCategories[index - 1] = newCategories[index];
    newCategories[index] = temp;

    // Update sort orders
    const updates = newCategories.map((cat, i) => ({
      id: cat.id,
      sort_order: i,
    }));

    for (const update of updates) {
      await supabase
        .from("gas_type_categories")
        .update({ sort_order: update.sort_order })
        .eq("id", update.id);
    }
    fetchCategories();
  };

  const handleMoveDown = async (index: number) => {
    if (index >= categories.length - 1) return;
    const newCategories = [...categories];
    const temp = newCategories[index + 1];
    newCategories[index + 1] = newCategories[index];
    newCategories[index] = temp;

    // Update sort orders
    const updates = newCategories.map((cat, i) => ({
      id: cat.id,
      sort_order: i,
    }));

    for (const update of updates) {
      await supabase
        .from("gas_type_categories")
        .update({ sort_order: update.sort_order })
        .eq("id", update.id);
    }
    fetchCategories();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-[550px]"
          onInteractOutside={(e) => {
            if (deleteDialogOpen || editDialogOpen) {
              e.preventDefault();
            }
          }}
        >
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <FolderOpen className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Gastype categorieën beheren</DialogTitle>
                <DialogDescription>
                  Groepeer gastypes in categorieën voor overzichtelijke filters
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => openEditDialog(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe categorie
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : categories.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Geen categorieën gevonden
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>Naam</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCategories.map((category, index) => {
                    const actualIndex = startIndex + index;
                    return (
                      <TableRow key={category.id}>
                        <TableCell>
                          <div className="flex flex-col gap-0.5">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-5 w-5"
                              onClick={() => handleMoveUp(actualIndex)}
                              disabled={actualIndex === 0}
                            >
                              <GripVertical className="h-3 w-3 rotate-90" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{category.name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {category.description || "-"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={category.is_active ? "default" : "secondary"}
                            className="cursor-pointer"
                            onClick={() => handleToggleActive(category)}
                          >
                            {category.is_active ? "Actief" : "Inactief"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(category)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setCategoryToDelete(category);
                                setDeleteDialogOpen(true);
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}

            {/* Pagination */}
            {!loading && categories.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {startIndex + 1}-{Math.min(endIndex, categories.length)} van {categories.length} items
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
              {editingCategory ? "Categorie bewerken" : "Nieuwe categorie"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="categoryName">
                Naam <span className="text-destructive">*</span>
              </Label>
              <Input
                id="categoryName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="bijv. Industriële gassen"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="categoryDescription">Omschrijving</Label>
              <Textarea
                id="categoryDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionele omschrijving..."
                rows={2}
              />
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
            <AlertDialogTitle>Categorie verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je de categorie "{categoryToDelete?.name}" wilt verwijderen?
              Gastypes in deze categorie worden niet verwijderd, maar verliezen hun categorietoewijzing.
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
    </>
  );
}
