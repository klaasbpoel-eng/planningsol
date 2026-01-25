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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, ClipboardList, Plus, Clock } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TaskType = Database["public"]["Tables"]["task_types"]["Row"];

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
  const [status, setStatus] = useState("pending");
  const [priority, setPriority] = useState("medium");
  const [dueDate, setDueDate] = useState<Date | undefined>(initialDate);
  const [assignedTo, setAssignedTo] = useState(currentUserId || "");
  const [categoryId, setCategoryId] = useState<string>("");
  const [subcategoryId, setSubcategoryId] = useState<string>("");
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [hasTime, setHasTime] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  useEffect(() => {
    if (open) {
      fetchTaskTypes();
    }
  }, [open]);

  const fetchTaskTypes = async () => {
    const { data, error } = await supabase
      .from("task_types")
      .select("*")
      .eq("is_active", true)
      .order("sort_order");

    if (!error && data) {
      setTaskTypes(data);
    }
  };

  const mainCategories = taskTypes.filter((t) => !t.parent_id);
  const subcategories = taskTypes.filter((t) => t.parent_id === categoryId);

  const resetForm = () => {
    setStatus("pending");
    setPriority("medium");
    setDueDate(initialDate);
    setAssignedTo(currentUserId || "");
    setCategoryId("");
    setSubcategoryId("");
    setHasTime(false);
    setStartTime("");
    setEndTime("");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const validateTimeOrder = (): boolean => {
    if (!hasTime || !startTime || !endTime) return true;
    return startTime < endTime;
  };

  const handleCreate = async () => {
    if (!dueDate || !currentUserId) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    if (hasTime && startTime && endTime && !validateTimeOrder()) {
      toast.error("Eindtijd moet na starttijd liggen");
      return;
    }

    setSaving(true);

    try {
      // Use subcategory if selected, otherwise main category
      const typeId = subcategoryId || categoryId || null;

      const { error } = await supabase.from("tasks").insert({
        status,
        priority,
        due_date: format(dueDate, "yyyy-MM-dd"),
        assigned_to: assignedTo || null,
        created_by: currentUserId,
        type_id: typeId,
        start_time: hasTime && startTime ? startTime : null,
        end_time: hasTime && endTime ? endTime : null,
      });

      if (error) throw error;

      toast.success("Taak aangemaakt");
      
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

  // Reset subcategory when main category changes
  const handleCategoryChange = (value: string) => {
    setCategoryId(value);
    setSubcategoryId("");
  };

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

          {/* Category selectors */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hoofdcategorie</Label>
              <Select value={categoryId} onValueChange={handleCategoryChange}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecteer categorie" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {mainCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Subcategorie</Label>
              <Select
                value={subcategoryId}
                onValueChange={setSubcategoryId}
                disabled={!categoryId || subcategories.length === 0}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder={subcategories.length === 0 ? "Geen subcategorieën" : "Selecteer subcategorie"} />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {subcategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: cat.color }}
                        />
                        {cat.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

          {/* Time selection */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="hasTime"
                checked={hasTime}
                onCheckedChange={(checked) => {
                  setHasTime(checked as boolean);
                  if (!checked) {
                    setStartTime("");
                    setEndTime("");
                  }
                }}
              />
              <label
                htmlFor="hasTime"
                className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2"
              >
                <Clock className="h-4 w-4 text-muted-foreground" />
                Specifieke tijd instellen
              </label>
            </div>

            {hasTime && (
              <div className="grid grid-cols-2 gap-4 pl-6 animate-in slide-in-from-top-2 duration-200">
                <div className="space-y-2">
                  <Label htmlFor="startTime">Starttijd</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="bg-background"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endTime">Eindtijd</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="bg-background"
                  />
                </div>
                {startTime && endTime && !validateTimeOrder() && (
                  <div className="col-span-2 text-sm text-destructive">
                    Eindtijd moet na starttijd liggen
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Annuleren
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !dueDate}
          >
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Aanmaken..." : "Taak aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}