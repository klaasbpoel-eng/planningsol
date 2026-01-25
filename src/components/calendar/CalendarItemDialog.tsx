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
  Clock, 
  Edit2, 
  Save, 
  X,
  AlertCircle,
  Trash2,
  Sun,
  Sunset
} from "lucide-react";
import { formatTimeRange, getDayPartLabel, hasTimeInfo } from "@/lib/calendar-utils";
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
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TaskType = Database["public"]["Tables"]["task_types"]["Row"];

type RequestWithProfile = TimeOffRequest & {
  profile?: Profile | null;
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
  onUpdate: () => void;
  isAdmin?: boolean;
  profiles?: Profile[];
}

export function CalendarItemDialog({ 
  item, 
  open, 
  onOpenChange, 
  onUpdate,
  isAdmin = false,
  profiles = []
}: CalendarItemDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
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

  const startEditing = () => {
    if (item?.type === "task") {
      const task = item.data as TaskWithProfile;
      setTaskStatus(task.status);
      setTaskPriority(task.priority);
      setTaskDueDate(parseISO(task.due_date));
      setTaskAssignedTo(task.assigned_to);
      setTaskStartTime(task.start_time || "");
      setTaskEndTime(task.end_time || "");
    } else if (item?.type === "timeoff") {
      const request = item.data as RequestWithProfile;
      setTimeOffStatus(request.status);
      setTimeOffReason(request.reason || "");
      setTimeOffStartDate(parseISO(request.start_date));
      setTimeOffEndDate(parseISO(request.end_date));
    }
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const validateTimeOrder = (): boolean => {
    if (!taskStartTime || !taskEndTime) return true;
    return taskStartTime < taskEndTime;
  };

  const handleSave = async () => {
    if (!item) return;

    // Validate time order for tasks
    if (item.type === "task" && taskStartTime && taskEndTime && !validateTimeOrder()) {
      toast.error("Eindtijd moet na starttijd liggen");
      return;
    }

    setSaving(true);

    try {
      if (item.type === "task") {
        const { error } = await supabase
          .from("tasks")
          .update({
            status: taskStatus,
            priority: taskPriority,
            due_date: taskDueDate ? format(taskDueDate, "yyyy-MM-dd") : item.data.due_date,
            assigned_to: taskAssignedTo,
            start_time: taskStartTime || null,
            end_time: taskEndTime || null,
          })
          .eq("id", item.data.id);

        if (error) throw error;
        toast.success("Taak bijgewerkt");
      } else if (item.type === "timeoff") {
        const { error } = await supabase
          .from("time_off_requests")
          .update({
            status: timeOffStatus as "pending" | "approved" | "rejected",
            reason: timeOffReason || null,
            start_date: timeOffStartDate ? format(timeOffStartDate, "yyyy-MM-dd") : item.data.start_date,
            end_date: timeOffEndDate ? format(timeOffEndDate, "yyyy-MM-dd") : item.data.end_date,
          })
          .eq("id", item.data.id);

        if (error) throw error;
        toast.success("Verlofaanvraag bijgewerkt");
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

  const handleDelete = async () => {
    if (!item) return;
    setDeleting(true);

    try {
      // Store item data for potential undo
      const itemData = { ...item.data };
      const itemType = item.type;
      
      if (itemType === "task") {
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", itemData.id);

        if (error) throw error;
        
        // Show toast with undo option
        toast.success("Taak verwijderd", {
          duration: 5000,
          action: {
            label: "Ongedaan maken",
            onClick: async () => {
              try {
                // Restore the task
                const { error: restoreError } = await supabase
                  .from("tasks")
                  .insert({
                    id: itemData.id,
                    status: (itemData as TaskWithProfile).status,
                    priority: (itemData as TaskWithProfile).priority,
                    due_date: (itemData as TaskWithProfile).due_date,
                    assigned_to: (itemData as TaskWithProfile).assigned_to,
                    created_by: (itemData as TaskWithProfile).created_by,
                    type_id: (itemData as TaskWithProfile).type_id,
                    start_time: (itemData as TaskWithProfile).start_time,
                    end_time: (itemData as TaskWithProfile).end_time,
                  });
                
                if (restoreError) throw restoreError;
                toast.success("Taak hersteld");
                onUpdate();
              } catch (err) {
                console.error("Error restoring task:", err);
                toast.error("Kon taak niet herstellen");
              }
            },
          },
        });
      } else if (itemType === "timeoff") {
        const { error } = await supabase
          .from("time_off_requests")
          .delete()
          .eq("id", itemData.id);

        if (error) throw error;
        
        // Show toast with undo option
        toast.success("Verlofaanvraag verwijderd", {
          duration: 5000,
          action: {
            label: "Ongedaan maken",
            onClick: async () => {
              try {
                // Restore the time off request using profile_id
                const requestData = itemData as RequestWithProfile & { profile_id?: string };
                const { error: restoreError } = await supabase
                  .from("time_off_requests")
                  .insert({
                    id: requestData.id,
                    profile_id: (requestData as any).profile_id,
                    start_date: requestData.start_date,
                    end_date: requestData.end_date,
                    type: requestData.type,
                    reason: requestData.reason,
                    status: requestData.status,
                  } as any);
                
                if (restoreError) throw restoreError;
                toast.success("Verlofaanvraag hersteld");
                onUpdate();
              } catch (err) {
                console.error("Error restoring request:", err);
                toast.error("Kon verlofaanvraag niet herstellen");
              }
            },
          },
        });
      }

      setShowDeleteConfirm(false);
      onOpenChange(false);
      onUpdate();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast.error("Fout bij verwijderen", {
        description: "Probeer het opnieuw",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setShowDeleteConfirm(false);
    onOpenChange(false);
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
    return itemData.profile?.full_name || itemData.profile?.email?.split("@")[0] || "Onbekend";
  };

  // Render Task Dialog
  if (item.type === "task") {
    const task = item.data as TaskWithProfile;
    
    return (
      <>
      <Dialog open={open} onOpenChange={handleClose}>
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
                        {profiles
                          .filter((profile) => profile.user_id)
                          .map((profile) => (
                            <SelectItem key={profile.user_id} value={profile.user_id!}>
                              {profile.full_name || profile.email?.split("@")[0]}
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
            ) : (
              <>
                {isAdmin && (
                  <Button 
                    variant="destructive" 
                    onClick={() => setShowDeleteConfirm(true)}
                    className="sm:mr-auto"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Verwijderen
                  </Button>
                )}
                <Button variant="outline" onClick={handleClose}>
                  Sluiten
                </Button>
                {isAdmin && (
                  <Button onClick={startEditing}>
                    <Edit2 className="h-4 w-4 mr-2" />
                    Bewerken
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taak verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je deze taak wilt verwijderen? 
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Verwijderen..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </>
    );
  }

  // Render Time Off Request Dialog
  const request = item.data as RequestWithProfile;
  
  return (
    <>
    <Dialog open={open} onOpenChange={handleClose}>
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
                <div className="flex items-center gap-3">
                  <Badge className={cn(getTypeColor(request.type))}>
                    {getTypeLabel(request.type)}
                  </Badge>
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
          ) : (
            <>
              {isAdmin && (
                <Button 
                  variant="destructive" 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="sm:mr-auto"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Verwijderen
                </Button>
              )}
              <Button variant="outline" onClick={handleClose}>
                Sluiten
              </Button>
              {isAdmin && (
                <Button onClick={startEditing}>
                  <Edit2 className="h-4 w-4 mr-2" />
                  Bewerken
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Delete Confirmation Dialog for Time Off */}
    <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Verlofaanvraag verwijderen</AlertDialogTitle>
          <AlertDialogDescription>
            Weet je zeker dat je deze verlofaanvraag wilt verwijderen? 
            Deze actie kan niet ongedaan worden gemaakt.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Annuleren</AlertDialogCancel>
          <AlertDialogAction 
            onClick={handleDelete} 
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {deleting ? "Verwijderen..." : "Verwijderen"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
