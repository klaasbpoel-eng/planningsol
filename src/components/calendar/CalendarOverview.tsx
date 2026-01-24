import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
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
  GripVertical
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

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

type RequestWithProfile = TimeOffRequest & {
  profile?: Profile | null;
};

type TaskWithProfile = Task & {
  profile?: Profile | null;
};

type ViewType = "day" | "week" | "month" | "year";
type CalendarItem = 
  | { type: "timeoff"; data: RequestWithProfile }
  | { type: "task"; data: TaskWithProfile };

export function CalendarOverview() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>("month");
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [tasks, setTasks] = useState<TaskWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [showTimeOff, setShowTimeOff] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [draggedTask, setDraggedTask] = useState<TaskWithProfile | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);

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

      // Map profiles to requests
      const requestsWithProfiles: RequestWithProfile[] = (requestsData || []).map((request) => {
        const profile = profilesData?.find((p) => p.user_id === request.user_id) || null;
        return { ...request, profile };
      });

      // Map profiles to tasks
      const tasksWithProfiles: TaskWithProfile[] = (tasksData || []).map((task) => {
        const profile = profilesData?.find((p) => p.user_id === task.assigned_to) || null;
        return { ...task, profile };
      });

      setRequests(requestsWithProfiles);
      setTasks(tasksWithProfiles);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  // Drag and drop handlers
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
    
    const newDueDate = format(targetDate, "yyyy-MM-dd");
    
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
      
      toast.success("Taak deadline bijgewerkt", {
        description: `"${draggedTask.title}" verplaatst naar ${format(targetDate, "d MMMM yyyy", { locale: nl })}`,
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
                      className={cn(
                        "p-4 rounded-xl text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md",
                        getTypeColor(request.type, request.status)
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-3 h-3 rounded-full ring-2 ring-white/30", getEmployeeColor(request.user_id))} />
                        <span className="font-semibold">{getEmployeeName(request)}</span>
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
                      className={cn(
                        "p-4 rounded-xl text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md border-l-4",
                        getTaskStatusColor(task.status)
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("w-3 h-3 rounded-full ring-2 ring-white/30", getEmployeeColor(task.assigned_to))} />
                        <span className="font-semibold">{getEmployeeName(task)}</span>
                      </div>
                      <div className="font-medium mt-2">{task.title}</div>
                      {task.description && (
                        <div className="text-xs opacity-75 mt-1 line-clamp-2">{task.description}</div>
                      )}
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
                className={cn(
                  "min-h-[140px] p-3 rounded-xl border transition-all duration-300 hover:shadow-md",
                  "bg-card/80 backdrop-blur-sm border-border/50",
                  isCurrentDay && "ring-2 ring-primary/50 bg-gradient-to-br from-primary/5 to-transparent shadow-lg shadow-primary/5",
                  isDragOver && "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.02]"
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
                        className={cn(
                          "text-xs px-2 py-1.5 rounded-lg truncate flex items-center gap-1.5 transition-transform hover:scale-105",
                          getTypeColor((entry.item as RequestWithProfile).type, (entry.item as RequestWithProfile).status)
                        )}
                      >
                        <Palmtree className="w-3 h-3 shrink-0" />
                        <span className="truncate font-medium">{getEmployeeName(entry.item as RequestWithProfile)}</span>
                      </div>
                    ) : (
                      <div
                        key={(entry.item as TaskWithProfile).id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, entry.item as TaskWithProfile)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "text-xs px-2 py-1.5 rounded-lg truncate flex items-center gap-1.5 transition-all hover:scale-105 cursor-grab active:cursor-grabbing group",
                          getTaskStatusColor((entry.item as TaskWithProfile).status),
                          draggedTask?.id === (entry.item as TaskWithProfile).id && "opacity-50"
                        )}
                      >
                        <GripVertical className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100" />
                        <ClipboardList className="w-3 h-3 shrink-0" />
                        <span className="truncate font-medium">{(entry.item as TaskWithProfile).title}</span>
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
                className={cn(
                  "min-h-[90px] p-2 rounded-xl border transition-all duration-200",
                  isCurrentMonth 
                    ? "bg-card/80 backdrop-blur-sm border-border/50 hover:bg-card hover:shadow-sm" 
                    : "bg-muted/20 border-transparent opacity-50",
                  isCurrentDay && "ring-2 ring-primary/50 bg-gradient-to-br from-primary/5 to-transparent",
                  isDragOver && "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.02]"
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
                        className={cn(
                          "text-[10px] px-1.5 py-1 rounded-md truncate flex items-center gap-1 transition-transform hover:scale-105",
                          getTypeColor((entry.item as RequestWithProfile).type, (entry.item as RequestWithProfile).status)
                        )}
                      >
                        <Palmtree className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate font-medium">{getEmployeeName(entry.item as RequestWithProfile)}</span>
                      </div>
                    ) : (
                      <div
                        key={(entry.item as TaskWithProfile).id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, entry.item as TaskWithProfile)}
                        onDragEnd={handleDragEnd}
                        className={cn(
                          "text-[10px] px-1.5 py-1 rounded-md truncate flex items-center gap-1 transition-all hover:scale-105 cursor-grab active:cursor-grabbing group",
                          getTaskStatusColor((entry.item as TaskWithProfile).status),
                          draggedTask?.id === (entry.item as TaskWithProfile).id && "opacity-50"
                        )}
                      >
                        <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-50 group-hover:opacity-100" />
                        <ClipboardList className="w-2.5 h-2.5 shrink-0" />
                        <span className="truncate font-medium">{(entry.item as TaskWithProfile).title}</span>
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
                        {task.title.substring(0, 15)}{task.title.length > 15 ? '...' : ''}
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
    </Card>
  );
}
