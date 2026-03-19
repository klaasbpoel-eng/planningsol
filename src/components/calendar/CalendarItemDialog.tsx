import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  CalendarDays,
  Palmtree,
  ClipboardList,
  User,
  Users,
  Clock,
  Edit2,
  Save,
  X,
  AlertCircle,
  Trash2,
  Sun,
  Sunset,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { formatTimeRange, getDayPartLabel, hasTimeInfo } from "@/lib/calendar-utils";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { getPrimarySupabaseClient } from "@/lib/api";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TaskType = Database["public"]["Tables"]["task_types"]["Row"];
type TimeOffType = Database["public"]["Tables"]["time_off_types"]["Row"];

type RequestWithProfile = TimeOffRequest & {
  profile?: Profile | null;
  leave_type?: TimeOffType | null;
};

type TaskWithProfile = Task & {
  profile?: Profile | null;
  task_type?: TaskType | null;
};

type CalendarItem =
  | { type: "timeoff"; data: RequestWithProfile }
  | { type: "task"; data: TaskWithProfile };

interface CalendarItemDialogProps {
  item: CalendarItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (deletedId?: string, deletedType?: "task" | "timeoff", updatedItem?: any) => void;
  isAdmin?: boolean;
  profiles?: Profile[];
  timeOffTypes?: TimeOffType[];
}

export function CalendarItemDialog({
  item,
  open,
  onOpenChange,
  onUpdate,
  isAdmin = false,
  profiles = [],
  timeOffTypes = [],
}: CalendarItemDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [applyToSeries, setApplyToSeries] = useState(false);

  // Task edit state
  const [taskStatus, setTaskStatus] = useState("");
  const [taskPriority, setTaskPriority] = useState("");
  const [taskDueDate, setTaskDueDate] = useState<Date | undefined>();
  const [taskAssignedTo, setTaskAssignedTo] = useState("");
  const [taskStartTime, setTaskStartTime] = useState("");
  const [taskEndTime, setTaskEndTime] = useState("");

  // TimeOff edit state
  const [timeOffStatus, setTimeOffStatus] = useState("");
  const [timeOffReason, setTimeOffReason] = useState("");
  const [timeOffStartDate, setTimeOffStartDate] = useState<Date | undefined>();
  const [timeOffEndDate, setTimeOffEndDate] = useState<Date | undefined>();
  const [timeOffTypeId, setTimeOffTypeId] = useState<string | null>(null);

  const resetTransientState = () => {
    setConfirmDelete(false);
    setIsEditing(false);
    setApplyToSeries(false);
  };

  useEffect(() => {
    if (!open) {
      resetTransientState();
      setSaving(false);
      setDeleting(false);
    }
  }, [open, item?.type, item?.data.id]);

  const startEditing = () => {
    if (item?.type === "task") {
      const task = item.data as TaskWithProfile;
      setTaskStatus(task.status);
      setTaskPriority(task.priority);
      setTaskDueDate(parseISO(task.due_date));
      setTaskAssignedTo(task.assigned_to || "everyone");
      setTaskStartTime(task.start_time || "");
      setTaskEndTime(task.end_time || "");
      setApplyToSeries(!!task.series_id);
    } else if (item?.type === "timeoff") {
      const request = item.data as RequestWithProfile;
      setTimeOffStatus(request.status);
      setTimeOffReason(request.reason || "");
      setTimeOffStartDate(parseISO(request.start_date));
      setTimeOffEndDate(parseISO(request.end_date));
      setTimeOffTypeId(request.type_id || null);
      setApplyToSeries(false);
    }

    setConfirmDelete(false);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setApplyToSeries(false);
  };

  const validateTimeOrder = (): boolean => {
    if (!taskStartTime || !taskEndTime) return true;
    return taskStartTime < taskEndTime;
  };

  const closeDialog = () => {
    if (deleting || saving) return;
    resetTransientState();
    onOpenChange(false);
  };

  const handleSave = async () => {
    if (!item || deleting) return;

    // Validate time order for tasks
    if (item.type === "task" && taskStartTime && taskEndTime && !validateTimeOrder()) {
      toast.error("Eindtijd moet na starttijd liggen");
      return;
    }

    setSaving(true);

    try {
      if (item.type === "task") {
        const taskData = item.data as TaskWithProfile;
        const updatePayload: Record<string, any> = {
          status: taskStatus,
          priority: taskPriority,
          assigned_to: taskAssignedTo === "everyone" ? null : taskAssignedTo,
          start_time: taskStartTime || null,
          end_time: taskEndTime || null,
        };

        const db = getPrimarySupabaseClient();
        if (applyToSeries && taskData.series_id) {
          // Update all tasks in the series (keep their own dates)
          const { error } = await db
            .from("tasks")
            .update(updatePayload)
            .eq("series_id", taskData.series_id);
          if (error) throw error;
          toast.success("Gehele reeks bijgewerkt");

          setIsEditing(false);
          // For series, a full refresh is safest as multiple items changed
          onUpdate();
          return;
        } else {
          // Update only this task (including date)
          const { data, error } = await db
            .from("tasks")
            .update({
              ...updatePayload,
              due_date: taskDueDate ? format(taskDueDate, "yyyy-MM-dd") : item.data.due_date,
            })
            .eq("id", item.data.id)
            .select()
            .single();
          if (error) throw error;
          toast.success("Taak bijgewerkt");

          setIsEditing(false);
          onUpdate(undefined, "task", data);
          return;
        }
      } else if (item.type === "timeoff") {
        const db = getPrimarySupabaseClient();
        const { data, error } = await db
          .from("time_off_requests")
          .update({
            status: timeOffStatus as "pending" | "approved" | "rejected",
            reason: timeOffReason || null,
            start_date: timeOffStartDate ? format(timeOffStartDate, "yyyy-MM-dd") : item.data.start_date,
            end_date: timeOffEndDate ? format(timeOffEndDate, "yyyy-MM-dd") : item.data.end_date,
            type_id: timeOffTypeId || null,
          })
          .eq("id", item.data.id)
          .select()
          .single();

        if (error) throw error;
        toast.success("Verlofaanvraag bijgewerkt");

        setIsEditing(false);
        onUpdate(undefined, "timeoff", data);
        return;
      }

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating item:", error);
      toast.error("Fout bij opslaan", {
        description: "Probeer het opnieuw",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (deleteSeries: boolean = false) => {
    if (!item || deleting || saving) return;

    const itemData = { ...item.data };
    const itemType = item.type;
    const isSeriesDelete = itemType === "task" && deleteSeries && !!(itemData as TaskWithProfile).series_id;

    setDeleting(true);

    try {
      if (itemType === "task") {
        const taskData = itemData as TaskWithProfile;
        const db = getPrimarySupabaseClient();
        let query = db.from("tasks").delete();
        query = deleteSeries && taskData.series_id
          ? query.eq("series_id", taskData.series_id)
          : query.eq("id", taskData.id);

        const { error } = await query;
        if (error) throw error;

        toast.success(deleteSeries ? "Reeks verwijderd" : "Taak verwijderd");
      } else if (itemType === "timeoff") {
        const db = getPrimarySupabaseClient();
        const { error } = await db.from("time_off_requests").delete().eq("id", itemData.id);
        if (error) throw error;

        toast.success("Verlofaanvraag verwijderd");
      }

      resetTransientState();
      onOpenChange(false);

      if (isSeriesDelete) {
        onUpdate();
      } else if (itemType === "task") {
        onUpdate(itemData.id, "task");
      } else {
        onUpdate(itemData.id, "timeoff");
      }
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Fout bij verwijderen", { description: "Probeer het opnieuw" });
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    closeDialog();
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      onOpenChange(true);
      return;
    }

    closeDialog();
  };

  if (!item) return null;

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "vacation": return "Vakantie";
      case "sick": return "Ziekteverlof";
      case "personal": return "Persoonlijk";
      default: return "Overig";
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "vacation": return "bg-primary text-primary-foreground";
      case "sick": return "bg-destructive text-destructive-foreground";
      case "personal": return "bg-accent text-accent-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "In behandeling";
      case "approved": return "Goedgekeurd";
      case "rejected": return "Afgewezen";
      case "in_progress": return "Bezig";
      case "completed": return "Voltooid";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-warning text-warning-foreground";
      case "approved": return "bg-success text-success-foreground";
      case "rejected": return "bg-destructive text-destructive-foreground";
      case "in_progress": return "bg-blue-500 text-white";
      case "completed": return "bg-success text-success-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high": return "Hoog";
      case "medium": return "Gemiddeld";
      case "low": return "Laag";
      default: return priority;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive text-destructive-foreground";
      case "medium": return "bg-warning text-warning-foreground";
      case "low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getEmployeeName = (itemData: RequestWithProfile | TaskWithProfile) => {
    // Check if it's a task and unassigned (assigned to everyone)
    if ('assigned_to' in itemData && !itemData.assigned_to) {
      return "Algemeen";
    }
    return itemData.profile?.full_name || itemData.profile?.email?.split("@")[0] || "Onbekend";
  };

  // Render Task Dialog
  if (item.type === "task") {
    const task = item.data as TaskWithProfile;

    return (
      <>
        <Dialog open={open} onOpenChange={handleDialogOpenChange}>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <ClipboardList className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-lg">
                    {isEditing ? "Taak bewerken" : "Taakdetails"}
                  </DialogTitle>
                  <DialogDescription>
                    {isEditing ? "Bewerk de taakgegevens hieronder" : "Bekijk de details van deze taak"}
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-4 py-4">
              {isEditing ? (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select value={taskStatus} onValueChange={setTaskStatus}>
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
                      <Select value={taskPriority} onValueChange={setTaskPriority}>
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
                      <Label>Deadline</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !taskDueDate && "text-muted-foreground"
                            )}
                          >
                            <CalendarDays className="mr-2 h-4 w-4" />
                            {taskDueDate ? format(taskDueDate, "d MMM yyyy", { locale: nl }) : "Selecteer datum"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                          <Calendar
                            mode="single"
                            selected={taskDueDate}
                            onSelect={setTaskDueDate}
                            locale={nl}
                            initialFocus
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    <div className="space-y-2">
                      <Label>Toegewezen aan</Label>
                      <Select value={taskAssignedTo} onValueChange={setTaskAssignedTo}>
                        <SelectTrigger className="bg-background">
                          <SelectValue placeholder="Selecteer medewerker" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          <SelectItem value="everyone" className="font-medium border-b mb-1">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              Algemeen
                            </div>
                          </SelectItem>
                          {profiles.map((profile) => (
                            <SelectItem key={profile.id} value={profile.id}>
                              {profile.full_name || profile.email?.split("@")[0]}
                              {!profile.user_id && (
                                <span className="ml-2 text-xs text-muted-foreground">(geen account)</span>
                              )}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Time selection */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Starttijd
                      </Label>
                      <Input
                        type="time"
                        value={taskStartTime}
                        onChange={(e) => setTaskStartTime(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        Eindtijd
                      </Label>
                      <Input
                        type="time"
                        value={taskEndTime}
                        onChange={(e) => setTaskEndTime(e.target.value)}
                        className="bg-background"
                      />
                    </div>
                  </div>
                  {taskStartTime && taskEndTime && !validateTimeOrder() && (
                    <div className="text-sm text-destructive flex items-center gap-2">
                      <AlertCircle className="h-4 w-4" />
                      Eindtijd moet na starttijd liggen
                    </div>
                  )}

                  {/* Apply to series checkbox */}
                  {task.series_id && (
                    <div className="flex items-center space-x-2 p-3 rounded-lg border bg-muted/30">
                      <Checkbox
                        id="apply-task-series"
                        checked={applyToSeries}
                        onCheckedChange={(checked) => setApplyToSeries(!!checked)}
                      />
                      <Label htmlFor="apply-task-series" className="text-sm cursor-pointer">
                        Wijzigingen doorvoeren voor de gehele reeks
                      </Label>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-semibold text-lg">{task.task_type?.name || "Taak"}</h3>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge className={cn(getStatusColor(task.status))}>
                        {getStatusLabel(task.status)}
                      </Badge>
                      <Badge className={cn(getPriorityColor(task.priority))}>
                        {getPriorityLabel(task.priority)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Toegewezen aan:</span>
                        <span className="font-medium">{getEmployeeName(task)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CalendarDays className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Deadline:</span>
                        <span className="font-medium">{format(parseISO(task.due_date), "d MMM yyyy", { locale: nl })}</span>
                      </div>
                    </div>

                    {hasTimeInfo(task.start_time, task.end_time) && (
                      <div className="flex items-center gap-2 text-sm pt-1">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                        <span className="text-muted-foreground">Tijd:</span>
                        <span className="font-medium">{formatTimeRange(task.start_time, task.end_time)}</span>
                      </div>
                    )}

                    <div className="pt-2 border-t">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span>Aangemaakt op {format(parseISO(task.created_at), "d MMM yyyy 'om' HH:mm", { locale: nl })}</span>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            <DialogFooter className="flex-col sm:flex-row gap-2">
              {isEditing ? (
                <>
                  <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                    <X className="h-4 w-4 mr-2" />
                    Annuleren
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    <Save className="h-4 w-4 mr-2" />
                    {saving ? "Opslaan..." : "Opslaan"}
                  </Button>
                </>
              ) : confirmDelete ? (
                <>
                  <Button
                    variant="outline"
                    onClick={() => setConfirmDelete(false)}
                    disabled={deleting || saving}
                  >
                    Annuleren
                  </Button>
                  {task.series_id ? (
                    <>
                      <Button
                        variant="destructive"
                        onClick={() => void handleDelete(false)}
                        disabled={deleting || saving}
                      >
                        {deleting ? "Verwijderen..." : "Alleen deze"}
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => void handleDelete(true)}
                        disabled={deleting || saving}
                      >
                        {deleting ? "Verwijderen..." : "Hele reeks"}
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="destructive"
                      onClick={() => void handleDelete(false)}
                      disabled={deleting || saving}
                    >
                      {deleting ? "Verwijderen..." : "Definitief verwijderen"}
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      onClick={() => setConfirmDelete(true)}
                      className="sm:mr-auto"
                      disabled={deleting || saving}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Verwijderen
                    </Button>
                  )}
                  <Button variant="outline" onClick={handleClose} disabled={deleting || saving}>
                    Sluiten
                  </Button>
                  {isAdmin && (
                    <Button onClick={startEditing} disabled={deleting || saving}>
                      <Edit2 className="h-4 w-4 mr-2" />
                      Bewerken
                    </Button>
                  )}
                </>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </>
    );
  }

  // Render Time Off Request Dialog
  const request = item.data as RequestWithProfile;

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className={cn("p-2 rounded-lg", getTypeColor(request.type).replace("text-", "bg-").split(" ")[0] + "/10")}>
                <Palmtree className={cn("h-5 w-5", getTypeColor(request.type).includes("primary") ? "text-primary" : getTypeColor(request.type).includes("destructive") ? "text-destructive" : "text-accent")} />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-lg">
                  {isEditing ? "Verlofaanvraag bewerken" : "Verlofaanvraag details"}
                </DialogTitle>
                <DialogDescription>
                  {isEditing ? "Bewerk de aanvraaggegevens hieronder" : "Bekijk de details van deze verlofaanvraag"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isEditing ? (
              <>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={timeOffStatus} onValueChange={setTimeOffStatus}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="pending">In behandeling</SelectItem>
                      <SelectItem value="approved">Goedgekeurd</SelectItem>
                      <SelectItem value="rejected">Afgewezen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {timeOffTypes.length > 0 && (
                  <div className="space-y-2">
                    <Label>Categorie</Label>
                    <Select value={timeOffTypeId || "none"} onValueChange={(val) => setTimeOffTypeId(val === "none" ? null : val)}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecteer categorie" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="none">Geen categorie</SelectItem>
                        {timeOffTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                              {type.name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Startdatum</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !timeOffStartDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {timeOffStartDate ? format(timeOffStartDate, "d MMM yyyy", { locale: nl }) : "Selecteer datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={timeOffStartDate}
                          onSelect={setTimeOffStartDate}
                          locale={nl}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>Einddatum</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !timeOffEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {timeOffEndDate ? format(timeOffEndDate, "d MMM yyyy", { locale: nl }) : "Selecteer datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={timeOffEndDate}
                          onSelect={setTimeOffEndDate}
                          locale={nl}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="reason">Reden</Label>
                  <Textarea
                    id="reason"
                    value={timeOffReason}
                    onChange={(e) => setTimeOffReason(e.target.value)}
                    placeholder="Optionele reden voor de aanvraag"
                    rows={3}
                  />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    <Badge className={cn(getTypeColor(request.type))}>
                      {getTypeLabel(request.type)}
                    </Badge>
                    {request.leave_type && (
                      <Badge variant="outline" className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: request.leave_type.color }} />
                        {request.leave_type.name}
                      </Badge>
                    )}
                    <Badge className={cn(getStatusColor(request.status))}>
                      {getStatusLabel(request.status)}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Medewerker:</span>
                      <span className="font-medium">{getEmployeeName(request)}</span>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <CalendarDays className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Periode:</span>
                      <span className="font-medium">
                        {format(parseISO(request.start_date), "d MMM yyyy", { locale: nl })} - {format(parseISO(request.end_date), "d MMM yyyy", { locale: nl })}
                      </span>
                    </div>

                    {request.day_part && request.day_part !== "full_day" && (
                      <div className="flex items-center gap-2 text-sm">
                        {request.day_part === "morning" ? (
                          <Sun className="h-4 w-4 text-amber-500" />
                        ) : (
                          <Sunset className="h-4 w-4 text-orange-500" />
                        )}
                        <span className="text-muted-foreground">Dagdeel:</span>
                        <span className="font-medium">{getDayPartLabel(request.day_part)}</span>
                      </div>
                    )}

                    {request.reason && (
                      <div className="pt-2">
                        <div className="flex items-start gap-2 text-sm">
                          <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <span className="text-muted-foreground">Reden:</span>
                            <p className="font-medium mt-0.5">{request.reason}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Aangevraagd op {format(parseISO(request.created_at), "d MMM yyyy 'om' HH:mm", { locale: nl })}</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                  <X className="h-4 w-4 mr-2" />
                  Annuleren
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Opslaan..." : "Opslaan"}
                </Button>
              </>
            ) : confirmDelete ? (
              <>
                <Button
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                  disabled={deleting || saving}
                >
                  Annuleren
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => void handleDelete(false)}
                  disabled={deleting || saving}
                >
                  {deleting ? "Verwijderen..." : "Definitief verwijderen"}
                </Button>
              </>
            ) : (
              <>
                {isAdmin && (
                  <Button
                    variant="destructive"
                    onClick={() => setConfirmDelete(true)}
                    className="sm:mr-auto"
                    disabled={deleting || saving}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Verwijderen
                  </Button>
                )}
                <Button variant="outline" onClick={handleClose} disabled={deleting || saving}>
                  Sluiten
                </Button>
                {isAdmin && (
                  <Button onClick={startEditing} disabled={deleting || saving}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Bewerken
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </>
  );
}
