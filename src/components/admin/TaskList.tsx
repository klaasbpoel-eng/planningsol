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
  Filter,
} from "lucide-react";
import { format, parseISO, isPast, isToday, isBefore, isAfter, startOfDay } from "date-fns";
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
  const [taskToDelete, setTaskToDelete] = useState<TaskWithRelations | null>(null);
  const [deleteSeriesMode, setDeleteSeriesMode] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [taskTypeFilter, setTaskTypeFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

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

  const handleDeleteClick = (task: TaskWithRelations) => {
    setTaskToDelete(task);
    setDeleteSeriesMode(false);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!taskToDelete) return;

    setDeleting(true);
    try {
      if (deleteSeriesMode && taskToDelete.series_id) {
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("series_id", taskToDelete.series_id);
        if (error) throw error;
        toast.success("Gehele reeks verwijderd");
      } else {
        const { error } = await supabase
          .from("tasks")
          .delete()
          .eq("id", taskToDelete.id);
        if (error) throw error;
        toast.success("Taak verwijderd");
      }
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

  const handleDeleteAllConfirm = async () => {
    setDeletingAll(true);
    try {
      const idsToDelete = filteredTasks.map((t) => t.id);
      const { error } = await supabase
        .from("tasks")
        .delete()
        .in("id", idsToDelete);

      if (error) throw error;

      toast.success(`${idsToDelete.length} taken verwijderd`);
      fetchData();
    } catch (error) {
      console.error("Error deleting all tasks:", error);
      toast.error("Fout bij verwijderen van taken");
    } finally {
      setDeletingAll(false);
      setDeleteAllDialogOpen(false);
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
    if (!task.assigned_to) return "Iedereen";
    return task.profiles?.full_name || task.profiles?.email?.split("@")[0] || "Onbekend";
  };

  const getDueDateStyle = (dueDate: string, status: string) => {
    if (status === "completed") return "text-muted-foreground";
    const date = parseISO(dueDate);
    if (isPast(date) && !isToday(date)) return "text-destructive font-medium";
    if (isToday(date)) return "text-warning font-medium";
    return "text-muted-foreground";
  };

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (employeeFilter !== "all" && t.assigned_to !== employeeFilter) return false;
    if (taskTypeFilter !== "all" && t.type_id !== taskTypeFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    return true;
  });

  const activeFilterCount = [statusFilter, employeeFilter, taskTypeFilter, priorityFilter].filter(f => f !== "all").length;

  const clearFilters = () => {
    setStatusFilter("all");
    setEmployeeFilter("all");
    setTaskTypeFilter("all");
    setPriorityFilter("all");
  };

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
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Taken</h2>
            <p className="text-muted-foreground">
              Beheer taken en wijs ze toe aan medewerkers
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="relative"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filters
              {activeFilterCount > 0 && (
                <Badge className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                  {activeFilterCount}
                </Badge>
              )}
            </Button>
            {filteredTasks.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/30 hover:bg-destructive/10"
                onClick={() => setDeleteAllDialogOpen(true)}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Verwijderen ({filteredTasks.length})
              </Button>
            )}
            <Button onClick={handleCreateTask}>
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe Taak
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-lg border animate-fade-in">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle statussen</SelectItem>
                <SelectItem value="pending">In afwachting</SelectItem>
                <SelectItem value="in_progress">In uitvoering</SelectItem>
                <SelectItem value="completed">Voltooid</SelectItem>
              </SelectContent>
            </Select>

            <Select value={employeeFilter} onValueChange={setEmployeeFilter}>
              <SelectTrigger className="w-[170px] h-9 text-sm">
                <SelectValue placeholder="Medewerker" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle medewerkers</SelectItem>
                {employees
                  .filter((e) => e.full_name)
                  .sort((a, b) => (a.full_name || "").localeCompare(b.full_name || ""))
                  .map((e) => (
                    <SelectItem key={e.user_id || e.id} value={e.user_id || e.id}>
                      {e.full_name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={taskTypeFilter} onValueChange={setTaskTypeFilter}>
              <SelectTrigger className="w-[150px] h-9 text-sm">
                <SelectValue placeholder="Taaktype" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle types</SelectItem>
                {taskTypes.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="Prioriteit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle prioriteiten</SelectItem>
                <SelectItem value="high">Hoog</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="low">Laag</SelectItem>
              </SelectContent>
            </Select>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground">
                Filters wissen
              </Button>
            )}

            <span className="text-sm text-muted-foreground ml-auto">
              {filteredTasks.length} van {tasks.length} taken
            </span>
          </div>
        )}
      </div>

      {/* Tasks Grid */}
      {filteredTasks.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ListTodo className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-1">Geen taken gevonden</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {activeFilterCount > 0
                ? "Geen taken met deze filters."
                : "Maak een nieuwe taak aan om te beginnen."}
            </p>
            {activeFilterCount > 0 ? (
              <Button onClick={clearFilters} variant="outline">
                Filters wissen
              </Button>
            ) : (
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
                      {task.task_types?.name || "Taak"}
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
              {deleteSeriesMode
                ? "Weet je zeker dat je de gehele reeks wilt verwijderen? Alle taken in deze reeks worden verwijderd."
                : "Weet je zeker dat je deze taak wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {taskToDelete?.series_id && (
            <div className="flex items-center space-x-2 px-6">
              <input
                type="checkbox"
                id="deleteSeriesCheckbox"
                checked={deleteSeriesMode}
                onChange={(e) => setDeleteSeriesMode(e.target.checked)}
                className="rounded border-input"
              />
              <label htmlFor="deleteSeriesCheckbox" className="text-sm cursor-pointer">
                Gehele reeks verwijderen
              </label>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {deleteSeriesMode ? "Reeks verwijderen" : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Confirmation Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alle taken verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je {filteredTasks.length} {activeFilterCount > 0 ? "gefilterde " : ""}taken wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Annuleren</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllConfirm}
              disabled={deletingAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletingAll && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Alles verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
