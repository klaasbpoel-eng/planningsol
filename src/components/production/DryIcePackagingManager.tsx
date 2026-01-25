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
import { Box, Plus, Pencil, Trash2, Save } from "lucide-react";
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

interface Packaging {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  capacity_kg: number | null;
}

interface DryIcePackagingManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DryIcePackagingManager({ open, onOpenChange }: DryIcePackagingManagerProps) {
  const [packagingOptions, setPackagingOptions] = useState<Packaging[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingPackaging, setEditingPackaging] = useState<Packaging | null>(null);
  const [packagingToDelete, setPackagingToDelete] = useState<Packaging | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [capacityKg, setCapacityKg] = useState<string>("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchPackaging = async () => {
    const { data, error } = await supabase
      .from("dry_ice_packaging")
      .select("*")
      .order("sort_order");

    if (error) {
      console.error("Error fetching packaging:", error);
    } else {
      setPackagingOptions(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchPackaging();
    }
  }, [open]);

  const openEditDialog = (packaging: Packaging | null) => {
    if (packaging) {
      setName(packaging.name);
      setDescription(packaging.description || "");
      setCapacityKg(packaging.capacity_kg?.toString() || "");
      setIsActive(packaging.is_active);
    } else {
      setName("");
      setDescription("");
      setCapacityKg("");
      setIsActive(true);
    }
    setEditingPackaging(packaging);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Voer een naam in");
      return;
    }

    setSaving(true);
    const packagingData = {
      name: name.trim(),
      description: description.trim() || null,
      capacity_kg: capacityKg ? parseFloat(capacityKg) : null,
      is_active: isActive,
      sort_order: editingPackaging ? editingPackaging.sort_order : packagingOptions.length,
    };

    try {
      if (editingPackaging) {
        const { error } = await supabase
          .from("dry_ice_packaging")
          .update(packagingData)
          .eq("id", editingPackaging.id);
        if (error) throw error;
        toast.success("Verpakking bijgewerkt");
      } else {
        const { error } = await supabase
          .from("dry_ice_packaging")
          .insert(packagingData);
        if (error) throw error;
        toast.success("Verpakking toegevoegd");
      }
      fetchPackaging();
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error saving packaging:", error);
      toast.error("Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!packagingToDelete) return;

    const { error } = await supabase
      .from("dry_ice_packaging")
      .delete()
      .eq("id", packagingToDelete.id);

    if (error) {
      console.error("Error deleting packaging:", error);
      toast.error("Fout bij verwijderen");
    } else {
      toast.success("Verpakking verwijderd");
      fetchPackaging();
    }
    setDeleteDialogOpen(false);
    setPackagingToDelete(null);
  };

  const handleToggleActive = async (packaging: Packaging) => {
    const { error } = await supabase
      .from("dry_ice_packaging")
      .update({ is_active: !packaging.is_active })
      .eq("id", packaging.id);

    if (error) {
      toast.error("Fout bij bijwerken");
    } else {
      fetchPackaging();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Box className="h-5 w-5 text-cyan-500" />
              </div>
              <div>
                <DialogTitle>Verpakkingen beheren</DialogTitle>
                <DialogDescription>
                  Beheer de beschikbare verpakkingsopties voor droogijs
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => openEditDialog(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe verpakking
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : packagingOptions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Geen verpakkingen gevonden
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Inhoud (kg)</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {packagingOptions.map((packaging) => (
                    <TableRow key={packaging.id}>
                      <TableCell className="font-medium">{packaging.name}</TableCell>
                      <TableCell>
                        {packaging.capacity_kg ? `${packaging.capacity_kg} kg` : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm max-w-[150px] truncate">
                        {packaging.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={packaging.is_active ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => handleToggleActive(packaging)}
                        >
                          {packaging.is_active ? "Actief" : "Inactief"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(packaging)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setPackagingToDelete(packaging);
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
              {editingPackaging ? "Verpakking bewerken" : "Nieuwe verpakking"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="packagingName">
                Naam <span className="text-destructive">*</span>
              </Label>
              <Input
                id="packagingName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="bijv. Piepschuim box"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="packagingCapacity">Inhoud (kg)</Label>
              <Input
                id="packagingCapacity"
                type="number"
                min="0"
                step="0.1"
                value={capacityKg}
                onChange={(e) => setCapacityKg(e.target.value)}
                placeholder="bijv. 22"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="packagingDescription">Omschrijving</Label>
              <Textarea
                id="packagingDescription"
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
            <AlertDialogTitle>Verpakking verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{packagingToDelete?.name}" wilt verwijderen?
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
