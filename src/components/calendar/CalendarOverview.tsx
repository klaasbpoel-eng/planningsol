import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon,
  List,
  Grid3X3,
  LayoutGrid,
  Users,
  ClipboardList,
  Palmtree,
  GripVertical,
  Plus,
  Undo2,
  Maximize2
} from "lucide-react";
import { toast } from "sonner";
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachMonthOfInterval,
  addDays,
  addWeeks,
  addMonths,
  addYears,
  subDays,
  subWeeks,
  subMonths,
  subYears,
  isToday,
  isSameMonth,
  isSameDay,
  parseISO,
  isWithinInterval,
  getWeek
} from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CalendarItemDialog } from "./CalendarItemDialog";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { CreateLeaveRequestDialog } from "./CreateLeaveRequestDialog";
import { useUserRole } from "@/hooks/useUserRole";
import { 
  formatTimeRange, 
  getDayPartLabel, 
  getDayPartIcon,
  hasTimeInfo 
} from "@/lib/calendar-utils";
import { Clock, Sun, Sunset } from "lucide-react";
import { FullScreenCalendar, type CalendarData, type CalendarEvent } from "@/components/ui/fullscreen-calendar";

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

type ViewType = "day" | "week" | "month" | "year" | "fullscreen";
type CalendarItem = 
  | { type: "timeoff"; data: RequestWithProfile }
  | { type: "task"; data: TaskWithProfile };

export function CalendarOverview() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>("month");
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [tasks, setTasks] = useState<TaskWithProfile[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showTimeOff, setShowTimeOff] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [draggedTask, setDraggedTask] = useState<TaskWithProfile | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [createLeaveDialogOpen, setCreateLeaveDialogOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | undefined>();
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [lastAction, setLastAction] = useState<{
    type: "task_move";
    taskId: string;
    taskName: string;
    previousDate: string;
    newDate: string;
  } | null>(null);
  
  const { isAdmin } = useUserRole(currentUserId);

  const leaveTypes = [
    { value: "vacation", label: "Vakantie", color: "bg-primary" },
    { value: "sick", label: "Ziekteverlof", color: "bg-destructive" },
    { value: "personal", label: "Persoonlijk", color: "bg-accent" },
    { value: "other", label: "Overig", color: "bg-muted" },
  ];

  const statusTypes = [
    { value: "approved", label: "Goedgekeurd", color: "bg-success" },
    { value: "pending", label: "In behandeling", color: "bg-warning" },
  ];

  const taskStatusTypes = [
    { value: "pending", label: "Te doen", color: "bg-warning" },
    { value: "in_progress", label: "Bezig", color: "bg-blue-500" },
    { value: "completed", label: "Voltooid", color: "bg-success" },
  ];

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    getUser();
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all profiles first
      const { data: profilesData, error: profilesError } = await supabase
        .from("profiles")
        .select("*");

      if (profilesError) throw profilesError;

      // Fetch all requests (RLS allows all authenticated users to view)
      const { data: requestsData, error: requestsError } = await supabase
        .from("time_off_requests")
        .select("*")
        .order("start_date", { ascending: true });

      if (requestsError) throw requestsError;

      // Fetch all tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true });

      if (tasksError) throw tasksError;

      // Fetch task types
      const { data: taskTypesData, error: taskTypesError } = await supabase
        .from("task_types")
        .select("*")
        .eq("is_active", true);

      if (taskTypesError) throw taskTypesError;

      // Map profiles to requests
      const requestsWithProfiles: RequestWithProfile[] = (requestsData || []).map((request) => {
        const profile = profilesData?.find((p) => p.user_id === request.user_id) || null;
        return { ...request, profile };
      });

      // Map profiles and task types to tasks
      const tasksWithProfiles: TaskWithProfile[] = (tasksData || []).map((task) => {
        const profile = profilesData?.find((p) => p.user_id === task.assigned_to) || null;
        const task_type = taskTypesData?.find((t) => t.id === task.type_id) || null;
        return { ...task, profile, task_type };
      });

      setRequests(requestsWithProfiles);
      setTasks(tasksWithProfiles);
      setProfiles(profilesData || []);
      setTaskTypes(taskTypesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = (item: CalendarItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedItem(item);
    setDialogOpen(true);
  };

  const handleDialogUpdate = () => {
    fetchData();
  };

  const handleDayClick = (day: Date, e: React.MouseEvent) => {
    // Only open create menu if admin and clicking on empty area (not on an item)
    if (isAdmin) {
      setCreateDate(day);
      setShowCreateMenu(true);
    }
  };

  const handleCreateTask = () => {
    setShowCreateMenu(false);
    setCreateTaskDialogOpen(true);
  };

  const handleCreateLeave = () => {
    setShowCreateMenu(false);
    setCreateLeaveDialogOpen(true);
  };

  const handleTaskCreated = () => {
    fetchData();
  };

  const handleUndoAction = async (action: typeof lastAction) => {
    if (!action) return;
    
    if (action.type === "task_move") {
      // Optimistically revert the UI
      setTasks((prev) =>
        prev.map((t) =>
          t.id === action.taskId ? { ...t, due_date: action.previousDate } : t
        )
      );
      
      try {
        const { error } = await supabase
          .from("tasks")
          .update({ due_date: action.previousDate })
          .eq("id", action.taskId);

        if (error) throw error;
        
        setLastAction(null);
        toast.success("Actie ongedaan gemaakt", {
          description: `"${action.taskName}" teruggezet naar ${format(parseISO(action.previousDate), "d MMMM yyyy", { locale: nl })}`,
        });
      } catch (error) {
        console.error("Error undoing action:", error);
        // Revert back to the new date on error
        setTasks((prev) =>
          prev.map((t) =>
            t.id === action.taskId ? { ...t, due_date: action.newDate } : t
          )
        );
        toast.error("Fout bij ongedaan maken", {
          description: "Probeer het opnieuw",
        });
      }
    }
  };

  const handleDragStart = (e: React.DragEvent, task: TaskWithProfile) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", task.id);
    // Add a slight delay to allow the drag image to be created
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = "0.5";
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
    setDraggedTask(null);
    setDragOverDate(null);
  };

  const handleDragOver = (e: React.DragEvent, date: Date) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (!dragOverDate || !isSameDay(dragOverDate, date)) {
      setDragOverDate(date);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if we're leaving the drop zone entirely
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
      setDragOverDate(null);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);
    
    if (!draggedTask) return;
    
    const previousDate = draggedTask.due_date;
    const newDueDate = format(targetDate, "yyyy-MM-dd");
    
    // Don't do anything if dropped on the same date
    if (previousDate === newDueDate) {
      setDraggedTask(null);
      return;
    }
    
    // Optimistically update the UI
    setTasks((prev) =>
      prev.map((t) =>
        t.id === draggedTask.id ? { ...t, due_date: newDueDate } : t
      )
    );
    
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ due_date: newDueDate })
        .eq("id", draggedTask.id);

      if (error) throw error;
      
      // Store the action for undo
      const taskName = draggedTask.task_type?.name || "Taak";
      const actionData = {
        type: "task_move" as const,
        taskId: draggedTask.id,
        taskName,
        previousDate,
        newDate: newDueDate,
      };
      setLastAction(actionData);
      
      toast.success("Taak deadline bijgewerkt", {
        description: `"${taskName}" verplaatst naar ${format(targetDate, "d MMMM yyyy", { locale: nl })}`,
        action: {
          label: "Ongedaan maken",
          onClick: () => handleUndoAction(actionData),
        },
        duration: 8000,
      });
    } catch (error) {
      console.error("Error updating task:", error);
      // Revert on error
      setTasks((prev) =>
        prev.map((t) =>
          t.id === draggedTask.id ? { ...t, due_date: draggedTask.due_date } : t
        )
      );
      toast.error("Fout bij verplaatsen taak", {
        description: "Probeer het opnieuw",
      });
    }
    
    setDraggedTask(null);
  };

  // Filter requests based on selected employee, type, and status
  const filteredRequests = useMemo(() => {
    let filtered = requests;
    if (selectedEmployee !== "all") {
      filtered = filtered.filter((r) => r.user_id === selectedEmployee);
    }
    if (selectedType !== "all") {
      filtered = filtered.filter((r) => r.type === selectedType);
    }
    if (selectedStatus !== "all") {
      filtered = filtered.filter((r) => r.status === selectedStatus);
    }
    return filtered;
  }, [requests, selectedEmployee, selectedType, selectedStatus]);

  // Filter tasks based on selected employee
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (selectedEmployee !== "all") {
      filtered = filtered.filter((t) => t.assigned_to === selectedEmployee);
    }
    return filtered;
  }, [tasks, selectedEmployee]);

  const getItemsForDay = (day: Date): CalendarItem[] => {
    const items: CalendarItem[] = [];
    
    if (showTimeOff) {
      filteredRequests.forEach((request) => {
        if (selectedStatus === "all" && request.status === "rejected") return;
        const start = parseISO(request.start_date);
        const end = parseISO(request.end_date);
        if (isWithinInterval(day, { start, end })) {
          items.push({ type: "timeoff", data: request });
        }
      });
    }
    
    if (showTasks) {
      filteredTasks.forEach((task) => {
        if (isSameDay(parseISO(task.due_date), day)) {
          items.push({ type: "task", data: task });
        }
      });
    }
    
    return items;
  };

  const getRequestsForDay = (day: Date): RequestWithProfile[] => {
    if (!showTimeOff) return [];
    return filteredRequests.filter((request) => {
      if (selectedStatus === "all" && request.status === "rejected") return false;
      const start = parseISO(request.start_date);
      const end = parseISO(request.end_date);
      return isWithinInterval(day, { start, end });
    });
  };

  const getTasksForDay = (day: Date): TaskWithProfile[] => {
    if (!showTasks) return [];
    return filteredTasks.filter((task) => isSameDay(parseISO(task.due_date), day));
  };

  const getEmployeeName = (item: RequestWithProfile | TaskWithProfile) => {
    return item.profile?.full_name || item.profile?.email?.split("@")[0] || "Onbekend";
  };

  const getTaskPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive text-destructive-foreground";
      case "medium": return "bg-warning text-warning-foreground";
      case "low": return "bg-muted text-muted-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-success/80 text-success-foreground";
      case "in_progress": return "bg-blue-500/80 text-white";
      case "pending": return "bg-warning/80 text-warning-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  // Get unique employees for legend
  const uniqueEmployees = useMemo(() => {
    const employeeMap = new Map<string, { name: string; color: string }>();
    const colors = [
      "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", 
      "bg-pink-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500"
    ];
    let colorIndex = 0;

    // Add employees from requests
    requests.forEach((request) => {
      if (!employeeMap.has(request.user_id)) {
        const name = getEmployeeName(request);
        employeeMap.set(request.user_id, {
          name,
          color: colors[colorIndex % colors.length]
        });
        colorIndex++;
      }
    });

    // Add employees from tasks
    tasks.forEach((task) => {
      if (!employeeMap.has(task.assigned_to)) {
        const name = getEmployeeName(task);
        employeeMap.set(task.assigned_to, {
          name,
          color: colors[colorIndex % colors.length]
        });
        colorIndex++;
      }
    });

    return Array.from(employeeMap.entries()).map(([userId, data]) => ({
      userId,
      ...data
    }));
  }, [requests, tasks]);

  const getEmployeeColor = (userId: string) => {
    const employee = uniqueEmployees.find((e) => e.userId === userId);
    return employee?.color || "bg-muted";
  };

  const getTypeColor = (type: string, status: string) => {
    if (status === "pending") return "bg-warning/80 text-warning-foreground";
    switch (type) {
      case "vacation": return "bg-primary text-primary-foreground";
      case "sick": return "bg-destructive text-destructive-foreground";
      case "personal": return "bg-accent text-accent-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "vacation": return "Vakantie";
      case "sick": return "Ziekteverlof";
      case "personal": return "Persoonlijk";
      default: return "Overig";
    }
  };

  const navigate = (direction: "prev" | "next") => {
    const modifier = direction === "prev" ? -1 : 1;
    switch (viewType) {
      case "day":
        setCurrentDate(direction === "prev" ? subDays(currentDate, 1) : addDays(currentDate, 1));
        break;
      case "week":
        setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1));
        break;
      case "month":
        setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1));
        break;
      case "year":
        setCurrentDate(direction === "prev" ? subYears(currentDate, 1) : addYears(currentDate, 1));
        break;
    }
  };

  const getDateRangeLabel = () => {
    switch (viewType) {
      case "day":
        return format(currentDate, "EEEE d MMMM yyyy", { locale: nl });
      case "week":
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
        return `Week ${getWeek(currentDate, { weekStartsOn: 1 })} - ${format(weekStart, "d MMM", { locale: nl })} tot ${format(weekEnd, "d MMM yyyy", { locale: nl })}`;
      case "month":
        return format(currentDate, "MMMM yyyy", { locale: nl });
      case "year":
        return format(currentDate, "yyyy", { locale: nl });
    }
  };

  const weekDays = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  // Day View
  const renderDayView = () => {
    const dayRequests = getRequestsForDay(currentDate);
    const dayTasks = getTasksForDay(currentDate);
    const hasItems = dayRequests.length > 0 || dayTasks.length > 0;
    
    return (
      <div className="space-y-4 animate-fade-in">
        <div className={cn(
          "p-8 rounded-2xl border backdrop-blur-sm transition-all duration-300",
          isToday(currentDate) 
            ? "ring-2 ring-primary/50 bg-gradient-to-br from-primary/5 to-primary/10 shadow-lg shadow-primary/10" 
            : "bg-card/80 hover:bg-card"
        )}>
          <div className="text-center mb-6">
            <div className="text-6xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
              {format(currentDate, "d")}
            </div>
            <div className="text-lg text-muted-foreground mt-1 capitalize">
              {format(currentDate, "EEEE", { locale: nl })}
            </div>
          </div>
          
          {!hasItems ? (
            <div className="text-center text-muted-foreground py-12 bg-muted/30 rounded-xl">
              <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-medium">Geen items gepland</p>
              <p className="text-sm opacity-70">voor deze dag</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Time Off Requests */}
              {dayRequests.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <Palmtree className="h-4 w-4" />
                    <span>Verlof</span>
                  </div>
                  {dayRequests.map((request, index) => (
                    <div
                      key={request.id}
                      onClick={(e) => handleItemClick({ type: "timeoff", data: request }, e)}
                      className={cn(
                        "p-4 rounded-xl text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-pointer",
                        getTypeColor(request.type, request.status)
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-3 h-3 rounded-full ring-2 ring-white/30", getEmployeeColor(request.user_id))} />
                          <span className="font-semibold">{getEmployeeName(request)}</span>
                        </div>
                        {request.day_part && request.day_part !== "full_day" && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 text-xs font-medium">
                            {request.day_part === "morning" ? (
                              <Sun className="h-3 w-3" />
                            ) : (
                              <Sunset className="h-3 w-3" />
                            )}
                            <span>{getDayPartLabel(request.day_part)}</span>
                          </div>
                        )}
                      </div>
                      <div className="font-medium mt-2 opacity-90">{getTypeLabel(request.type)}</div>
                      <div className="text-xs opacity-75 mt-1">
                        {format(parseISO(request.start_date), "d MMM", { locale: nl })} — {format(parseISO(request.end_date), "d MMM", { locale: nl })}
                      </div>
                      {request.reason && (
                        <div className="text-xs opacity-60 mt-2 italic">{request.reason}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Tasks */}
              {dayTasks.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                    <ClipboardList className="h-4 w-4" />
                    <span>Taken</span>
                  </div>
                  {dayTasks.map((task, index) => (
                    <div
                      key={task.id}
                      onClick={(e) => handleItemClick({ type: "task", data: task }, e)}
                      className={cn(
                        "p-4 rounded-xl text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md border-l-4 cursor-pointer",
                        getTaskStatusColor(task.status)
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={cn("w-3 h-3 rounded-full ring-2 ring-white/30", getEmployeeColor(task.assigned_to))} />
                          <span className="font-semibold">{getEmployeeName(task)}</span>
                        </div>
                        {hasTimeInfo(task.start_time, task.end_time) && (
                          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 text-xs font-medium">
                            <Clock className="h-3 w-3" />
                            <span>{formatTimeRange(task.start_time, task.end_time)}</span>
                          </div>
                        )}
                      </div>
                      <div className="font-medium mt-2">{task.task_type?.name || "Taak"}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className={cn("text-xs", getTaskPriorityColor(task.priority))}>
                          {task.priority === "high" ? "Hoog" : task.priority === "medium" ? "Gemiddeld" : "Laag"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // Week View
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

    return (
      <div className="space-y-3 animate-fade-in">
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((day, index) => {
            const dayRequests = getRequestsForDay(day);
            const dayTasks = getTasksForDay(day);
            const allItems = [...dayRequests.map(r => ({ type: 'timeoff' as const, item: r })), ...dayTasks.map(t => ({ type: 'task' as const, item: t }))];
            const isCurrentDay = isToday(day);
            const isDragOver = dragOverDate && isSameDay(dragOverDate, day);

            return (
              <div
                key={day.toISOString()}
                onClick={(e) => handleDayClick(day, e)}
                className={cn(
                  "min-h-[140px] p-3 rounded-xl border transition-all duration-300 hover:shadow-md",
                  "bg-card/80 backdrop-blur-sm border-border/50",
                  isCurrentDay && "ring-2 ring-primary/50 bg-gradient-to-br from-primary/5 to-transparent shadow-lg shadow-primary/5",
                  isDragOver && "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.02]",
                  isAdmin && "cursor-pointer"
                )}
                style={{ animationDelay: `${index * 30}ms` }}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
              >
                <div className={cn(
                  "text-sm font-bold mb-3 flex items-center justify-center w-7 h-7 rounded-full",
                  isCurrentDay 
                    ? "bg-primary text-primary-foreground" 
                    : "text-foreground"
                )}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1.5">
                  {allItems.slice(0, 3).map((entry) => (
                    entry.type === 'timeoff' ? (
                      <div
                        key={(entry.item as RequestWithProfile).id}
                        onClick={(e) => handleItemClick({ type: "timeoff", data: entry.item as RequestWithProfile }, e)}
                        className={cn(
                          "text-xs px-2 py-1.5 rounded-lg truncate flex items-center gap-1.5 transition-transform hover:scale-105 cursor-pointer",
                          getTypeColor((entry.item as RequestWithProfile).type, (entry.item as RequestWithProfile).status)
                        )}
                        title={`${getEmployeeName(entry.item as RequestWithProfile)} - ${getTypeLabel((entry.item as RequestWithProfile).type)}${(entry.item as RequestWithProfile).day_part && (entry.item as RequestWithProfile).day_part !== "full_day" ? ` (${getDayPartLabel((entry.item as RequestWithProfile).day_part)})` : ""}`}
                      >
                        {(entry.item as RequestWithProfile).day_part === "morning" ? (
                          <Sun className="w-3 h-3 shrink-0" />
                        ) : (entry.item as RequestWithProfile).day_part === "afternoon" ? (
                          <Sunset className="w-3 h-3 shrink-0" />
                        ) : (
                          <Palmtree className="w-3 h-3 shrink-0" />
                        )}
                        <span className="truncate font-medium">{getEmployeeName(entry.item as RequestWithProfile)}</span>
                      </div>
                    ) : (
                      <div
                        key={(entry.item as TaskWithProfile).id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, entry.item as TaskWithProfile)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handleItemClick({ type: "task", data: entry.item as TaskWithProfile }, e)}
                        className={cn(
                          "text-xs px-2 py-1.5 rounded-lg truncate flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer group",
                          getTaskStatusColor((entry.item as TaskWithProfile).status),
                          draggedTask?.id === (entry.item as TaskWithProfile).id && "opacity-50"
                        )}
                        title={`${(entry.item as TaskWithProfile).task_type?.name || "Taak"}${hasTimeInfo((entry.item as TaskWithProfile).start_time, (entry.item as TaskWithProfile).end_time) ? ` (${formatTimeRange((entry.item as TaskWithProfile).start_time, (entry.item as TaskWithProfile).end_time)})` : ""}`}
                      >
                        {hasTimeInfo((entry.item as TaskWithProfile).start_time, (entry.item as TaskWithProfile).end_time) ? (
                          <Clock className="w-3 h-3 shrink-0 opacity-70" />
                        ) : (
                          <GripVertical className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 cursor-grab" />
                        )}
                        <ClipboardList className="w-3 h-3 shrink-0" />
                        <span className="truncate font-medium">
                          {hasTimeInfo((entry.item as TaskWithProfile).start_time, (entry.item as TaskWithProfile).end_time) && (
                            <span className="opacity-80 mr-1">{formatTimeRange((entry.item as TaskWithProfile).start_time, (entry.item as TaskWithProfile).end_time)}</span>
                          )}
                          {(entry.item as TaskWithProfile).task_type?.name || "Taak"}
                        </span>
                      </div>
                    )
                  ))}
                  {allItems.length > 3 && (
                    <div className="text-xs text-primary font-medium pl-1">
                      +{allItems.length - 3} meer
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Month View
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

    return (
      <div className="space-y-3 animate-fade-in">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wider">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {days.map((day, index) => {
            const dayRequests = getRequestsForDay(day);
            const dayTasks = getTasksForDay(day);
            const allItems = [...dayRequests.map(r => ({ type: 'timeoff' as const, item: r })), ...dayTasks.map(t => ({ type: 'task' as const, item: t }))];
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);
            const isDragOver = dragOverDate && isSameDay(dragOverDate, day);

            return (
              <div
                key={day.toISOString()}
                onClick={(e) => isCurrentMonth && handleDayClick(day, e)}
                className={cn(
                  "min-h-[90px] p-2 rounded-xl border transition-all duration-200",
                  isCurrentMonth 
                    ? "bg-card/80 backdrop-blur-sm border-border/50 hover:bg-card hover:shadow-sm" 
                    : "bg-muted/20 border-transparent opacity-50",
                  isCurrentDay && "ring-2 ring-primary/50 bg-gradient-to-br from-primary/5 to-transparent",
                  isDragOver && "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.02]",
                  isCurrentMonth && isAdmin && "cursor-pointer"
                )}
                onDragOver={(e) => handleDragOver(e, day)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, day)}
              >
                <div className={cn(
                  "text-xs font-bold mb-1.5 flex items-center justify-center w-6 h-6 rounded-full transition-colors",
                  isCurrentDay 
                    ? "bg-primary text-primary-foreground" 
                    : isCurrentMonth 
                      ? "text-foreground" 
                      : "text-muted-foreground/50"
                )}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {allItems.slice(0, 2).map((entry) => (
                    entry.type === 'timeoff' ? (
                      <div
                        key={(entry.item as RequestWithProfile).id}
                        onClick={(e) => handleItemClick({ type: "timeoff", data: entry.item as RequestWithProfile }, e)}
                        className={cn(
                          "text-[10px] px-1.5 py-1 rounded-md truncate flex items-center gap-1 transition-transform hover:scale-105 cursor-pointer",
                          getTypeColor((entry.item as RequestWithProfile).type, (entry.item as RequestWithProfile).status)
                        )}
                        title={`${getEmployeeName(entry.item as RequestWithProfile)}${(entry.item as RequestWithProfile).day_part && (entry.item as RequestWithProfile).day_part !== "full_day" ? ` (${getDayPartLabel((entry.item as RequestWithProfile).day_part)})` : ""}`}
                      >
                        {(entry.item as RequestWithProfile).day_part === "morning" ? (
                          <Sun className="w-2.5 h-2.5 shrink-0" />
                        ) : (entry.item as RequestWithProfile).day_part === "afternoon" ? (
                          <Sunset className="w-2.5 h-2.5 shrink-0" />
                        ) : (
                          <Palmtree className="w-2.5 h-2.5 shrink-0" />
                        )}
                        <span className="truncate font-medium">{getEmployeeName(entry.item as RequestWithProfile)}</span>
                      </div>
                    ) : (
                      <div
                        key={(entry.item as TaskWithProfile).id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, entry.item as TaskWithProfile)}
                        onDragEnd={handleDragEnd}
                        onClick={(e) => handleItemClick({ type: "task", data: entry.item as TaskWithProfile }, e)}
                        className={cn(
                          "text-[10px] px-1.5 py-1 rounded-md truncate flex items-center gap-1 transition-all hover:scale-105 cursor-pointer group",
                          getTaskStatusColor((entry.item as TaskWithProfile).status),
                          draggedTask?.id === (entry.item as TaskWithProfile).id && "opacity-50"
                        )}
                        title={`${(entry.item as TaskWithProfile).task_type?.name || "Taak"}${hasTimeInfo((entry.item as TaskWithProfile).start_time, (entry.item as TaskWithProfile).end_time) ? ` (${formatTimeRange((entry.item as TaskWithProfile).start_time, (entry.item as TaskWithProfile).end_time)})` : ""}`}
                      >
                        {hasTimeInfo((entry.item as TaskWithProfile).start_time, (entry.item as TaskWithProfile).end_time) ? (
                          <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" />
                        ) : (
                          <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-50 group-hover:opacity-100 cursor-grab" />
                        )}
                        <ClipboardList className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate font-medium">
                          {hasTimeInfo((entry.item as TaskWithProfile).start_time, (entry.item as TaskWithProfile).end_time) && (
                            <span className="opacity-80 mr-0.5">{formatTimeRange((entry.item as TaskWithProfile).start_time, (entry.item as TaskWithProfile).end_time)}</span>
                          )}
                          {(entry.item as TaskWithProfile).task_type?.name || "Taak"}
                        </span>
                      </div>
                    )
                  ))}
                  {allItems.length > 2 && (
                    <div className="text-[10px] text-primary font-semibold pl-1">
                      +{allItems.length - 2}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Year View
  const renderYearView = () => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-fade-in">
        {months.map((month, index) => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
          
          const monthRequests = showTimeOff ? filteredRequests.filter((request) => {
            if (request.status === "rejected") return false;
            const start = parseISO(request.start_date);
            const end = parseISO(request.end_date);
            return monthDays.some(day => isWithinInterval(day, { start, end }));
          }) : [];

          const monthTasks = showTasks ? filteredTasks.filter((task) => {
            const dueDate = parseISO(task.due_date);
            return monthDays.some(day => isSameDay(day, dueDate));
          }) : [];

          const totalItems = monthRequests.length + monthTasks.length;
          const isCurrentMonth = isSameMonth(month, new Date());

          return (
            <Card 
              key={month.toISOString()} 
              className={cn(
                "cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden group",
                isCurrentMonth && "ring-2 ring-primary/50 shadow-lg shadow-primary/10"
              )}
              onClick={() => {
                setCurrentDate(month);
                setViewType("month");
              }}
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className={cn(
                "h-1 w-full transition-all duration-300",
                isCurrentMonth ? "gradient-primary" : "bg-border group-hover:bg-primary/50"
              )} />
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-base font-semibold capitalize">
                  {format(month, "MMMM", { locale: nl })}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {totalItems === 0 ? (
                  <div className="text-xs text-muted-foreground italic">Geen items gepland</div>
                ) : (
                  <div className="space-y-1.5">
                    {monthRequests.slice(0, 1).map((request) => (
                      <Badge
                        key={request.id}
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 w-fit",
                          getTypeColor(request.type, request.status)
                        )}
                      >
                        <Palmtree className="w-2.5 h-2.5" />
                        {getTypeLabel(request.type)}
                      </Badge>
                    ))}
                    {monthTasks.slice(0, 1).map((task) => (
                      <Badge
                        key={task.id}
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 w-fit",
                          getTaskStatusColor(task.status)
                        )}
                      >
                        <ClipboardList className="w-2.5 h-2.5" />
                        {(task.task_type?.name || "Taak").substring(0, 15)}{(task.task_type?.name || "Taak").length > 15 ? '...' : ''}
                      </Badge>
                    ))}
                    {totalItems > 2 && (
                      <div className="text-xs text-primary font-semibold">
                        +{totalItems - 2} meer
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // Fullscreen View - Convert data to FullScreenCalendar format
  const renderFullscreenView = () => {
    // Transform filtered data into CalendarData format
    const calendarData: CalendarData[] = [];
    const dateMap = new Map<string, CalendarEvent[]>();

    // Add time-off requests
    if (showTimeOff) {
      filteredRequests.forEach((request) => {
        if (selectedStatus === "all" && request.status === "rejected") return;
        
        const start = parseISO(request.start_date);
        const end = parseISO(request.end_date);
        const days = eachDayOfInterval({ start, end });
        
        days.forEach((day) => {
          const dateKey = format(day, "yyyy-MM-dd");
          const events = dateMap.get(dateKey) || [];
          
          const dayPartLabel = request.day_part && request.day_part !== "full_day" 
            ? ` (${getDayPartLabel(request.day_part)})` 
            : "";
          
          events.push({
            id: `timeoff-${request.id}-${dateKey}`,
            name: `${getEmployeeName(request)} - ${getTypeLabel(request.type)}${dayPartLabel}`,
            time: request.day_part === "morning" ? "Ochtend" : request.day_part === "afternoon" ? "Middag" : "Hele dag",
            datetime: request.start_date,
            color: request.status === "pending" 
              ? "bg-warning/20 text-warning-foreground" 
              : request.type === "vacation" 
                ? "bg-primary/20 text-primary" 
                : request.type === "sick" 
                  ? "bg-destructive/20 text-destructive" 
                  : "bg-accent/20 text-accent-foreground"
          });
          
          dateMap.set(dateKey, events);
        });
      });
    }

    // Add tasks
    if (showTasks) {
      filteredTasks.forEach((task) => {
        const dateKey = task.due_date;
        const events = dateMap.get(dateKey) || [];
        
        const timeLabel = hasTimeInfo(task.start_time, task.end_time) 
          ? formatTimeRange(task.start_time, task.end_time)
          : task.status === "completed" ? "Voltooid" : task.status === "in_progress" ? "Bezig" : "Te doen";
        
        events.push({
          id: `task-${task.id}`,
          name: `${task.task_type?.name || "Taak"} - ${getEmployeeName(task)}`,
          time: timeLabel,
          datetime: task.due_date,
          color: task.status === "completed" 
            ? "bg-success/20 text-success" 
            : task.status === "in_progress" 
              ? "bg-blue-500/20 text-blue-600" 
              : "bg-warning/20 text-warning-foreground"
        });
        
        dateMap.set(dateKey, events);
      });
    }

    // Convert map to array
    dateMap.forEach((events, dateKey) => {
      calendarData.push({
        day: parseISO(dateKey),
        events
      });
    });

    const handleFullscreenDayClick = (day: Date) => {
      if (isAdmin) {
        setCreateDate(day);
        setShowCreateMenu(true);
      }
    };

    const handleFullscreenEventClick = (event: CalendarEvent) => {
      const eventId = String(event.id);
      
      if (eventId.startsWith("timeoff-")) {
        const requestId = eventId.split("-")[1];
        const request = requests.find(r => r.id === requestId);
        if (request) {
          setSelectedItem({ type: "timeoff", data: request });
          setDialogOpen(true);
        }
      } else if (eventId.startsWith("task-")) {
        const taskId = eventId.replace("task-", "");
        const task = tasks.find(t => t.id === taskId);
        if (task) {
          setSelectedItem({ type: "task", data: task });
          setDialogOpen(true);
        }
      }
    };

    const handleNewEvent = () => {
      if (isAdmin) {
        setCreateDate(new Date());
        setShowCreateMenu(true);
      }
    };

    return (
      <div className="h-[700px] animate-fade-in">
        <FullScreenCalendar 
          data={calendarData}
          onDayClick={handleFullscreenDayClick}
          onEventClick={handleFullscreenEventClick}
          onNewEvent={isAdmin ? handleNewEvent : undefined}
        />
      </div>
    );
  };

  return (
    <Card className="shadow-2xl border-0 bg-card/90 backdrop-blur-xl overflow-hidden">
      {/* Decorative gradient bar */}
      <div className="h-1.5 w-full gradient-primary" />
      
      <CardHeader className="pb-6 pt-6">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-3 text-xl font-bold">
                <div className="p-2 rounded-xl bg-primary/10">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                Kalenderoverzicht
              </CardTitle>
              <CardDescription className="mt-1.5 text-muted-foreground">
                Bekijk alle verlofaanvragen en taken van het team
              </CardDescription>
            </div>
            
            {/* Show/Hide Toggle */}
            <div className="flex items-center gap-4 p-2 rounded-lg bg-muted/30 border border-border/50">
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="showTimeOff" 
                  checked={showTimeOff} 
                  onCheckedChange={(checked) => setShowTimeOff(checked as boolean)}
                />
                <label htmlFor="showTimeOff" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <Palmtree className="h-3.5 w-3.5 text-primary" />
                  Verlof
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox 
                  id="showTasks" 
                  checked={showTasks} 
                  onCheckedChange={(checked) => setShowTasks(checked as boolean)}
                />
                <label htmlFor="showTasks" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
                  Taken
                </label>
              </div>
            </div>
            
            <ToggleGroup 
              type="single" 
              value={viewType} 
              onValueChange={(value) => value && setViewType(value as ViewType)}
              className="bg-muted/50 p-1 rounded-xl"
            >
              <ToggleGroupItem value="day" aria-label="Dagweergave" className="text-xs px-3 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm">
                <List className="h-4 w-4 mr-1.5" />
                Dag
              </ToggleGroupItem>
              <ToggleGroupItem value="week" aria-label="Weekweergave" className="text-xs px-3 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm">
                <Grid3X3 className="h-4 w-4 mr-1.5" />
                Week
              </ToggleGroupItem>
              <ToggleGroupItem value="month" aria-label="Maandweergave" className="text-xs px-3 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm">
                <CalendarIcon className="h-4 w-4 mr-1.5" />
                Maand
              </ToggleGroupItem>
              <ToggleGroupItem value="year" aria-label="Jaarweergave" className="text-xs px-3 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm">
                <LayoutGrid className="h-4 w-4 mr-1.5" />
                Jaar
              </ToggleGroupItem>
              <ToggleGroupItem value="fullscreen" aria-label="Fullscreen weergave" className="text-xs px-3 rounded-lg data-[state=on]:bg-background data-[state=on]:shadow-sm">
                <Maximize2 className="h-4 w-4 mr-1.5" />
                Volledig
              </ToggleGroupItem>
            </ToggleGroup>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border/50">
            {/* Employee Filter */}
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger className="w-[180px] bg-background border-border/50 shadow-sm hover:bg-background/80 transition-colors">
                  <SelectValue placeholder="Filter op medewerker" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-xl z-50">
                  <SelectItem value="all">Alle medewerkers</SelectItem>
                  {uniqueEmployees.map((employee) => (
                    <SelectItem key={employee.userId} value={employee.userId}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", employee.color)} />
                        {employee.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Type Filter */}
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-[160px] bg-background border-border/50 shadow-sm hover:bg-background/80 transition-colors">
                  <SelectValue placeholder="Filter op type" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-xl z-50">
                  <SelectItem value="all">Alle types</SelectItem>
                  {leaveTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded", type.color)} />
                        {type.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <List className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[160px] bg-background border-border/50 shadow-sm hover:bg-background/80 transition-colors">
                  <SelectValue placeholder="Filter op status" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-xl z-50">
                  <SelectItem value="all">Alle statussen</SelectItem>
                  {statusTypes.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded", status.color)} />
                        {status.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reset Button */}
            {(selectedEmployee !== "all" || selectedType !== "all" || selectedStatus !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSelectedEmployee("all");
                  setSelectedType("all");
                  setSelectedStatus("all");
                }}
                className="text-xs text-primary hover:text-primary hover:bg-primary/10"
              >
                Reset filters
              </Button>
            )}
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 p-3 rounded-xl bg-muted/30 border border-border/50">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg hover:bg-background"
              onClick={() => navigate("prev")}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentDate(new Date())}
              className="text-xs font-medium border-primary/30 text-primary hover:bg-primary/10"
            >
              Vandaag
            </Button>
          </div>
          <span className="text-base font-semibold capitalize text-foreground">
            {getDateRangeLabel()}
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 rounded-lg hover:bg-background"
            onClick={() => navigate("next")}
          >
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary/20 border-t-primary"></div>
            </div>
            <p className="text-sm text-muted-foreground mt-4">Laden...</p>
          </div>
        ) : (
          <>
            {viewType === "day" && renderDayView()}
            {viewType === "week" && renderWeekView()}
            {viewType === "month" && renderMonthView()}
            {viewType === "year" && renderYearView()}
            {viewType === "fullscreen" && renderFullscreenView()}
          </>
        )}

        {/* Type Legend */}
        <div className="mt-8 pt-6 border-t border-border/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Leave Types Legend */}
            {showTimeOff && (
              <div>
                <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Palmtree className="h-4 w-4 text-primary" />
                  Verlof types
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="w-3 h-3 rounded-md bg-primary shadow-sm" />
                    <span className="text-muted-foreground font-medium">Vakantie</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="w-3 h-3 rounded-md bg-destructive shadow-sm" />
                    <span className="text-muted-foreground font-medium">Ziekteverlof</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="w-3 h-3 rounded-md bg-accent shadow-sm" />
                    <span className="text-muted-foreground font-medium">Persoonlijk</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="w-3 h-3 rounded-md bg-warning/80 shadow-sm" />
                    <span className="text-muted-foreground font-medium">In behandeling</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Task Status Legend */}
            {showTasks && (
              <div>
                <div className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <ClipboardList className="h-4 w-4 text-blue-500" />
                  Taak status
                </div>
                <div className="flex flex-wrap gap-4">
                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="w-3 h-3 rounded-md bg-warning/80 shadow-sm" />
                    <span className="text-muted-foreground font-medium">Te doen</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="w-3 h-3 rounded-md bg-blue-500/80 shadow-sm" />
                    <span className="text-muted-foreground font-medium">Bezig</span>
                  </div>
                  <div className="flex items-center gap-2.5 text-sm">
                    <div className="w-3 h-3 rounded-md bg-success/80 shadow-sm" />
                    <span className="text-muted-foreground font-medium">Voltooid</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Employee Legend */}
        {uniqueEmployees.length > 0 && (
          <div className="mt-6 pt-6 border-t border-border/50">
            <div className="text-sm font-semibold text-foreground mb-3">Medewerkers</div>
            <div className="flex flex-wrap gap-4">
              {uniqueEmployees.map((employee) => (
                <div 
                  key={employee.userId} 
                  className="flex items-center gap-2.5 text-sm px-3 py-1.5 rounded-full bg-muted/50 border border-border/50"
                >
                  <div className={cn("w-2.5 h-2.5 rounded-full ring-2 ring-white/50", employee.color)} />
                  <span className="text-muted-foreground font-medium">{employee.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
      
      {/* Calendar Item Dialog */}
      <CalendarItemDialog
        item={selectedItem}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onUpdate={handleDialogUpdate}
        isAdmin={isAdmin}
        profiles={profiles}
      />
      
      {/* Create Menu Dialog */}
      <Dialog open={showCreateMenu} onOpenChange={setShowCreateMenu}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5 text-primary" />
              Nieuw item aanmaken
            </DialogTitle>
            <DialogDescription>
              Wat wil je aanmaken voor {createDate ? format(createDate, "d MMMM yyyy", { locale: nl }) : "deze dag"}?
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4 py-4">
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30"
              onClick={handleCreateTask}
            >
              <ClipboardList className="h-8 w-8 text-blue-500" />
              <span className="font-medium">Taak</span>
            </Button>
            <Button
              variant="outline"
              className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/30"
              onClick={handleCreateLeave}
            >
              <Palmtree className="h-8 w-8 text-primary" />
              <span className="font-medium">Verlof</span>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Create Task Dialog */}
      <CreateTaskDialog
        open={createTaskDialogOpen}
        onOpenChange={setCreateTaskDialogOpen}
        onCreate={handleTaskCreated}
        initialDate={createDate}
        profiles={profiles}
        currentUserId={currentUserId}
      />
      
      {/* Create Leave Request Dialog */}
      <CreateLeaveRequestDialog
        open={createLeaveDialogOpen}
        onOpenChange={setCreateLeaveDialogOpen}
        onCreate={handleTaskCreated}
        initialDate={createDate}
        profiles={profiles}
        currentUserId={currentUserId}
        isAdmin={isAdmin}
      />
    </Card>
  );
}
