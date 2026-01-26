import { useState, useEffect, useRef } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FolderTree, Loader2, GripVertical } from "lucide-react";
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
  const [draggedItem, setDraggedItem] = useState<TaskType | null>(null);
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

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

  const mainCategories = categories
    .filter((c) => !c.parent_id)
    .sort((a, b) => a.sort_order - b.sort_order);
  
  const getSubcategories = (parentId: string) =>
    categories
      .filter((c) => c.parent_id === parentId)
      .sort((a, b) => a.sort_order - b.sort_order);

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
        // Get the max sort_order for the parent
        const siblings = formData.parent_id
          ? getSubcategories(formData.parent_id)
          : mainCategories;
        const maxOrder = siblings.length > 0 
          ? Math.max(...siblings.map(s => s.sort_order)) 
          : 0;

        const { error } = await supabase.from("task_types").insert({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          color: formData.color,
          parent_id: formData.parent_id,
          is_active: formData.is_active,
          sort_order: maxOrder + 1,
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

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, category: TaskType) => {
    setDraggedItem(category);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", category.id);
  };

  const handleDragOver = (e: React.DragEvent, categoryId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverItem(categoryId);
  };

  const handleDragLeave = () => {
    setDragOverItem(null);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverItem(null);
  };

  const handleDrop = async (e: React.DragEvent, targetCategory: TaskType) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem.id === targetCategory.id) {
      handleDragEnd();
      return;
    }

    // Only allow reordering within the same parent
    if (draggedItem.parent_id !== targetCategory.parent_id) {
      toast.error("Categorieën kunnen alleen binnen dezelfde groep worden verplaatst");
      handleDragEnd();
      return;
    }

    const siblings = draggedItem.parent_id
      ? getSubcategories(draggedItem.parent_id)
      : mainCategories;

    const draggedIndex = siblings.findIndex(c => c.id === draggedItem.id);
    const targetIndex = siblings.findIndex(c => c.id === targetCategory.id);

    if (draggedIndex === -1 || targetIndex === -1) {
      handleDragEnd();
      return;
    }

    // Reorder the array
    const reordered = [...siblings];
    const [removed] = reordered.splice(draggedIndex, 1);
    reordered.splice(targetIndex, 0, removed);

    // Update sort_order for all affected items
    try {
      const updates = reordered.map((cat, index) => ({
        id: cat.id,
        sort_order: index + 1,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from("task_types")
          .update({ sort_order: update.sort_order })
          .eq("id", update.id);
        
        if (error) throw error;
      }

      toast.success("Volgorde bijgewerkt");
      fetchCategories();
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Fout bij bijwerken volgorde");
    }

    handleDragEnd();
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
                Beheer hoofd- en subcategorieën voor taken. Sleep om te sorteren.
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
              <div 
                key={mainCat.id} 
                className={`border rounded-lg transition-colors ${
                  dragOverItem === mainCat.id ? "border-primary bg-primary/5" : ""
                }`}
              >
                <div 
                  className={`flex items-center justify-between p-4 bg-muted/30 ${
                    draggedItem?.id === mainCat.id ? "opacity-50" : ""
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(e, mainCat)}
                  onDragOver={(e) => handleDragOver(e, mainCat.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, mainCat)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="flex items-center gap-3">
                    <GripVertical className="h-5 w-5 text-muted-foreground cursor-grab active:cursor-grabbing" />
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
                  <div className="divide-y">
                    {getSubcategories(mainCat.id).map((subCat) => (
                      <div
                        key={subCat.id}
                        className={`flex items-center justify-between py-3 px-4 pl-8 transition-colors ${
                          dragOverItem === subCat.id ? "bg-primary/5" : ""
                        } ${draggedItem?.id === subCat.id ? "opacity-50" : ""}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, subCat)}
                        onDragOver={(e) => handleDragOver(e, subCat.id)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, subCat)}
                        onDragEnd={handleDragEnd}
                      >
                        <div className="flex items-center gap-3">
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab active:cursor-grabbing" />
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
                        <div className="flex items-center gap-1">
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
                        </div>
                      </div>
                    ))}
                  </div>
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
