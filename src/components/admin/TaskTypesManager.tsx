import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, ClipboardList } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TaskType {
  id: string;
  name: string;
  color: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function TaskTypesManager() {
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState("");
  const [color, setColor] = useState("#06b6d4");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    fetchTaskTypes();
  }, []);

  const fetchTaskTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("task_types")
        .select("*")
        .order("name", { ascending: true });

      if (error) throw error;
      setTaskTypes(data || []);
    } catch (error) {
      console.error("Error fetching task types:", error);
      toast.error("Fout bij het ophalen van taaktypes");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setName("");
    setColor("#06b6d4");
    setDescription("");
    setIsActive(true);
    setSelectedType(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (type: TaskType) => {
    setSelectedType(type);
    setName(type.name);
    setColor(type.color);
    setDescription(type.description || "");
    setIsActive(type.is_active);
    setDialogOpen(true);
  };

  const openDeleteDialog = (type: TaskType) => {
    setSelectedType(type);
    setDeleteDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Naam is verplicht");
      return;
    }

    setSaving(true);
    try {
      if (selectedType) {
        // Update existing
        const { error } = await supabase
          .from("task_types")
          .update({
            name: name.trim(),
            color,
            description: description.trim() || null,
            is_active: isActive,
          })
          .eq("id", selectedType.id);

        if (error) throw error;
        toast.success("Taaktype bijgewerkt");
      } else {
        // Create new
        const { error } = await supabase
          .from("task_types")
          .insert({
            name: name.trim(),
            color,
            description: description.trim() || null,
            is_active: isActive,
          });

        if (error) throw error;
        toast.success("Taaktype toegevoegd");
      }

      setDialogOpen(false);
      resetForm();
      fetchTaskTypes();
    } catch (error) {
      console.error("Error saving task type:", error);
      toast.error("Fout bij het opslaan van taaktype");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedType) return;

    try {
      const { error } = await supabase
        .from("task_types")
        .delete()
        .eq("id", selectedType.id);

      if (error) throw error;
      toast.success("Taaktype verwijderd");
      setDeleteDialogOpen(false);
      setSelectedType(null);
      fetchTaskTypes();
    } catch (error) {
      console.error("Error deleting task type:", error);
      toast.error("Fout bij het verwijderen van taaktype");
    }
  };

  const colorPresets = [
    "#06b6d4", "#8b5cf6", "#ef4444", "#22c55e", 
    "#f59e0b", "#ec4899", "#6366f1", "#14b8a6"
  ];

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5" />
              Taaktypes beheren
            </CardTitle>
            <CardDescription>
              Beheer de verschillende types taken die kunnen worden toegewezen
            </CardDescription>
          </div>
          <Button onClick={openCreateDialog} size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            Nieuw type
          </Button>
        </CardHeader>
        <CardContent>
          {taskTypes.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Geen taaktypes gevonden. Maak er een aan.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kleur</TableHead>
                  <TableHead>Naam</TableHead>
                  <TableHead>Beschrijving</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Acties</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell>
                      <div
                        className="w-6 h-6 rounded-md shadow-sm"
                        style={{ backgroundColor: type.color }}
                      />
                    </TableCell>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {type.description || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={type.is_active ? "default" : "secondary"}>
                        {type.is_active ? "Actief" : "Inactief"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
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
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {selectedType ? "Taaktype bewerken" : "Nieuw taaktype"}
            </DialogTitle>
            <DialogDescription>
              {selectedType
                ? "Bewerk de eigenschappen van dit taaktype"
                : "Maak een nieuw taaktype aan"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Naam *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Bijv. Vergadering"
              />
            </div>

            <div className="grid gap-2">
              <Label>Kleur</Label>
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  {colorPresets.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className={`w-7 h-7 rounded-md transition-all ${
                        color === preset
                          ? "ring-2 ring-primary ring-offset-2"
                          : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: preset }}
                      onClick={() => setColor(preset)}
                    />
                  ))}
                </div>
                <Input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-12 h-8 p-1 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Beschrijving</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionele beschrijving"
                rows={2}
              />
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="is_active">Actief</Label>
              <Switch
                id="is_active"
                checked={isActive}
                onCheckedChange={setIsActive}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {selectedType ? "Opslaan" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taaktype verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je "{selectedType?.name}" wilt verwijderen? Dit
              kan niet ongedaan worden gemaakt.
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
