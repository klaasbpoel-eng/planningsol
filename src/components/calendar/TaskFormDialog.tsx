import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarIcon, Loader2, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface TaskType {
  id: string;
  name: string;
  color: string;
  description: string | null;
  is_active: boolean;
}

export interface TaskToEdit {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  due_date: string;
  priority: string;
  type_id: string | null;
}

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Profile[];
  onTaskCreated: () => void;
  taskToEdit?: TaskToEdit | null;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  employees,
  onTaskCreated,
  taskToEdit,
}: TaskFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [typeId, setTypeId] = useState<string>("");
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const isEditMode = !!taskToEdit;

  useEffect(() => {
    fetchTaskTypes();
  }, []);

  useEffect(() => {
    if (open) {
      if (taskToEdit) {
        // Edit mode: populate form with existing data
        setTitle(taskToEdit.title);
        setDescription(taskToEdit.description || "");
        setAssignedTo(taskToEdit.assigned_to);
        setDueDate(parseISO(taskToEdit.due_date));
        setPriority(taskToEdit.priority as "low" | "medium" | "high");
        setTypeId(taskToEdit.type_id || "");
      } else {
        // Create mode: reset form
        setTitle("");
        setDescription("");
        setAssignedTo("");
        setDueDate(undefined);
        setPriority("medium");
        setTypeId(taskTypes.length > 0 ? taskTypes[0].id : "");
      }
    }
  }, [open, taskToEdit, taskTypes]);

  const fetchTaskTypes = async () => {
    try {
      const { data, error } = await supabase
        .from("task_types")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (error) throw error;
      setTaskTypes(data || []);
      if (data && data.length > 0 && !taskToEdit) {
        setTypeId(data[0].id);
      }
    } catch (error) {
      console.error("Error fetching task types:", error);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error("Titel is verplicht");
      return;
    }
    if (!assignedTo) {
      toast.error("Selecteer een medewerker");
      return;
    }
    if (!dueDate) {
      toast.error("Selecteer een datum");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niet ingelogd");

      if (isEditMode) {
        // Update existing task
        const { error } = await supabase
          .from("tasks")
          .update({
            title: title.trim(),
            description: description.trim() || null,
            assigned_to: assignedTo,
            due_date: format(dueDate, "yyyy-MM-dd"),
            priority,
            type_id: typeId || null,
          })
          .eq("id", taskToEdit.id);

        if (error) throw error;
        toast.success("Taak succesvol bijgewerkt");
      } else {
        // Create new task
        const { error } = await supabase.from("tasks").insert({
          title: title.trim(),
          description: description.trim() || null,
          assigned_to: assignedTo,
          due_date: format(dueDate, "yyyy-MM-dd"),
          priority,
          type_id: typeId || null,
          created_by: user.id,
        });

        if (error) throw error;
        toast.success("Taak succesvol toegevoegd");
      }

      onOpenChange(false);
      onTaskCreated();
    } catch (error) {
      console.error("Error saving task:", error);
      toast.error(isEditMode ? "Fout bij het bijwerken van de taak" : "Fout bij het toevoegen van de taak");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!taskToEdit) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskToEdit.id);

      if (error) throw error;
      toast.success("Taak succesvol verwijderd");
      setDeleteDialogOpen(false);
      onOpenChange(false);
      onTaskCreated();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Fout bij het verwijderen van de taak");
    } finally {
      setDeleting(false);
    }
  };

  const priorityOptions = [
    { value: "low", label: "Laag", color: "text-muted-foreground" },
    { value: "medium", label: "Medium", color: "text-warning" },
    { value: "high", label: "Hoog", color: "text-destructive" },
  ];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Taak bewerken" : "Nieuwe taak toevoegen"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode ? "Bewerk de details van de taak" : "Voeg een taak toe voor een medewerker"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Titel van de taak"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Beschrijving</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optionele beschrijving"
                rows={3}
              />
            </div>

            <div className="grid gap-2">
              <Label>Medewerker *</Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer medewerker" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.user_id} value={emp.user_id || ""}>
                      {emp.full_name || emp.email?.split("@")[0] || "Onbekend"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {taskTypes.length > 0 && (
              <div className="grid gap-2">
                <Label>Type</Label>
                <Select value={typeId} onValueChange={setTypeId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecteer type" />
                  </SelectTrigger>
                  <SelectContent>
                    {taskTypes.map((type) => (
                      <SelectItem key={type.id} value={type.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded"
                            style={{ backgroundColor: type.color }}
                          />
                          {type.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-2">
              <Label>Datum *</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dueDate ? format(dueDate, "PPP", { locale: nl }) : "Selecteer datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    locale={nl}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label>Prioriteit</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as "low" | "medium" | "high")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorityOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <span className={opt.color}>{opt.label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isEditMode && (
              <Button
                variant="destructive"
                onClick={() => setDeleteDialogOpen(true)}
                className="sm:mr-auto"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Verwijderen
              </Button>
            )}
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Annuleren
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? "Opslaan" : "Toevoegen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taak verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze taak wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
