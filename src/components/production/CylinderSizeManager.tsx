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
import { Cylinder, Plus, Pencil, Trash2, Save } from "lucide-react";
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

interface CylinderSize {
  id: string;
  name: string;
  capacity_liters: number | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
}

interface CylinderSizeManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CylinderSizeManager({ open, onOpenChange }: CylinderSizeManagerProps) {
  const [cylinderSizes, setCylinderSizes] = useState<CylinderSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<CylinderSize | null>(null);
  const [sizeToDelete, setSizeToDelete] = useState<CylinderSize | null>(null);
  
  // Form state
  const [name, setName] = useState("");
  const [capacityLiters, setCapacityLiters] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchCylinderSizes = async () => {
    const { data, error } = await supabase
      .from("cylinder_sizes")
      .select("*")
      .order("capacity_liters", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error fetching cylinder sizes:", error);
    } else {
      setCylinderSizes(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (open) {
      fetchCylinderSizes();
    }
  }, [open]);

  const openEditDialog = (size: CylinderSize | null) => {
    if (size) {
      setName(size.name);
      setCapacityLiters(size.capacity_liters?.toString() || "");
      setDescription(size.description || "");
      setIsActive(size.is_active);
    } else {
      setName("");
      setCapacityLiters("");
      setDescription("");
      setIsActive(true);
    }
    setEditingSize(size);
    setEditDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Voer een naam in");
      return;
    }

    setSaving(true);
    const sizeData = {
      name: name.trim(),
      capacity_liters: capacityLiters ? parseFloat(capacityLiters) : null,
      description: description.trim() || null,
      is_active: isActive,
      sort_order: editingSize ? editingSize.sort_order : cylinderSizes.length,
    };

    try {
      if (editingSize) {
        const { error } = await supabase
          .from("cylinder_sizes")
          .update(sizeData)
          .eq("id", editingSize.id);
        if (error) throw error;
        toast.success("Cilinderinhoud bijgewerkt");
      } else {
        const { error } = await supabase
          .from("cylinder_sizes")
          .insert(sizeData);
        if (error) throw error;
        toast.success("Cilinderinhoud toegevoegd");
      }
      fetchCylinderSizes();
      setEditDialogOpen(false);
    } catch (error) {
      console.error("Error saving cylinder size:", error);
      toast.error("Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!sizeToDelete) return;

    const { error } = await supabase
      .from("cylinder_sizes")
      .delete()
      .eq("id", sizeToDelete.id);

    if (error) {
      console.error("Error deleting cylinder size:", error);
      toast.error("Fout bij verwijderen");
    } else {
      toast.success("Cilinderinhoud verwijderd");
      fetchCylinderSizes();
    }
    setDeleteDialogOpen(false);
    setSizeToDelete(null);
  };

  const handleToggleActive = async (size: CylinderSize) => {
    const { error } = await supabase
      .from("cylinder_sizes")
      .update({ is_active: !size.is_active })
      .eq("id", size.id);

    if (error) {
      toast.error("Fout bij bijwerken");
    } else {
      fetchCylinderSizes();
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Cylinder className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <DialogTitle>Cilinderinhouden beheren</DialogTitle>
                <DialogDescription>
                  Beheer de beschikbare cilindergroottes
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="py-4">
            <div className="flex justify-end mb-4">
              <Button size="sm" onClick={() => openEditDialog(null)}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe cilinderinhoud
              </Button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : cylinderSizes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Geen cilinderinhouden gevonden
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naam</TableHead>
                    <TableHead>Inhoud (L)</TableHead>
                    <TableHead>Omschrijving</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Acties</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cylinderSizes.map((size) => (
                    <TableRow key={size.id}>
                      <TableCell className="font-medium">{size.name}</TableCell>
                      <TableCell>
                        {size.capacity_liters ? `${size.capacity_liters} L` : "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {size.description || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={size.is_active ? "default" : "secondary"}
                          className="cursor-pointer"
                          onClick={() => handleToggleActive(size)}
                        >
                          {size.is_active ? "Actief" : "Inactief"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => openEditDialog(size)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setSizeToDelete(size);
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
              {editingSize ? "Cilinderinhoud bewerken" : "Nieuwe cilinderinhoud"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sizeName">
                Naam <span className="text-destructive">*</span>
              </Label>
              <Input
                id="sizeName"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="bijv. Groot"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sizeCapacity">Inhoud (liters)</Label>
              <Input
                id="sizeCapacity"
                type="number"
                min="0"
                step="0.1"
                value={capacityLiters}
                onChange={(e) => setCapacityLiters(e.target.value)}
                placeholder="bijv. 50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="sizeDescription">Omschrijving</Label>
              <Textarea
                id="sizeDescription"
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
            <AlertDialogTitle>Cilinderinhoud verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{sizeToDelete?.name}" wilt verwijderen?
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
