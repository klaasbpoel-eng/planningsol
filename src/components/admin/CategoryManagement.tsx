import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FolderTree, Loader2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TaskType = Database["public"]["Tables"]["task_types"]["Row"];

interface CategoryFormData {
  name: string;
  description: string;
  color: string;
  parent_id: string | null;
  is_active: boolean;
}

const initialFormData: CategoryFormData = {
  name: "",
  description: "",
  color: "#06b6d4",
  parent_id: null,
  is_active: true,
};

export function CategoryManagement() {
  const [categories, setCategories] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TaskType | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<TaskType | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from("task_types")
        .select("*")
        .order("name");

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error("Error fetching categories:", error);
      toast.error("Fout bij ophalen categorieën");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const mainCategories = categories.filter((c) => !c.parent_id);
  const getSubcategories = (parentId: string) =>
    categories.filter((c) => c.parent_id === parentId);

  const openCreateDialog = (parentId: string | null = null) => {
    setEditingCategory(null);
    setFormData({ ...initialFormData, parent_id: parentId });
    setDialogOpen(true);
  };

  const openEditDialog = (category: TaskType) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      description: category.description || "",
      color: category.color,
      parent_id: category.parent_id || null,
      is_active: category.is_active,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (category: TaskType) => {
    setDeletingCategory(category);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }

    setSaving(true);

    try {
      if (editingCategory) {
        const { error } = await supabase
          .from("task_types")
          .update({
            name: formData.name.trim(),
            description: formData.description.trim() || null,
            color: formData.color,
            parent_id: formData.parent_id,
            is_active: formData.is_active,
          })
          .eq("id", editingCategory.id);

        if (error) throw error;
        toast.success("Categorie bijgewerkt");
      } else {
        const { error } = await supabase.from("task_types").insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          color: formData.color,
          parent_id: formData.parent_id,
          is_active: formData.is_active,
        });

        if (error) throw error;
        toast.success("Categorie aangemaakt");
      }

      setDialogOpen(false);
      fetchCategories();
    } catch (error) {
      console.error("Error saving category:", error);
      toast.error("Fout bij opslaan categorie");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;

    setSaving(true);

    try {
      // Check if category has subcategories
      const subcategories = getSubcategories(deletingCategory.id);
      if (subcategories.length > 0) {
        toast.error("Verwijder eerst alle subcategorieën");
        setDeleteDialogOpen(false);
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("task_types")
        .delete()
        .eq("id", deletingCategory.id);

      if (error) throw error;
      toast.success("Categorie verwijderd");
      setDeleteDialogOpen(false);
      fetchCategories();
    } catch (error) {
      console.error("Error deleting category:", error);
      toast.error("Fout bij verwijderen categorie");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <FolderTree className="h-5 w-5 text-cyan-500" />
            </div>
            <div>
              <CardTitle>Taakcategorieën</CardTitle>
              <CardDescription>
                Beheer hoofd- en subcategorieën voor taken
              </CardDescription>
            </div>
          </div>
          <Button onClick={() => openCreateDialog(null)}>
            <Plus className="h-4 w-4 mr-2" />
            Hoofdcategorie
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {mainCategories.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nog geen categorieën aangemaakt
          </p>
        ) : (
          <div className="space-y-4">
            {mainCategories.map((mainCat) => (
              <div key={mainCat.id} className="border rounded-lg">
                <div className="flex items-center justify-between p-4 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: mainCat.color }}
                    />
                    <span className="font-medium">{mainCat.name}</span>
                    {!mainCat.is_active && (
                      <Badge variant="secondary">Inactief</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openCreateDialog(mainCat.id)}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Subcategorie
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(mainCat)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openDeleteDialog(mainCat)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                {getSubcategories(mainCat.id).length > 0 && (
                  <Table>
                    <TableBody>
                      {getSubcategories(mainCat.id).map((subCat) => (
                        <TableRow key={subCat.id}>
                          <TableCell className="pl-8">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: subCat.color }}
                              />
                              <span>{subCat.name}</span>
                              {!subCat.is_active && (
                                <Badge variant="secondary" className="text-xs">
                                  Inactief
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(subCat)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openDeleteDialog(subCat)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCategory ? "Categorie bewerken" : "Nieuwe categorie"}
            </DialogTitle>
            <DialogDescription>
              {formData.parent_id
                ? "Maak een subcategorie aan"
                : "Maak een hoofdcategorie aan"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Naam *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Categorienaam"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschrijving</Label>
              <Input
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optionele beschrijving"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">Kleur</Label>
              <div className="flex gap-2">
                <Input
                  id="color"
                  type="color"
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  className="w-16 h-10 p-1 cursor-pointer"
                />
                <Input
                  value={formData.color}
                  onChange={(e) =>
                    setFormData({ ...formData, color: e.target.value })
                  }
                  placeholder="#06b6d4"
                  className="flex-1"
                />
              </div>
            </div>

            {!formData.parent_id && !editingCategory?.parent_id && (
              <div className="space-y-2">
                <Label>Hoofdcategorie</Label>
                <Select
                  value={formData.parent_id || "none"}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      parent_id: value === "none" ? null : value,
                    })
                  }
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Geen (hoofdcategorie)" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="none">Geen (hoofdcategorie)</SelectItem>
                    {mainCategories
                      .filter((c) => c.id !== editingCategory?.id)
                      .map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Actief</Label>
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingCategory ? "Opslaan" : "Aanmaken"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categorie verwijderen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je "{deletingCategory?.name}" wilt verwijderen?
              Dit kan niet ongedaan worden gemaakt.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialogOpen(false)}
              disabled={saving}
            >
              Annuleren
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={saving}
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Verwijderen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
