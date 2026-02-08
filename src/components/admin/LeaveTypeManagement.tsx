import { useState, useEffect } from "react";
import { api } from "@/lib/api";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Palmtree, Loader2 } from "lucide-react";
// import type { Database } from "@/integrations/supabase/types";

// type TimeOffType = Database["public"]["Tables"]["time_off_types"]["Row"];
interface TimeOffType {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  created_at?: string;
}

interface LeaveTypeFormData {
  name: string;
  description: string;
  color: string;
  is_active: boolean;
}

const initialFormData: LeaveTypeFormData = {
  name: "",
  description: "",
  color: "#3b82f6",
  is_active: true,
};

export function LeaveTypeManagement() {
  const [leaveTypes, setLeaveTypes] = useState<TimeOffType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<TimeOffType | null>(null);
  const [deletingType, setDeletingType] = useState<TimeOffType | null>(null);
  const [formData, setFormData] = useState<LeaveTypeFormData>(initialFormData);
  const [saving, setSaving] = useState(false);

  const fetchLeaveTypes = async () => {
    try {
      const data = await api.timeOffTypes.getAll();
      setLeaveTypes(data || []);
    } catch (error) {
      console.error("Error fetching leave types:", error);
      toast.error("Fout bij ophalen verloftypes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const openCreateDialog = () => {
    setEditingType(null);
    setFormData(initialFormData);
    setDialogOpen(true);
  };

  const openEditDialog = (type: TimeOffType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      description: type.description || "",
      color: type.color,
      is_active: type.is_active,
    });
    setDialogOpen(true);
  };

  const openDeleteDialog = (type: TimeOffType) => {
    setDeletingType(type);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }

    setSaving(true);

    try {
      if (editingType) {
        await api.timeOffTypes.update(editingType.id, {
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          color: formData.color,
          is_active: formData.is_active,
        });
        toast.success("Verloftype bijgewerkt");
      } else {
        await api.timeOffTypes.create({
          name: formData.name.trim(),
          description: formData.description.trim() || null,
          color: formData.color,
          is_active: formData.is_active,
        });
        toast.success("Verloftype aangemaakt");
      }

      setDialogOpen(false);
      fetchLeaveTypes();
    } catch (error) {
      console.error("Error saving leave type:", error);
      toast.error("Fout bij opslaan verloftype");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingType) return;

    setSaving(true);

    try {
      await api.timeOffTypes.delete(deletingType.id);
      toast.success("Verloftype verwijderd");
      setDeleteDialogOpen(false);
      fetchLeaveTypes();
    } catch (error) {
      console.error("Error deleting leave type:", error);
      toast.error("Fout bij verwijderen verloftype");
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
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Palmtree className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <CardTitle>Verloftypes</CardTitle>
              <CardDescription>
                Beheer de types verlof die medewerkers kunnen aanvragen
              </CardDescription>
            </div>
          </div>
          <Button onClick={openCreateDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Verloftype
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {leaveTypes.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">
            Nog geen verloftypes aangemaakt
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Naam</TableHead>
                <TableHead>Beschrijving</TableHead>
                <TableHead>Kleur</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaveTypes.map((type) => (
                <TableRow key={type.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: type.color }}
                      />
                      <span className="font-medium">{type.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {type.description || "-"}
                  </TableCell>
                  <TableCell>
                    <code className="text-xs bg-muted px-2 py-1 rounded">
                      {type.color}
                    </code>
                  </TableCell>
                  <TableCell>
                    <Badge variant={type.is_active ? "default" : "secondary"}>
                      {type.is_active ? "Actief" : "Inactief"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
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
                      onClick={() => openDeleteDialog(type)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingType ? "Verloftype bewerken" : "Nieuw verloftype"}
            </DialogTitle>
            <DialogDescription>
              Configureer de eigenschappen van dit verloftype
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
                placeholder="Bijv. Vakantie, Ziekte, Ouderschapsverlof"
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
                  placeholder="#3b82f6"
                  className="flex-1"
                />
              </div>
            </div>

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
              {editingType ? "Opslaan" : "Aanmaken"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verloftype verwijderen</DialogTitle>
            <DialogDescription>
              Weet je zeker dat je "{deletingType?.name}" wilt verwijderen?
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
