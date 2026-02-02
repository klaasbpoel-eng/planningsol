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
import { Cylinder, Plus, Pencil, Trash2, Save, ArrowUp, ArrowDown, ArrowUpDown, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
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

type SortColumn = "name" | "capacity_liters" | "description" | "is_active";
type SortDirection = "asc" | "desc";

export function CylinderSizeManager({ open, onOpenChange }: CylinderSizeManagerProps) {
  const [cylinderSizes, setCylinderSizes] = useState<CylinderSize[]>([]);
  const [loading, setLoading] = useState(true);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [editingSize, setEditingSize] = useState<CylinderSize | null>(null);
  const [sizeToDelete, setSizeToDelete] = useState<CylinderSize | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  
  // Sort state
  const [sortColumn, setSortColumn] = useState<SortColumn>("capacity_liters");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  
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
      .order(sortColumn, { ascending: sortDirection === "asc", nullsFirst: false });

    if (error) {
      console.error("Error fetching cylinder sizes:", error);
    } else {
      setCylinderSizes(data || []);
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
      fetchCylinderSizes();
    }
  }, [open, sortColumn, sortDirection]);

  // Pagination calculations
  const totalPages = Math.ceil(cylinderSizes.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedSizes = cylinderSizes.slice(startIndex, endIndex);

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

  const handleBulkDelete = async () => {
    if (cylinderSizes.length === 0) return;

    setBulkDeleting(true);
    try {
      const { error } = await supabase
        .from("cylinder_sizes")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;
      
      toast.success(`${cylinderSizes.length} cilinderinhouden verwijderd`);
      fetchCylinderSizes();
      setBulkDeleteDialogOpen(false);
    } catch (error: any) {
      console.error("Error bulk deleting cylinder sizes:", error);
      if (error?.code === "23503") {
        toast.error("Kan niet verwijderen: cilinderinhouden worden nog gebruikt");
      } else {
        toast.error("Fout bij verwijderen van cilinderinhouden");
      }
    } finally {
      setBulkDeleting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-[600px]"
          onInteractOutside={(e) => {
            if (bulkDeleteDialogOpen || deleteDialogOpen || editDialogOpen) {
              e.preventDefault();
            }
          }}
        >
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
            <div className="flex justify-between mb-4">
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
                disabled={cylinderSizes.length === 0}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Alles verwijderen ({cylinderSizes.length})
              </Button>
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
                      onClick={() => handleSort("capacity_liters")}
                    >
                      <div className="flex items-center">
                        Inhoud (L)
                        <SortIcon column="capacity_liters" />
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
                  {paginatedSizes.map((size) => (
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

            {/* Pagination */}
            {!loading && cylinderSizes.length > itemsPerPage && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground">
                  {startIndex + 1}-{Math.min(endIndex, cylinderSizes.length)} van {cylinderSizes.length} items
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
              Alle cilinderinhouden verwijderen?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je <strong>alle {cylinderSizes.length} cilinderinhouden</strong> wilt verwijderen?
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
              {bulkDeleting ? "Verwijderen..." : `Ja, verwijder alles (${cylinderSizes.length})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
