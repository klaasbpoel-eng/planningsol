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
import { CalendarIcon, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskType = Database["public"]["Tables"]["task_types"]["Row"] & {
  parent_id?: string | null;
};
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface TaskFormDialogProps {
  task: Task | null;
  employees: Profile[];
  taskTypes: TaskType[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  mode: "create" | "edit";
}

const initialFormData = {
  due_date: undefined as Date | undefined,
  priority: "medium" as string,
  status: "pending" as string,
  assigned_to: "",
  type_id: null as string | null,
  main_category_id: null as string | null,
  start_time: "" as string,
  end_time: "" as string,
};

export function TaskFormDialog({
  task,
  employees,
  taskTypes,
  open,
  onOpenChange,
  onUpdate,
  mode,
}: TaskFormDialogProps) {
  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);

  // Separate main categories (no parent) and subcategories (have parent)
  const mainCategories = taskTypes.filter((t) => !t.parent_id);
  const getSubcategories = (parentId: string) =>
    taskTypes.filter((t) => t.parent_id === parentId);

  useEffect(() => {
    if (open) {
      if (mode === "create") {
        setFormData(initialFormData);
      } else if (task) {
        // Find the parent category if the task has a subcategory
        const taskType = taskTypes.find((t) => t.id === task.type_id);
        const mainCategoryId = taskType?.parent_id || (taskType && !taskType.parent_id ? task.type_id : null);
        const subCategoryId = taskType?.parent_id ? task.type_id : null;
        
        setFormData({
          due_date: task.due_date ? new Date(task.due_date) : undefined,
          priority: task.priority,
          status: task.status,
          assigned_to: task.assigned_to,
          type_id: subCategoryId,
          main_category_id: mainCategoryId,
          start_time: (task as any).start_time || "",
          end_time: (task as any).end_time || "",
        });
      }
    }
  }, [open, task, mode, taskTypes]);

  const handleSave = async () => {
    // Validation
    if (!formData.assigned_to) {
      toast.error("Selecteer een medewerker");
      return;
    }
    if (!formData.due_date) {
      toast.error("Selecteer een deadline");
      return;
    }

    // Validate that end time is after start time (if both are provided)
    if (formData.start_time && formData.end_time) {
      if (formData.end_time <= formData.start_time) {
        toast.error("Eindtijd moet na starttijd liggen");
        return;
      }
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Je bent niet ingelogd");
        return;
      }

      // Use subcategory if selected, otherwise use main category
      const finalTypeId = formData.type_id || formData.main_category_id;

      const taskData = {
        due_date: format(formData.due_date, "yyyy-MM-dd"),
        priority: formData.priority,
        status: formData.status,
        assigned_to: formData.assigned_to,
        type_id: finalTypeId,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
      };

      if (mode === "create") {
        const { error } = await supabase.from("tasks").insert({
          ...taskData,
          created_by: user.id,
        });

        if (error) throw error;
        toast.success("Taak aangemaakt");
      } else if (task) {
        const { error } = await supabase
          .from("tasks")
          .update(taskData)
          .eq("id", task.id);

        if (error) throw error;
        toast.success("Taak bijgewerkt");
      }

      onUpdate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving task:", error);
      toast.error("Er is een fout opgetreden");
    } finally {
      setLoading(false);
    }
  };

  const priorities = [
    { value: "low", label: "Laag" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "Hoog" },
  ];

  const statuses = [
    { value: "pending", label: "In afwachting" },
    { value: "in_progress", label: "In uitvoering" },
    { value: "completed", label: "Voltooid" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Nieuwe Taak" : "Taak Bewerken"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Maak een nieuwe taak aan en wijs deze toe aan een medewerker."
              : "Bewerk de taakgegevens."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">

          {/* Assigned To */}
          <div className="grid gap-2">
            <Label>Toewijzen aan *</Label>
            <Select
              value={formData.assigned_to}
              onValueChange={(value) =>
                setFormData({ ...formData, assigned_to: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecteer medewerker" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.user_id || employee.id} value={employee.user_id || employee.id}>
                    {employee.full_name || employee.email || "Onbekend"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Main Category */}
          {mainCategories.length > 0 && (
            <div className="grid gap-2">
              <Label>Hoofdcategorie</Label>
              <Select
                value={formData.main_category_id || "none"}
                onValueChange={(value) =>
                  setFormData({ 
                    ...formData, 
                    main_category_id: value === "none" ? null : value,
                    type_id: null // Reset subcategory when main category changes
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer hoofdcategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen categorie</SelectItem>
                  {mainCategories.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
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

          {/* Subcategory - only show if main category is selected */}
          {formData.main_category_id && getSubcategories(formData.main_category_id).length > 0 && (
            <div className="grid gap-2">
              <Label>Subcategorie</Label>
              <Select
                value={formData.type_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, type_id: value === "none" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecteer subcategorie" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Geen subcategorie</SelectItem>
                  {getSubcategories(formData.main_category_id).map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
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

          {/* Due Date */}
          <div className="grid gap-2">
            <Label>Deadline *</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "justify-start text-left font-normal",
                    !formData.due_date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.due_date
                    ? format(formData.due_date, "d MMMM yyyy", { locale: nl })
                    : "Selecteer datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.due_date}
                  onSelect={(date) =>
                    setFormData({ ...formData, due_date: date })
                  }
                  initialFocus
                  locale={nl}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Start and End Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Starttijd
              </Label>
              <Input
                type="time"
                value={formData.start_time}
                onChange={(e) =>
                  setFormData({ ...formData, start_time: e.target.value })
                }
                placeholder="09:00"
              />
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Eindtijd
              </Label>
              <Input
                type="time"
                value={formData.end_time}
                onChange={(e) =>
                  setFormData({ ...formData, end_time: e.target.value })
                }
                placeholder="17:00"
              />
            </div>
          </div>

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Prioriteit</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((priority) => (
                    <SelectItem key={priority.value} value={priority.value}>
                      {priority.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "create" ? "Aanmaken" : "Opslaan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
