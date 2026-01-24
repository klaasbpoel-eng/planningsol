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
import { CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: Profile[];
  onTaskCreated: () => void;
}

export function TaskFormDialog({
  open,
  onOpenChange,
  employees,
  onTaskCreated,
}: TaskFormDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTitle("");
      setDescription("");
      setAssignedTo("");
      setDueDate(undefined);
      setPriority("medium");
    }
  }, [open]);

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

      const { error } = await supabase.from("tasks").insert({
        title: title.trim(),
        description: description.trim() || null,
        assigned_to: assignedTo,
        due_date: format(dueDate, "yyyy-MM-dd"),
        priority,
        created_by: user.id,
      });

      if (error) throw error;

      toast.success("Taak succesvol toegevoegd");
      onOpenChange(false);
      onTaskCreated();
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Fout bij het toevoegen van de taak");
    } finally {
      setSaving(false);
    }
  };

  const priorityOptions = [
    { value: "low", label: "Laag", color: "text-muted-foreground" },
    { value: "medium", label: "Medium", color: "text-warning" },
    { value: "high", label: "Hoog", color: "text-destructive" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Nieuwe taak toevoegen</DialogTitle>
          <DialogDescription>
            Voeg een taak toe voor een medewerker
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Toevoegen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
