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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
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
import { CalendarDays, ClipboardList, Plus, Clock, Users, Repeat } from "lucide-react";
import { format, addWeeks, addYears } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TaskType = Database["public"]["Tables"]["task_types"]["Row"] & {
  parent_id?: string | null;
};

interface CreateTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (tasks?: any[]) => void;
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
  const [assignedTo, setAssignedTo] = useState("");
  const [title, setTitle] = useState("");
  const [hasTime, setHasTime] = useState(false);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");

  // Category state
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [mainCategoryId, setMainCategoryId] = useState<string | null>(null);
  const [subCategoryId, setSubCategoryId] = useState<string | null>(null);

  // Recurrence state
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<1 | 2>(1);
  const [isInfiniteRecurrence, setIsInfiniteRecurrence] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined);

  // Load task types
  useEffect(() => {
    const fetchTaskTypes = async () => {
      const { data } = await supabase
        .from("task_types")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      setTaskTypes((data as TaskType[]) || []);
    };
    if (open) fetchTaskTypes();
  }, [open]);

  const mainCategories = taskTypes.filter((t) => !t.parent_id);
  const getSubcategories = (parentId: string) =>
    taskTypes.filter((t) => t.parent_id === parentId);

  const resetForm = () => {
    setStatus("pending");
    setPriority("medium");
    setDueDate(initialDate);
    setAssignedTo("");
    setTitle("");
    setHasTime(false);
    setStartTime("");
    setEndTime("");
    setMainCategoryId(null);
    setSubCategoryId(null);
    setIsRecurring(false);
    setRecurrenceInterval(1);
    setIsInfiniteRecurrence(false);
    setRecurrenceEndDate(undefined);
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

    if (isRecurring && !isInfiniteRecurrence && !recurrenceEndDate) {
      toast.error("Selecteer een einddatum voor de herhaling");
      return;
    }

    setSaving(true);

    try {
      // Generate dates for recurring tasks
      const taskDates: Date[] = [dueDate];

      if (isRecurring) {
        const endDate = isInfiniteRecurrence
          ? addYears(dueDate, 1)
          : recurrenceEndDate;

        if (endDate) {
          let nextDate = addWeeks(dueDate, recurrenceInterval);
          while (nextDate <= endDate) {
            taskDates.push(nextDate);
            nextDate = addWeeks(nextDate, recurrenceInterval);
          }
        }
      }

      const seriesId = isRecurring ? crypto.randomUUID() : null;
      const finalTypeId = subCategoryId || mainCategoryId;

      const tasksToCreate = taskDates.map(date => ({
        title: title || null,
        status,
        priority,
        due_date: format(date, "yyyy-MM-dd"),
        assigned_to: (assignedTo === "everyone" || !assignedTo) ? null : assignedTo,
        created_by: currentUserId,
        type_id: finalTypeId,
        series_id: seriesId,
        start_time: hasTime && startTime ? startTime : null,
        end_time: hasTime && endTime ? endTime : null,
      }));

      const createdTasks = await Promise.all(tasksToCreate.map(task => api.tasks.create(task)));

      toast.success(
        createdTasks.length > 1
          ? `${createdTasks.length} taken aangemaakt`
          : "Taak aangemaakt"
      );

      resetForm();
      onCreate(createdTasks);
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

          {/* Title */}
          <div className="space-y-2">
            <Label>Algemene omschrijving</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Beschrijf de taak..."
              className="bg-background"
            />
          </div>

          {/* Assigned To */}
          <div className="space-y-2">
            <Label>
              Toegewezen aan <span className="text-destructive">*</span>
            </Label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecteer medewerker" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                <SelectItem value="everyone" className="font-medium border-b mb-1">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Iedereen
                    <span className="text-xs text-muted-foreground">(algemeen)</span>
                  </div>
                </SelectItem>
                {profiles.map((profile) => (
                  <SelectItem
                    key={profile.id}
                    value={profile.id}
                  >
                    {profile.full_name || profile.email?.split("@")[0]}
                    {!profile.user_id && (
                      <span className="ml-2 text-xs text-muted-foreground">(geen account)</span>
                    )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Main Category */}
          {mainCategories.length > 0 && (
            <div className="space-y-2">
              <Label>Hoofdcategorie</Label>
              <Select
                value={mainCategoryId || "none"}
                onValueChange={(value) => {
                  setMainCategoryId(value === "none" ? null : value);
                  setSubCategoryId(null);
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecteer hoofdcategorie" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
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

          {/* Subcategory */}
          {mainCategoryId && getSubcategories(mainCategoryId).length > 0 && (
            <div className="space-y-2">
              <Label>Subcategorie</Label>
              <Select
                value={subCategoryId || "none"}
                onValueChange={(value) => setSubCategoryId(value === "none" ? null : value)}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecteer subcategorie" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="none">Geen subcategorie</SelectItem>
                  {getSubcategories(mainCategoryId).map((type) => (
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

          {/* Deadline */}
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

          {/* Recurrence option */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="isRecurringTask"
                checked={isRecurring}
                onCheckedChange={(checked) => {
                  setIsRecurring(checked === true);
                  if (!checked) {
                    setRecurrenceEndDate(undefined);
                    setRecurrenceInterval(1);
                  }
                }}
              />
              <Label htmlFor="isRecurringTask" className="flex items-center gap-2 cursor-pointer font-normal">
                <Repeat className="h-4 w-4" />
                Herhalen
              </Label>
            </div>

            {isRecurring && (
              <div className="space-y-3 pl-6">
                <div className="space-y-2">
                  <Label className="text-sm">Herhalingsinterval</Label>
                  <RadioGroup
                    value={recurrenceInterval.toString()}
                    onValueChange={(v) => setRecurrenceInterval(parseInt(v) as 1 | 2)}
                    className="flex gap-4"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="1" id="interval-weekly-task" />
                      <Label htmlFor="interval-weekly-task" className="font-normal cursor-pointer text-sm">Wekelijks</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="2" id="interval-biweekly-task" />
                      <Label htmlFor="interval-biweekly-task" className="font-normal cursor-pointer text-sm">2-wekelijks</Label>
                    </div>
                  </RadioGroup>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isInfiniteTask"
                    checked={isInfiniteRecurrence}
                    onCheckedChange={(checked) => {
                      setIsInfiniteRecurrence(checked === true);
                      if (checked) {
                        setRecurrenceEndDate(undefined);
                      }
                    }}
                  />
                  <Label htmlFor="isInfiniteTask" className="cursor-pointer font-normal text-sm">
                    Oneindig herhalen (1 jaar vooruit)
                  </Label>
                </div>

                {!isInfiniteRecurrence && (
                  <div className="space-y-2">
                    <Label>
                      Herhalen tot <span className="text-destructive">*</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !recurrenceEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {recurrenceEndDate
                            ? format(recurrenceEndDate, "d MMM yyyy", { locale: nl })
                            : "Selecteer einddatum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 bg-background border shadow-lg z-50"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={recurrenceEndDate}
                          onSelect={setRecurrenceEndDate}
                          locale={nl}
                          disabled={(date) => dueDate ? date <= dueDate : false}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Time selection (optional) */}
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

          {/* Priority & Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Prioriteit</Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="low">Laag</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">Hoog</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="pending">In afwachting</SelectItem>
                  <SelectItem value="in_progress">In uitvoering</SelectItem>
                  <SelectItem value="completed">Voltooid</SelectItem>
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
