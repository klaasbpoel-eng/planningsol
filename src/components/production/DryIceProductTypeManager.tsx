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
import { Package, Plus, Pencil, Trash2, Save, GripVertical } from "lucide-react";
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

interface ProductType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

interface DryIceProductTypeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DryIceProductTypeManager({ open, onOpenChange }: DryIceProductTypeManagerProps) {
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ProductType | null>(null);
  const [typeToDelete, setTypeToDelete] = useState<ProductType | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProductTypes = async () => {
    try {
      const data = await api.dryIceProductTypes.getAll();
      setProductTypes(data || []);
    } catch (error) {
      console.error("Error fetching product types:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchProductTypes();
    }
  }, [open]);

  const openEditDialog = (type: ProductType | null) => {
    if (type) {
      setName(type.name);
      setDescription(type.description || "");
      setIsActive(type.is_active);
    } else {
      setName("");
      setDescription("");
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
      is_active: isActive,
      sort_order: editingType ? editingType.sort_order : productTypes.length,
    };

    try {
      if (editingType) {
        await api.dryIceProductTypes.update(editingType.id, typeData);
        toast.success("Producttype bijgewerkt");
      } else {
        await api.dryIceProductTypes.create(typeData);
        toast.success("Producttype toegevoegd");
      }
      fetchProductTypes();
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error saving product type:", error);
      toast.error("Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!typeToDelete) return;

    try {
      await api.dryIceProductTypes.delete(typeToDelete.id);
      toast.success("Producttype verwijderd");
      fetchProductTypes();
    } catch (error) {
      console.error("Error deleting product type:", error);
      toast.error("Fout bij verwijderen");
    }
    setDeleteDialogOpen(false);
    setTypeToDelete(null);
  };

  const handleToggleActive = async (type: ProductType) => {
    try {
      await api.dryIceProductTypes.update(type.id, { is_active: !type.is_active });
      fetchProductTypes();
    } catch (error) {
      console.error(error);
      toast.error("Fout bij bijwerken");
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Package className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <DialogTitle>Producttypen beheren</DialogTitle>
                <DialogDescription>
                  Beheer de beschikbare droogijs producttypen
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => openEditDialog(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuw producttype
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : productTypes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Geen producttypen gevonden
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productTypes.map((type) => (
                    <TableRow key={type.id}>
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
              {editingType ? "Producttype bewerken" : "Nieuw producttype"}
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
                placeholder="bijv. Blokken (10kg)"
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
            <AlertDialogTitle>Producttype verwijderen?</AlertDialogTitle>
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
    </>
  );
}
