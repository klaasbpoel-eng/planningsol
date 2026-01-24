import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  ListTodo,
} from "lucide-react";
import { format, parseISO, isPast, isToday } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { TaskFormDialog } from "./TaskFormDialog";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];
type TaskType = Database["public"]["Tables"]["task_types"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface TaskWithRelations extends Task {
  profiles?: Profile | null;
  task_types?: TaskType | null;
}

export function TaskList() {
  const [tasks, setTasks] = useState<TaskWithRelations[]>([]);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [loading, setLoading] = useState(true);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState<"create" | "edit">("create");
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch tasks
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .order("due_date", { ascending: true });

      if (tasksError) throw tasksError;

      // Fetch employees
      const { data: employeesData, error: employeesError } = await supabase
        .from("profiles")
        .select("*");

      if (employeesError) throw employeesError;

      // Fetch task types
      const { data: typesData, error: typesError } = await supabase
        .from("task_types")
        .select("*")
        .eq("is_active", true);

      if (typesError) throw typesError;

      // Map relations
      const tasksWithRelations: TaskWithRelations[] = (tasksData || []).map((task) => {
        const profile = employeesData?.find((e) => e.user_id === task.assigned_to) || null;
        const taskType = typesData?.find((t) => t.id === task.type_id) || null;
        return { ...task, profiles: profile, task_types: taskType };
      });

      setTasks(tasksWithRelations);
      setEmployees(employeesData || []);
      setTaskTypes(typesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Fout bij laden van taken");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTask = () => {
    setSelectedTask(null);
    setFormMode("create");
    setFormDialogOpen(true);
  };

  const handleEditTask = (task: Task) => {
    setSelectedTask(task);
    setFormMode("edit");
    setFormDialogOpen(true);
  };

  const handleDeleteClick = (task: Task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;

    setDeleting(true);
    try {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", taskToDelete.id);

      if (error) throw error;

      toast.success("Taak verwijderd");
      fetchData();
    } catch (error) {
      console.error("Error deleting task:", error);
      toast.error("Fout bij verwijderen van taak");
    } finally {
      setDeleting(false);
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    }
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus })
        .eq("id", task.id);

      if (error) throw error;

      toast.success("Status bijgewerkt");
      fetchData();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Fout bij bijwerken van status");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "in_progress":
        return <Clock className="h-4 w-4 text-warning" />;
      default:
        return <ListTodo className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Voltooid";
      case "in_progress":
        return "In uitvoering";
      default:
        return "In afwachting";
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/10 text-success border-success/20";
      case "in_progress":
        return "bg-warning/10 text-warning border-warning/20";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getPriorityStyle = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive/10 text-destructive border-destructive/20";
      case "medium":
        return "bg-warning/10 text-warning border-warning/20";
      default:
        return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high":
        return "Hoog";
      case "medium":
        return "Medium";
      default:
        return "Laag";
    }
  };

  const getEmployeeName = (task: TaskWithRelations) => {
    return task.profiles?.full_name || task.profiles?.email?.split("@")[0] || "Onbekend";
  };

  const getDueDateStyle = (dueDate: string, status: string) => {
    if (status === "completed") return "text-muted-foreground";
    const date = parseISO(dueDate);
    if (isPast(date) && !isToday(date)) return "text-destructive font-medium";
    if (isToday(date)) return "text-warning font-medium";
    return "text-muted-foreground";
  };

  const filteredTasks = statusFilter === "all" 
    ? tasks 
    : tasks.filter((t) => t.status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Taken</h2>
          <p className="text-muted-foreground">
            Beheer taken en wijs ze toe aan medewerkers
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle statussen</SelectItem>
              <SelectItem value="pending">In afwachting</SelectItem>
              <SelectItem value="in_progress">In uitvoering</SelectItem>
              <SelectItem value="completed">Voltooid</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={handleCreateTask}>
            <Plus className="h-4 w-4 mr-2" />
            Nieuwe Taak
          </Button>
        </div>
      </div>

      {/* Tasks Grid */}
      {filteredTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-1">Geen taken gevonden</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {statusFilter === "all"
                ? "Maak een nieuwe taak aan om te beginnen."
                : "Geen taken met deze status."}
            </p>
            {statusFilter === "all" && (
              <Button onClick={handleCreateTask} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Eerste Taak Aanmaken
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTasks.map((task) => (
            <Card
              key={task.id}
              className={cn(
                "transition-all hover:shadow-md",
                task.status === "completed" && "opacity-70"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold line-clamp-2">
                      {task.title}
                    </CardTitle>
                    {task.task_types && (
                      <div className="flex items-center gap-1.5 mt-1">
                        <div
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ backgroundColor: task.task_types.color }}
                        />
                        <span className="text-xs text-muted-foreground">
                          {task.task_types.name}
                        </span>
                      </div>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleEditTask(task)}>
                        <Pencil className="h-4 w-4 mr-2" />
                        Bewerken
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(task)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Verwijderen
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {task.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {task.description}
                  </p>
                )}

                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className={getStatusStyle(task.status)}>
                    {getStatusIcon(task.status)}
                    <span className="ml-1">{getStatusLabel(task.status)}</span>
                  </Badge>
                  <Badge variant="outline" className={getPriorityStyle(task.priority)}>
                    {task.priority === "high" && <AlertCircle className="h-3 w-3 mr-1" />}
                    {getPriorityLabel(task.priority)}
                  </Badge>
                </div>

                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-sm font-medium truncate">
                    {getEmployeeName(task)}
                  </span>
                  <span className={cn("text-xs", getDueDateStyle(task.due_date, task.status))}>
                    {format(parseISO(task.due_date), "d MMM yyyy", { locale: nl })}
                  </span>
                </div>

                {/* Quick status change */}
                {task.status !== "completed" && (
                  <div className="pt-2">
                    <Select
                      value={task.status}
                      onValueChange={(value) => handleStatusChange(task, value)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">In afwachting</SelectItem>
                        <SelectItem value="in_progress">In uitvoering</SelectItem>
                        <SelectItem value="completed">Voltooid</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Form Dialog */}
      <TaskFormDialog
        task={selectedTask}
        employees={employees}
        taskTypes={taskTypes}
        open={formDialogOpen}
        onOpenChange={setFormDialogOpen}
        onUpdate={fetchData}
        mode={formMode}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Taak Verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je de taak "{taskToDelete?.title}" wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
