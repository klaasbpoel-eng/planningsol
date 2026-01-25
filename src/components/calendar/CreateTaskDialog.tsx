import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ClipboardList, Plus } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
  initialDate?: Date;
  profiles: Profile[];
  currentUserId?: string;
}

export function CreateTaskDialog({
  open,
  onOpenChange,
  onCreate,
  initialDate,
  profiles,
  currentUserId,
}: CreateTaskDialogProps) {
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("pending");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>(initialDate);
  const [assignedTo, setAssignedTo] = useState(currentUserId || "");

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStatus("pending");
    setPriority("medium");
    setDueDate(initialDate);
    setAssignedTo(currentUserId || "");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!title.trim() || !dueDate || !assignedTo || !currentUserId) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("tasks").insert({
        title: title.trim(),
        description: description.trim() || null,
        status,
        priority,
        due_date: format(dueDate, "yyyy-MM-dd"),
        assigned_to: assignedTo,
        created_by: currentUserId,
      });

      if (error) throw error;

      toast.success("Taak aangemaakt", {
        description: `"${title}" is toegevoegd aan de kalender`,
      });
      
      resetForm();
      onCreate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Fout bij aanmaken taak", {
        description: "Probeer het opnieuw",
      });
    } finally {
      setSaving(false);
    }
  };

  // Update dueDate when initialDate changes
  if (initialDate && (!dueDate || dueDate.getTime() !== initialDate.getTime())) {
    setDueDate(initialDate);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <ClipboardList className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">Nieuwe taak</DialogTitle>
              <DialogDescription>
                Maak een nieuwe taak aan voor de kalender
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">
              Titel <span className="text-destructive">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Voer een titel in"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Beschrijving</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionele beschrijving"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="pending">Te doen</SelectItem>
                  <SelectItem value="in_progress">Bezig</SelectItem>
                  <SelectItem value="completed">Voltooid</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Prioriteit</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="low">Laag</SelectItem>
                  <SelectItem value="medium">Gemiddeld</SelectItem>
                  <SelectItem value="high">Hoog</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Deadline <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !dueDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {dueDate
                      ? format(dueDate, "d MMM yyyy", { locale: nl })
                      : "Selecteer datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 bg-background border shadow-lg z-50"
                  align="start"
                >
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    locale={nl}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>
                Toegewezen aan <span className="text-destructive">*</span>
              </Label>
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecteer medewerker" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {profiles.map((profile) => (
                    <SelectItem
                      key={profile.user_id}
                      value={profile.user_id || ""}
                    >
                      {profile.full_name || profile.email?.split("@")[0]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Annuleren
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !title.trim() || !dueDate || !assignedTo}
          >
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Aanmaken..." : "Taak aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
