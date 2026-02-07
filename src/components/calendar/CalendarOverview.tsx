import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronDown, Calendar as CalendarIcon, List, Grid3X3, LayoutGrid, Users, ClipboardList, Palmtree, GripVertical, Plus, Undo2, Snowflake, Cylinder } from "lucide-react";
import { toast } from "sonner";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, eachDayOfInterval, eachMonthOfInterval, addDays, addWeeks, addMonths, addYears, subDays, subWeeks, subMonths, subYears, isToday, isSameMonth, isSameDay, parseISO, isWithinInterval, getWeek, isWeekend, getDay, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { CalendarItemDialog } from "./CalendarItemDialog";
import { DryIceOrderDialog } from "./DryIceOrderDialog";
import { CreateTaskDialog } from "./CreateTaskDialog";
import { CreateLeaveRequestDialog } from "./CreateLeaveRequestDialog";
import { CreateDryIceOrderCalendarDialog } from "./CreateDryIceOrderCalendarDialog";
import { CalendarItemPreview } from "./CalendarItemPreview";
import { DryIceOrderPreview } from "./DryIceOrderPreview";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { formatTimeRange, getDayPartLabel, getDayPartIcon, hasTimeInfo } from "@/lib/calendar-utils";
import { Clock, Sun, Sunset } from "lucide-react";
import { CalendarSkeleton } from "@/components/ui/skeletons";
import { FadeIn } from "@/components/ui/fade-in";
type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TaskType = Database["public"]["Tables"]["task_types"]["Row"];
type TimeOffType = Database["public"]["Tables"]["time_off_types"]["Row"];
type DryIceOrder = Database["public"]["Tables"]["dry_ice_orders"]["Row"];
type DryIceProductType = Database["public"]["Tables"]["dry_ice_product_types"]["Row"];
type DryIcePackaging = Database["public"]["Tables"]["dry_ice_packaging"]["Row"];
type GasCylinderOrder = Database["public"]["Tables"]["gas_cylinder_orders"]["Row"];
type GasType = Database["public"]["Tables"]["gas_types"]["Row"];
type RequestWithProfile = TimeOffRequest & {
  profile?: Profile | null;
  leave_type?: TimeOffType | null;
};
type TaskWithProfile = Task & {
  profile?: Profile | null;
  task_type?: TaskType | null;
};
type DryIceOrderWithDetails = DryIceOrder & {
  product_type_info?: DryIceProductType | null;
  packaging_info?: DryIcePackaging | null;
};
type GasCylinderOrderWithDetails = GasCylinderOrder & {
  gas_type_info?: GasType | null;
};
type ViewType = "list" | "day" | "week" | "month" | "year";
type CalendarItem = {
  type: "timeoff";
  data: RequestWithProfile;
} | {
  type: "task";
  data: TaskWithProfile;
} | {
  type: "dryice";
  data: DryIceOrderWithDetails;
} | {
  type: "gascylinder";
  data: GasCylinderOrderWithDetails;
};
import type { User } from "@supabase/supabase-js";

interface CalendarOverviewProps {
  currentUser?: User | null;
}

export function CalendarOverview({ currentUser }: CalendarOverviewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>(() => {
    // Check for mobile on initial render to set correct default view
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return "day";
    }
    return "week";
  });
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [tasks, setTasks] = useState<TaskWithProfile[]>([]);
  const [dryIceOrders, setDryIceOrders] = useState<DryIceOrderWithDetails[]>([]);
  const [gasCylinderOrders, setGasCylinderOrders] = useState<GasCylinderOrderWithDetails[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [selectedTaskCategory, setSelectedTaskCategory] = useState<string>("all");
  const [showTimeOff, setShowTimeOff] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showDryIce, setShowDryIce] = useState(true);
  const [showGasCylinders, setShowGasCylinders] = useState(true);
  const [draggedTask, setDraggedTask] = useState<TaskWithProfile | null>(null);
  const [dragOverDate, setDragOverDate] = useState<Date | null>(null);
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null);
  const [selectedDryIceOrder, setSelectedDryIceOrder] = useState<DryIceOrderWithDetails | null>(null);
  const [selectedGasCylinderOrder, setSelectedGasCylinderOrder] = useState<GasCylinderOrderWithDetails | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dryIceDialogOpen, setDryIceDialogOpen] = useState(false);
  const [gasCylinderDialogOpen, setGasCylinderDialogOpen] = useState(false);
  const [createTaskDialogOpen, setCreateTaskDialogOpen] = useState(false);
  const [createLeaveDialogOpen, setCreateLeaveDialogOpen] = useState(false);
  const [createDryIceDialogOpen, setCreateDryIceDialogOpen] = useState(false);
  const [createDate, setCreateDate] = useState<Date | undefined>();
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>();
  const [currentProfileId, setCurrentProfileId] = useState<string | undefined>();
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [timeOffTypes, setTimeOffTypes] = useState<TimeOffType[]>([]);
  const [dryIceProductTypes, setDryIceProductTypes] = useState<DryIceProductType[]>([]);
  const [dryIcePackaging, setDryIcePackaging] = useState<DryIcePackaging[]>([]);
  const [gasTypes, setGasTypes] = useState<GasType[]>([]);
  const [lastAction, setLastAction] = useState<{
    type: "task_move";
    taskId: string;
    taskName: string;
    previousDate: string;
    newDate: string;
  } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  // Drag and drop state for dry ice
  const [draggedDryIceOrder, setDraggedDryIceOrder] = useState<DryIceOrderWithDetails | null>(null);
  const [moveSeriesDialogOpen, setMoveSeriesDialogOpen] = useState(false);
  const [moveSeriesTargetDate, setMoveSeriesTargetDate] = useState<Date | null>(null);
  const [draggedSeriesOrder, setDraggedSeriesOrder] = useState<DryIceOrderWithDetails | null>(null);

  const {
    isAdmin
  } = useUserRole(currentUserId);
  const isMobile = useIsMobile();

  // Force valid view on mobile
  useEffect(() => {
    if (isMobile && viewType !== "list" && viewType !== "day") {
      setViewType("day");
    }
  }, [isMobile, viewType]);
  const leaveTypes = [{
    value: "vacation",
    label: "Vakantie",
    color: "bg-primary"
  }, {
    value: "sick",
    label: "Ziekteverlof",
    color: "bg-destructive"
  }, {
    value: "personal",
    label: "Persoonlijk",
    color: "bg-accent"
  }, {
    value: "other",
    label: "Overig",
    color: "bg-muted"
  }];
  const statusTypes = [{
    value: "approved",
    label: "Goedgekeurd",
    color: "bg-success"
  }, {
    value: "pending",
    label: "In behandeling",
    color: "bg-warning"
  }];
  const taskStatusTypes = [{
    value: "pending",
    label: "Te doen",
    color: "bg-warning"
  }, {
    value: "in_progress",
    label: "Bezig",
    color: "bg-blue-500"
  }, {
    value: "completed",
    label: "Voltooid",
    color: "bg-success"
  }];
  useEffect(() => {
    const getUser = async () => {
      if (currentUser) {
        setCurrentUserId(currentUser.id);
      } else {
        const {
          data: {
            user
          }
        } = await supabase.auth.getUser();
        if (user) {
          setCurrentUserId(user.id);
        }
      }
    };
    getUser();
    fetchData();
  }, [currentUser]);
  const fetchData = async () => {
    try {
      setFetchError(null);
      let user = currentUser;
      if (!user) {
        const { data: { user: fetchedUser } } = await supabase.auth.getUser();
        user = fetchedUser;
      }
      if (!user) return;

      console.log("Fetching data for user:", user.id);

      // Helper for independent fetches
      const safeFetch = async <T,>(request: any, name: string): Promise<T | null> => {
        const { data, error } = await request;
        if (error) {
          console.error(`Error fetching ${name}:`, error);
          setFetchError(prev => `${prev ? prev + '; ' : ''}${name}: ${error.message || error.code}`);
          return null;
        }
        return data as T;
      };

      // Parallel fetching
      const [
        profilesData,
        requestsData,
        tasksData,
        taskTypesData,
        dryIceOrdersData,
        dryIceProductTypesData,
        dryIcePackagingData,
        gasCylinderOrdersData,
        gasTypesData,
        timeOffTypesData
      ] = await Promise.all([
        safeFetch<Profile[]>(supabase.from("profiles").select("*"), "profiles"),
        safeFetch<TimeOffRequest[]>(supabase.from("time_off_requests").select("*").order("start_date", { ascending: true }), "requests"),
        safeFetch<Task[]>(supabase.from("tasks").select("*").order("due_date", { ascending: true }), "tasks"),
        safeFetch<TaskType[]>(supabase.from("task_types").select("*").eq("is_active", true), "taskTypes"),
        safeFetch<DryIceOrder[]>(supabase.from("dry_ice_orders").select("*").eq("status", "pending").gte("scheduled_date", "2025-01-01").order("scheduled_date", { ascending: true }), "dryIce"),
        safeFetch<DryIceProductType[]>(supabase.from("dry_ice_product_types").select("*").eq("is_active", true), "dryIceTypes"),
        safeFetch<DryIcePackaging[]>(supabase.from("dry_ice_packaging").select("*").eq("is_active", true), "dryIcePkg"),
        safeFetch<GasCylinderOrder[]>(supabase.from("gas_cylinder_orders").select("*").eq("status", "pending").gte("scheduled_date", "2025-01-01").order("scheduled_date", { ascending: true }), "gasCylinders"),
        safeFetch<GasType[]>(supabase.from("gas_types").select("*").eq("is_active", true), "gasTypes"),
        safeFetch<TimeOffType[]>(supabase.from("time_off_types").select("*").eq("is_active", true), "timeOffTypes")
      ]);

      // Map profiles and leave types to requests
      const requestsWithProfiles: RequestWithProfile[] = (requestsData || []).map((request: any) => {
        const profile = request.profile_id ? profilesData?.find((p: any) => p.id === request.profile_id) : profilesData?.find((p: any) => p.user_id === request.user_id) || null;
        const leave_type = request.type_id ? timeOffTypesData?.find((t: any) => t.id === request.type_id) || null : null;
        return { ...request, profile, leave_type };
      });

      // Find current user's profile
      const currentProfile = profilesData?.find((p: any) => p.user_id === user?.id);
      if (currentProfile) {
        setCurrentProfileId(currentProfile.id);
      }

      // Map profiles and task types to tasks
      const tasksWithProfiles: TaskWithProfile[] = (tasksData || []).map((task: any) => {
        const profile = profilesData?.find((p: any) => p.user_id === task.assigned_to) || null;
        const task_type = taskTypesData?.find((t: any) => t.id === task.type_id) || null;
        return { ...task, profile, task_type };
      });

      // Map product types and packaging to dry ice orders
      const dryIceOrdersWithDetails: DryIceOrderWithDetails[] = (dryIceOrdersData || []).map((order: any) => {
        const product_type_info = dryIceProductTypesData?.find((t: any) => t.id === order.product_type_id) || null;
        const packaging_info = dryIcePackagingData?.find((p: any) => p.id === order.packaging_id) || null;
        return { ...order, product_type_info, packaging_info };
      });

      // Map gas types to gas cylinder orders
      const gasCylinderOrdersWithDetails: GasCylinderOrderWithDetails[] = (gasCylinderOrdersData || []).map((order: any) => {
        const gas_type_info = gasTypesData?.find((t: any) => t.id === order.gas_type_id) || null;
        return { ...order, gas_type_info };
      });
      setRequests(requestsWithProfiles);
      setTasks(tasksWithProfiles);
      setDryIceOrders(dryIceOrdersWithDetails);
      setGasCylinderOrders(gasCylinderOrdersWithDetails);
      setProfiles(profilesData || []);
      setTaskTypes(taskTypesData || []);
      setTimeOffTypes(timeOffTypesData || []);
      setDryIceProductTypes(dryIceProductTypesData || []);
      setDryIcePackaging(dryIcePackagingData || []);
      setGasTypes(gasTypesData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };
  const handleItemClick = (item: CalendarItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.type === "dryice") {
      setSelectedDryIceOrder(item.data);
      setDryIceDialogOpen(true);
    } else if (item.type === "gascylinder") {
      setSelectedGasCylinderOrder(item.data);
      setGasCylinderDialogOpen(true);
    } else {
      setSelectedItem(item);
      setDialogOpen(true);
    }
  };
  const handleDryIceOrderClick = (order: DryIceOrderWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDryIceOrder(order);
    setDryIceDialogOpen(true);
  };
  const handleGasCylinderOrderClick = (order: GasCylinderOrderWithDetails, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedGasCylinderOrder(order);
    setGasCylinderDialogOpen(true);
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
  const handleCreateDryIce = () => {
    setShowCreateMenu(false);
    setCreateDryIceDialogOpen(true);
  };
  const handleTaskCreated = () => {
    fetchData();
  };
  const handleUndoAction = async (action: typeof lastAction) => {
    if (!action) return;
    if (action.type === "task_move") {
      // Optimistically revert the UI
      setTasks(prev => prev.map(t => t.id === action.taskId ? {
        ...t,
        due_date: action.previousDate
      } : t));
      try {
        const {
          error
        } = await supabase.from("tasks").update({
          due_date: action.previousDate
        }).eq("id", action.taskId);
        if (error) throw error;
        setLastAction(null);
        toast.success("Actie ongedaan gemaakt", {
          description: `"${action.taskName}" teruggezet naar ${format(parseISO(action.previousDate), "d MMMM yyyy", {
            locale: nl
          })}`
        });
      } catch (error) {
        console.error("Error undoing action:", error);
        // Revert back to the new date on error
        setTasks(prev => prev.map(t => t.id === action.taskId ? {
          ...t,
          due_date: action.newDate
        } : t));
        toast.error("Fout bij ongedaan maken", {
          description: "Probeer het opnieuw"
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

  const handleDryIceDragStart = (e: React.DragEvent, order: DryIceOrderWithDetails) => {
    // Only allow drag if permission permits (checking canEditOrders would be ideal, but isAdmin/permissions check happens elsewhere)
    // For now, let's assume if they can see it and drag it, we validate on drop or rely on UI to hide drag handle
    setDraggedDryIceOrder(order);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", order.id);
    setTimeout(() => {
      (e.target as HTMLElement).style.opacity = "0.5";
    }, 0);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    (e.target as HTMLElement).style.opacity = "1";
    setDraggedTask(null);
    setDraggedDryIceOrder(null);
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

  const handleMoveSeries = async (scope: 'single' | 'series') => {
    if (!draggedSeriesOrder || !moveSeriesTargetDate) return;

    setMoveSeriesDialogOpen(false);

    // Calculate difference
    const oldDate = parseISO(draggedSeriesOrder.scheduled_date);
    const dayDifference = differenceInDays(moveSeriesTargetDate, oldDate);
    const newDateStr = format(moveSeriesTargetDate, "yyyy-MM-dd");

    if (scope === 'single') {
      // Just move this one order
      await updateDryIceOrderDate(draggedSeriesOrder.id, newDateStr, draggedSeriesOrder.order_number, draggedSeriesOrder.customer_name);
    } else {
      // Move entire series
      const seriesId = draggedSeriesOrder.parent_order_id || draggedSeriesOrder.id;

      try {
        // 1. Fetch all orders in series
        const { data: seriesOrders, error: fetchError } = await supabase
          .from("dry_ice_orders")
          .select("*")
          .or(`id.eq.${seriesId},parent_order_id.eq.${seriesId}`);

        if (fetchError) throw fetchError;

        if (!seriesOrders || seriesOrders.length === 0) return;

        // 2. Update each order
        const updates = seriesOrders.map(order => {
          const originalDate = parseISO(order.scheduled_date);
          const newScheduledDate = addDays(originalDate, dayDifference);
          return {
            ...order,
            scheduled_date: format(newScheduledDate, "yyyy-MM-dd")
          };
        });

        // Loop update (supabase doesn't support bulk update with different values easily)
        // Or use upsert
        const { error: updateError } = await supabase
          .from("dry_ice_orders")
          .upsert(updates);

        if (updateError) throw updateError;

        toast.success("Reeks verplaatst", {
          description: `${seriesOrders.length} orders verplaatst`
        });
        fetchData();

      } catch (error) {
        console.error("Error moving series:", error);
        toast.error("Fout bij verplaatsen reeks");
      }
    }

    // Cleanup
    setDraggedSeriesOrder(null);
    setMoveSeriesTargetDate(null);
  };

  const updateDryIceOrderDate = async (id: string, newDate: string, orderNumber: string, customerName: string) => {
    // Optimistically update the UI
    setDryIceOrders(prev => prev.map(o => o.id === id ? {
      ...o,
      scheduled_date: newDate
    } : o));

    try {
      const { error } = await supabase
        .from("dry_ice_orders")
        .update({ scheduled_date: newDate })
        .eq("id", id);

      if (error) throw error;

      toast.success("Order verplaatst", {
        description: `${orderNumber} (${customerName}) verplaatst naar ${format(parseISO(newDate), "d MMM yyyy", { locale: nl })}`
      });
      fetchData(); // Refresh to be sure
    } catch (error) {
      console.error("Error move dry ice order:", error);
      fetchData(); // Revert
      toast.error("Fout bij verplaatsen order");
    }
  };

  const handleDrop = async (e: React.DragEvent, targetDate: Date) => {
    e.preventDefault();
    setDragOverDate(null);

    // Handle Task Drop
    if (draggedTask) {
      const previousDate = draggedTask.due_date;
      const newDueDate = format(targetDate, "yyyy-MM-dd");

      // Don't do anything if dropped on the same date
      if (previousDate === newDueDate) {
        setDraggedTask(null);
        return;
      }

      // Optimistically update the UI
      setTasks(prev => prev.map(t => t.id === draggedTask.id ? {
        ...t,
        due_date: newDueDate
      } : t));
      try {
        const {
          error
        } = await supabase.from("tasks").update({
          due_date: newDueDate
        }).eq("id", draggedTask.id);
        if (error) throw error;

        // Store the action for undo
        const taskName = draggedTask.task_type?.name || "Taak";
        const actionData = {
          type: "task_move" as const,
          taskId: draggedTask.id,
          taskName,
          previousDate,
          newDate: newDueDate
        };
        setLastAction(actionData);
        toast.success("Taak deadline bijgewerkt", {
          description: `"${taskName}" verplaatst naar ${format(targetDate, "d MMMM yyyy", {
            locale: nl
          })}`,
          action: {
            label: "Ongedaan maken",
            onClick: () => handleUndoAction(actionData)
          },
          duration: 8000
        });
      } catch (error) {
        console.error("Error updating task:", error);
        // Revert on error
        setTasks(prev => prev.map(t => t.id === draggedTask.id ? {
          ...t,
          due_date: draggedTask.due_date
        } : t));
        toast.error("Fout bij verplaatsen taak", {
          description: "Probeer het opnieuw"
        });
      }
      setDraggedTask(null);
      return;
    }

    // Handle Dry Ice Drop
    if (draggedDryIceOrder) {
      const previousDate = draggedDryIceOrder.scheduled_date;
      const newScheduledDate = format(targetDate, "yyyy-MM-dd");

      if (previousDate === newScheduledDate) {
        setDraggedDryIceOrder(null);
        return;
      }

      // Check if recurring
      if (draggedDryIceOrder.is_recurring || draggedDryIceOrder.parent_order_id) {
        setDraggedSeriesOrder(draggedDryIceOrder);
        setMoveSeriesTargetDate(targetDate);
        setMoveSeriesDialogOpen(true);
      } else {
        // Just move single
        await updateDryIceOrderDate(draggedDryIceOrder.id, newScheduledDate, draggedDryIceOrder.order_number, draggedDryIceOrder.customer_name);
      }

      setDraggedDryIceOrder(null);
      return;
    }
  };

  // Filter requests based on selected employee, type, and status
  const filteredRequests = useMemo(() => {
    let filtered = requests;
    if (selectedEmployee !== "all") {
      filtered = filtered.filter(r => r.user_id === selectedEmployee);
    }
    if (selectedType !== "all") {
      filtered = filtered.filter(r => r.type === selectedType);
    }
    if (selectedStatus !== "all") {
      filtered = filtered.filter(r => r.status === selectedStatus);
    }
    return filtered;
  }, [requests, selectedEmployee, selectedType, selectedStatus]);

  // Filter tasks based on selected employee and category
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    if (selectedEmployee !== "all") {
      filtered = filtered.filter(t => t.assigned_to === selectedEmployee);
    }
    if (selectedTaskCategory !== "all") {
      // Check if the selected category is a parent category
      const isParent = taskTypes.some(t => t.parent_id === selectedTaskCategory);
      if (isParent) {
        // Filter by parent category (include all tasks with types that have this parent)
        const childTypeIds = taskTypes.filter(t => t.parent_id === selectedTaskCategory).map(t => t.id);
        filtered = filtered.filter(t => t.type_id === selectedTaskCategory || childTypeIds.includes(t.type_id || ""));
      } else {
        // Filter by specific category
        filtered = filtered.filter(t => t.type_id === selectedTaskCategory);
      }
    }
    return filtered;
  }, [tasks, selectedEmployee, selectedTaskCategory, taskTypes]);

  // Filter dry ice orders
  const filteredDryIceOrders = useMemo(() => {
    return dryIceOrders;
  }, [dryIceOrders]);

  // Filter gas cylinder orders
  const filteredGasCylinderOrders = useMemo(() => {
    return gasCylinderOrders;
  }, [gasCylinderOrders]);
  const getItemsForDay = (day: Date): CalendarItem[] => {
    const items: CalendarItem[] = [];
    if (showTimeOff) {
      filteredRequests.forEach(request => {
        if (selectedStatus === "all" && request.status === "rejected") return;
        const start = parseISO(request.start_date);
        const end = parseISO(request.end_date);
        if (isWithinInterval(day, {
          start,
          end
        })) {
          items.push({
            type: "timeoff",
            data: request
          });
        }
      });
    }
    if (showTasks) {
      filteredTasks.forEach(task => {
        if (isSameDay(parseISO(task.due_date), day)) {
          items.push({
            type: "task",
            data: task
          });
        }
      });
    }
    if (showDryIce) {
      filteredDryIceOrders.forEach(order => {
        if (isSameDay(parseISO(order.scheduled_date), day)) {
          items.push({
            type: "dryice",
            data: order
          });
        }
      });
    }
    if (showGasCylinders) {
      filteredGasCylinderOrders.forEach(order => {
        if (isSameDay(parseISO(order.scheduled_date), day)) {
          items.push({
            type: "gascylinder",
            data: order
          });
        }
      });
    }
    return items;
  };
  const getRequestsForDay = (day: Date): RequestWithProfile[] => {
    if (!showTimeOff) return [];
    return filteredRequests.filter(request => {
      if (selectedStatus === "all" && request.status === "rejected") return false;
      const start = parseISO(request.start_date);
      const end = parseISO(request.end_date);
      return isWithinInterval(day, {
        start,
        end
      });
    });
  };
  const getTasksForDay = (day: Date): TaskWithProfile[] => {
    if (!showTasks) return [];
    return filteredTasks.filter(task => isSameDay(parseISO(task.due_date), day));
  };
  const getDryIceOrdersForDay = (day: Date): DryIceOrderWithDetails[] => {
    if (!showDryIce) return [];
    return filteredDryIceOrders.filter(order => isSameDay(parseISO(order.scheduled_date), day));
  };
  const getGasCylinderOrdersForDay = (day: Date): GasCylinderOrderWithDetails[] => {
    if (!showGasCylinders) return [];
    return filteredGasCylinderOrders.filter(order => isSameDay(parseISO(order.scheduled_date), day));
  };
  const getDryIceStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/80 text-success-foreground";
      case "in_progress":
        return "bg-blue-500/80 text-white";
      case "pending":
        return "bg-cyan-500/80 text-white";
      case "cancelled":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-cyan-500/80 text-white";
    }
  };
  const getGasCylinderStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/80 text-success-foreground";
      case "in_progress":
        return "bg-blue-500/80 text-white";
      case "pending":
        return "bg-orange-500/80 text-white";
      case "cancelled":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-orange-500/80 text-white";
    }
  };
  const getGasCylinderStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Voltooid";
      case "in_progress":
        return "Bezig";
      case "pending":
        return "Gepland";
      case "cancelled":
        return "Geannuleerd";
      default:
        return "Gepland";
    }
  };
  const getDryIceStatusLabel = (status: string) => {
    switch (status) {
      case "completed":
        return "Voltooid";
      case "in_progress":
        return "Bezig";
      case "pending":
        return "Gepland";
      case "cancelled":
        return "Geannuleerd";
      default:
        return "Gepland";
    }
  };
  const getEmployeeName = (item: RequestWithProfile | TaskWithProfile) => {
    if (!item.profile) {
      // Check if this is a task without assignment
      if ('assigned_to' in item && !item.assigned_to) {
        return "Niet toegewezen";
      }
      return "Onbekend";
    }
    return item.profile.full_name || item.profile.email?.split("@")[0] || "Onbekend";
  };
  const getTaskPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-destructive text-destructive-foreground";
      case "medium":
        return "bg-warning text-warning-foreground";
      case "low":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };
  const getTaskStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-success/80 text-success-foreground";
      case "in_progress":
        return "bg-blue-500/80 text-white";
      case "pending":
        return "bg-warning/80 text-warning-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  // Get unique employees for legend
  const uniqueEmployees = useMemo(() => {
    const employeeMap = new Map<string, {
      name: string;
      color: string;
    }>();
    const colors = ["bg-blue-500", "bg-green-500", "bg-purple-500", "bg-orange-500", "bg-pink-500", "bg-cyan-500", "bg-indigo-500", "bg-teal-500"];
    let colorIndex = 0;

    // Add employees from requests
    requests.forEach(request => {
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
    tasks.forEach(task => {
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
  const getEmployeeColor = (userId: string | null) => {
    if (!userId) return "bg-muted";
    const employee = uniqueEmployees.find(e => e.userId === userId);
    return employee?.color || "bg-muted";
  };
  const getTypeColor = (type: string, status: string) => {
    if (status === "pending") return "bg-warning/80 text-warning-foreground";
    switch (type) {
      case "vacation":
        return "bg-primary text-primary-foreground";
      case "sick":
        return "bg-destructive text-destructive-foreground";
      case "personal":
        return "bg-accent text-accent-foreground";
      default:
        return "bg-muted text-muted-foreground";
    }
  };
  const getTypeLabel = (type: string) => {
    switch (type) {
      case "vacation":
        return "Vakantie";
      case "sick":
        return "Ziekteverlof";
      case "personal":
        return "Persoonlijk";
      default:
        return "Overig";
    }
  };

  // Get leave type label from custom type or fall back to enum type
  const getLeaveTypeLabel = (request: RequestWithProfile) => {
    if (request.leave_type?.name) {
      return request.leave_type.name;
    }
    return getTypeLabel(request.type);
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
        return format(currentDate, "EEEE d MMMM yyyy", {
          locale: nl
        });
      case "week":
        const weekStart = startOfWeek(currentDate, {
          weekStartsOn: 1
        });
        const weekEnd = endOfWeek(currentDate, {
          weekStartsOn: 1
        });
        return `Week ${getWeek(currentDate, {
          weekStartsOn: 1
        })} - ${format(weekStart, "d MMM", {
          locale: nl
        })} tot ${format(weekEnd, "d MMM yyyy", {
          locale: nl
        })}`;
      case "month":
        return format(currentDate, "MMMM yyyy", {
          locale: nl
        });
      case "year":
        return format(currentDate, "yyyy", {
          locale: nl
        });
    }
  };
  const weekDays = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  // List View - Shows all items in a chronological list
  const renderListView = () => {
    // Combine and sort all items by date
    const allItems: {
      date: Date;
      item: CalendarItem;
    }[] = [];
    if (showTimeOff) {
      filteredRequests.forEach(request => {
        if (selectedStatus === "all" && request.status === "rejected") return;
        allItems.push({
          date: parseISO(request.start_date),
          item: {
            type: "timeoff",
            data: request
          }
        });
      });
    }
    if (showTasks) {
      filteredTasks.forEach(task => {
        allItems.push({
          date: parseISO(task.due_date),
          item: {
            type: "task",
            data: task
          }
        });
      });
    }
    if (showDryIce) {
      filteredDryIceOrders.forEach(order => {
        allItems.push({
          date: parseISO(order.scheduled_date),
          item: {
            type: "dryice",
            data: order
          }
        });
      });
    }
    if (showGasCylinders) {
      filteredGasCylinderOrders.forEach(order => {
        allItems.push({
          date: parseISO(order.scheduled_date),
          item: {
            type: "gascylinder",
            data: order
          }
        });
      });
    }

    // Sort by date ascending
    allItems.sort((a, b) => a.date.getTime() - b.date.getTime());

    // Group by date
    const groupedItems = allItems.reduce((acc, {
      date,
      item
    }) => {
      const dateKey = format(date, "yyyy-MM-dd");
      if (!acc[dateKey]) {
        acc[dateKey] = {
          date,
          items: []
        };
      }
      acc[dateKey].items.push(item);
      return acc;
    }, {} as Record<string, {
      date: Date;
      items: CalendarItem[];
    }>);
    const sortedGroups = Object.values(groupedItems).sort((a, b) => a.date.getTime() - b.date.getTime());
    if (sortedGroups.length === 0) {
      return <div className="text-center text-muted-foreground py-16 bg-muted/30 rounded-xl animate-fade-in">
        <List className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p className="font-medium">Geen items gevonden</p>
        <p className="text-sm opacity-70">Pas de filters aan om items te zien</p>
      </div>;
    }
    return <div className="space-y-4">
      {sortedGroups.map(({
        date,
        items
      }, groupIndex) => <motion.div key={format(date, "yyyy-MM-dd")} className="rounded-xl border border-border/50 overflow-hidden" initial={{
        opacity: 0,
        y: 20
      }} animate={{
        opacity: 1,
        y: 0
      }} transition={{
        duration: 0.3,
        delay: groupIndex * 0.05
      }}>
          {/* Date Header */}
          <div className={cn("px-4 py-3 flex items-center gap-3 font-medium", isToday(date) ? "bg-primary/10 text-primary" : "bg-muted/30 text-foreground")}>
            <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold", isToday(date) ? "bg-primary text-primary-foreground" : "bg-background border")}>
              {format(date, "d")}
            </div>
            <div>
              <div className="capitalize">{format(date, "EEEE", {
                locale: nl
              })}</div>
              <div className="text-xs text-muted-foreground">{format(date, "d MMMM yyyy", {
                locale: nl
              })}</div>
            </div>
            {isToday(date) && <Badge variant="secondary" className="ml-auto text-xs">Vandaag</Badge>}
          </div>

          {/* Items for this date */}
          <div className="divide-y divide-border/50">
            {items.map((calendarItem, index) => {
              if (calendarItem.type === "timeoff") {
                const request = calendarItem.data;
                return <CalendarItemPreview key={`timeoff-${request.id}`} item={request} type="timeoff" side="right">
                  <motion.div initial={{
                    opacity: 0,
                    x: -20
                  }} animate={{
                    opacity: 1,
                    x: 0
                  }} transition={{
                    duration: 0.25,
                    delay: groupIndex * 0.05 + index * 0.03
                  }} onClick={e => handleItemClick(calendarItem, e)} className="p-4 hover:bg-muted/30 cursor-pointer transition-colors flex items-center gap-4">
                    <div className={cn("w-1 h-12 rounded-full", getTypeColor(request.type, request.status).split(" ")[0])} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Palmtree className="h-4 w-4 text-primary flex-shrink-0" />
                        <span className="font-medium truncate">{getEmployeeName(request)}</span>
                        <Badge variant="outline" className={cn("text-xs flex-shrink-0", getTypeColor(request.type, request.status))}>
                          {getLeaveTypeLabel(request)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>{format(parseISO(request.start_date), "d MMM", {
                          locale: nl
                        })} — {format(parseISO(request.end_date), "d MMM", {
                          locale: nl
                        })}</span>
                        {request.day_part && request.day_part !== "full_day" && <span className="flex items-center gap-1 text-xs">
                          {request.day_part === "morning" ? <Sun className="h-3 w-3" /> : <Sunset className="h-3 w-3" />}
                          {getDayPartLabel(request.day_part)}
                        </span>}
                      </div>
                      {request.reason && <div className="text-xs text-muted-foreground/70 mt-1 truncate italic">{request.reason}</div>}
                    </div>
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", getEmployeeColor(request.user_id))} />
                  </motion.div>
                </CalendarItemPreview>;
              } else if (calendarItem.type === "task") {
                const task = calendarItem.data;
                return <CalendarItemPreview key={`task-${task.id}`} item={task} type="task" side="right">
                  <motion.div initial={{
                    opacity: 0,
                    x: -20
                  }} animate={{
                    opacity: 1,
                    x: 0
                  }} transition={{
                    duration: 0.25,
                    delay: groupIndex * 0.05 + index * 0.03
                  }} onClick={e => handleItemClick(calendarItem, e)} className="p-4 hover:bg-muted/30 cursor-pointer transition-colors flex items-center gap-4">
                    <div className="w-1 h-12 rounded-full" style={{
                      backgroundColor: task.task_type?.color || "#888"
                    }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <ClipboardList className="h-4 w-4 text-blue-500 flex-shrink-0" />
                        <span className="font-medium truncate">{task.task_type?.name || "Taak"}</span>
                        <Badge variant="outline" className={cn("text-xs flex-shrink-0", getTaskStatusColor(task.status))}>
                          {task.status === "pending" ? "Te doen" : task.status === "in_progress" ? "Bezig" : "Voltooid"}
                        </Badge>
                        <Badge variant="outline" className={cn("text-xs flex-shrink-0", getTaskPriorityColor(task.priority))}>
                          {task.priority === "high" ? "Hoog" : task.priority === "medium" ? "Gemiddeld" : "Laag"}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2">
                        <span>{getEmployeeName(task)}</span>
                        {hasTimeInfo(task.start_time, task.end_time) && <span className="flex items-center gap-1 text-xs">
                          <Clock className="h-3 w-3" />
                          {formatTimeRange(task.start_time, task.end_time)}
                        </span>}
                      </div>
                    </div>
                    <div className={cn("w-2 h-2 rounded-full flex-shrink-0", getEmployeeColor(task.assigned_to))} />
                  </motion.div>
                </CalendarItemPreview>;
              } else if (calendarItem.type === "dryice") {
                const order = calendarItem.data;
                return <DryIceOrderPreview key={`dryice-${order.id}`} order={order} side="right">
                  <motion.div initial={{
                    opacity: 0,
                    x: -20
                  }} animate={{
                    opacity: 1,
                    x: 0
                  }} transition={{
                    duration: 0.25,
                    delay: groupIndex * 0.05 + index * 0.03
                  }} draggable onDragStartCapture={(e: any) => handleDryIceDragStart(e, order)} onDragEndCapture={handleDragEnd} onClick={e => handleDryIceOrderClick(order, e)} className={cn("p-4 hover:bg-muted/30 cursor-pointer transition-colors flex items-center gap-4", draggedDryIceOrder?.id === order.id && "opacity-50 border-2 border-dashed border-cyan-500/50 bg-cyan-50/50")}>
                    <div className="w-1 h-12 rounded-full bg-cyan-500" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Snowflake className="h-4 w-4 text-cyan-500 flex-shrink-0" />
                        <span className="font-medium truncate">{order.customer_name}</span>
                        <Badge variant="outline" className={cn("text-xs flex-shrink-0", getDryIceStatusColor(order.status))}>
                          {getDryIceStatusLabel(order.status)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                        <span>{order.quantity_kg} kg {order.product_type_info?.name || ""}</span>
                        {order.packaging_info && <span className="text-xs">• {order.packaging_info.name}</span>}
                        {order.packaging_info?.name?.toLowerCase().includes("container") && <span className="text-xs">• {order.container_has_wheels ? "Met wielen" : "Zonder wielen"}</span>}
                      </div>
                      {order.notes && <div className="text-xs text-muted-foreground/70 mt-1 truncate italic">{order.notes}</div>}
                    </div>
                    <div className="w-2 h-2 rounded-full flex-shrink-0 bg-cyan-500" />
                  </motion.div>
                </DryIceOrderPreview>;
              } else if (calendarItem.type === "gascylinder") {
                const order = calendarItem.data;
                return <motion.div key={`gascylinder-${order.id}`} initial={{
                  opacity: 0,
                  x: -20
                }} animate={{
                  opacity: 1,
                  x: 0
                }} transition={{
                  duration: 0.25,
                  delay: groupIndex * 0.05 + index * 0.03
                }} onClick={e => handleGasCylinderOrderClick(order, e)} className="p-4 hover:bg-muted/30 cursor-pointer transition-colors flex items-center gap-4">
                  <div className="w-1 h-12 rounded-full bg-orange-500" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Cylinder className="h-4 w-4 text-orange-500 flex-shrink-0" />
                      <span className="font-medium truncate">{order.customer_name}</span>
                      <Badge variant="outline" className={cn("text-xs flex-shrink-0", getGasCylinderStatusColor(order.status))}>
                        {getGasCylinderStatusLabel(order.status)}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                      <span>{order.cylinder_count}x {order.gas_type_info?.name || order.gas_type}</span>
                      <span className="text-xs">• {order.pressure} bar</span>
                    </div>
                    {order.notes && <div className="text-xs text-muted-foreground/70 mt-1 truncate italic">{order.notes}</div>}
                  </div>
                  <div className="w-2 h-2 rounded-full flex-shrink-0 bg-orange-500" />
                </motion.div>;
              }
              return null;
            })}
          </div>
        </motion.div>)}
    </div>;
  };

  // Day View
  const renderDayView = () => {
    const dayRequests = getRequestsForDay(currentDate);
    const dayTasks = getTasksForDay(currentDate);
    const dayDryIceOrders = getDryIceOrdersForDay(currentDate);
    const dayGasCylinderOrders = getGasCylinderOrdersForDay(currentDate);
    const hasItems = dayRequests.length > 0 || dayTasks.length > 0 || dayDryIceOrders.length > 0 || dayGasCylinderOrders.length > 0;
    return <div className="space-y-4 animate-fade-in">
      <div className={cn("p-4 md:p-8 rounded-2xl border backdrop-blur-sm transition-all duration-300", isToday(currentDate) ? "ring-2 ring-primary/50 bg-gradient-to-br from-primary/5 to-primary/10 shadow-lg shadow-primary/10" : "bg-card/80 hover:bg-card")}>
        <div className="text-center mb-6">
          <div className="text-4xl md:text-6xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent">
            {format(currentDate, "d")}
          </div>
          <div className="text-lg text-muted-foreground mt-1 capitalize">
            {format(currentDate, "EEEE", {
              locale: nl
            })}
          </div>
        </div>

        {!hasItems ? <div className="text-center text-muted-foreground py-12 bg-muted/30 rounded-xl">
          <CalendarDays className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Geen items gepland</p>
          <p className="text-sm opacity-70">voor deze dag</p>
        </div> : <div className="space-y-4">
          {/* Time Off Requests */}
          {dayRequests.length > 0 && <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Palmtree className="h-4 w-4" />
              <span>Verlof</span>
            </div>
            {dayRequests.map((request, index) => <CalendarItemPreview key={request.id} item={request} type="timeoff" side="right">
              <motion.div initial={{
                opacity: 0,
                y: 10
              }} animate={{
                opacity: 1,
                y: 0
              }} transition={{
                duration: 0.25,
                delay: index * 0.05
              }} onClick={e => handleItemClick({
                type: "timeoff",
                data: request
              }, e)} className={cn("p-4 rounded-xl text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-pointer", getTypeColor(request.type, request.status))}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full ring-2 ring-white/30", getEmployeeColor(request.user_id))} />
                    <span className="font-semibold">{getEmployeeName(request)}</span>
                  </div>
                  {request.day_part && request.day_part !== "full_day" && <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 text-xs font-medium">
                    {request.day_part === "morning" ? <Sun className="h-3 w-3" /> : <Sunset className="h-3 w-3" />}
                    <span>{getDayPartLabel(request.day_part)}</span>
                  </div>}
                </div>
                <div className="font-medium mt-2 opacity-90">{getLeaveTypeLabel(request)}</div>
                <div className="text-xs opacity-75 mt-1">
                  {format(parseISO(request.start_date), "d MMM", {
                    locale: nl
                  })} — {format(parseISO(request.end_date), "d MMM", {
                    locale: nl
                  })}
                </div>
                {request.reason && <div className="text-xs opacity-60 mt-2 italic">{request.reason}</div>}
              </motion.div>
            </CalendarItemPreview>)}
          </div>}

          {/* Tasks */}
          {dayTasks.length > 0 && <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <ClipboardList className="h-4 w-4" />
              <span>Taken</span>
            </div>
            {dayTasks.map((task, index) => <CalendarItemPreview key={task.id} item={task} type="task" side="right">
              <motion.div initial={{
                opacity: 0,
                y: 10
              }} animate={{
                opacity: 1,
                y: 0
              }} transition={{
                duration: 0.25,
                delay: (dayRequests.length + index) * 0.05
              }} onClick={e => handleItemClick({
                type: "task",
                data: task
              }, e)} className={cn("p-4 rounded-xl text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md border-l-4 cursor-pointer", getTaskStatusColor(task.status))}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full ring-2 ring-white/30", getEmployeeColor(task.assigned_to))} />
                    <span className="font-semibold">{getEmployeeName(task)}</span>
                  </div>
                  {hasTimeInfo(task.start_time, task.end_time) && <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/20 text-xs font-medium">
                    <Clock className="h-3 w-3" />
                    <span>{formatTimeRange(task.start_time, task.end_time)}</span>
                  </div>}
                </div>
                <div className="font-medium mt-2">{task.task_type?.name || "Taak"}</div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={cn("text-xs", getTaskPriorityColor(task.priority))}>
                    {task.priority === "high" ? "Hoog" : task.priority === "medium" ? "Gemiddeld" : "Laag"}
                  </Badge>
                </div>
              </motion.div>
            </CalendarItemPreview>)}
          </div>}

          {/* Dry Ice Orders */}
          {dayDryIceOrders.length > 0 && <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Snowflake className="h-4 w-4 text-cyan-500" />
              <span>Droogijs productie</span>
            </div>
            {dayDryIceOrders.map((order, index) => <DryIceOrderPreview key={order.id} order={order} side="right">
              <motion.div initial={{
                opacity: 0,
                y: 10
              }} animate={{
                opacity: 1,
                y: 0
              }} transition={{
                duration: 0.25,
                delay: (dayRequests.length + dayTasks.length + index) * 0.05
              }} draggable onDragStartCapture={(e: any) => handleDryIceDragStart(e, order)} onDragEndCapture={handleDragEnd} onClick={e => handleDryIceOrderClick(order, e)} className={cn("p-4 rounded-xl text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-pointer", getDryIceStatusColor(order.status), draggedDryIceOrder?.id === order.id && "opacity-50 border-2 border-dashed border-cyan-500/50")}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Snowflake className="w-4 h-4" />
                    <span className="font-semibold">{order.customer_name}</span>
                  </div>
                  <Badge variant="outline" className="text-xs bg-white/20">
                    {order.order_number}
                  </Badge>
                </div>
                <div className="font-medium mt-2">
                  {order.quantity_kg} kg {order.product_type_info?.name || ""}
                </div>
                {order.packaging_info && <div className="text-xs opacity-75 mt-1">
                  {order.packaging_info.name}
                  {order.packaging_info.name?.toLowerCase().includes("container") && <span> • {order.container_has_wheels ? "Met wielen" : "Zonder wielen"}</span>}
                </div>}
                {order.notes && <div className="text-xs opacity-60 mt-2 italic">{order.notes}</div>}
              </motion.div>
            </DryIceOrderPreview>)}
          </div>}

          {/* Gas Cylinder Orders */}
          {dayGasCylinderOrders.length > 0 && <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
              <Cylinder className="h-4 w-4 text-orange-500" />
              <span>Gascilinders</span>
            </div>
            {dayGasCylinderOrders.map((order, index) => <motion.div key={order.id} initial={{
              opacity: 0,
              y: 10
            }} animate={{
              opacity: 1,
              y: 0
            }} transition={{
              duration: 0.25,
              delay: (dayRequests.length + dayTasks.length + dayDryIceOrders.length + index) * 0.05
            }} onClick={e => handleGasCylinderOrderClick(order, e)} className={cn("p-4 rounded-xl text-sm transition-all duration-300 hover:scale-[1.02] hover:shadow-md cursor-pointer", getGasCylinderStatusColor(order.status))}>
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <Cylinder className="w-4 h-4" />
                  <span className="font-semibold">{order.customer_name}</span>
                </div>
                <Badge variant="outline" className="text-xs bg-white/20">
                  {order.order_number}
                </Badge>
              </div>
              <div className="font-medium mt-2">
                {order.cylinder_count}x {order.gas_type_info?.name || order.gas_type}
              </div>
              <div className="text-xs opacity-75 mt-1">
                {order.pressure} bar • {order.cylinder_size}
              </div>
              {order.notes && <div className="text-xs opacity-60 mt-2 italic">{order.notes}</div>}
            </motion.div>)}
          </div>}
        </div>}
      </div>
    </div>;
  };

  // Week View
  const renderWeekView = () => {
    const weekStart = startOfWeek(currentDate, {
      weekStartsOn: 1
    });
    const weekEnd = endOfWeek(currentDate, {
      weekStartsOn: 1
    });
    const days = eachDayOfInterval({
      start: weekStart,
      end: weekEnd
    });
    return <div className="flex-1 flex flex-col gap-2 animate-fade-in">
      <div className="grid grid-cols-7 gap-2 flex-shrink-0">
        {weekDays.map((day, index) => {
          const isWeekendDay = index >= 5;
          return <div key={day} className={cn("text-center text-xs font-semibold py-2 uppercase tracking-wider", isWeekendDay ? "text-primary/70 bg-primary/5 rounded-lg" : "text-muted-foreground")}>
            {day}
          </div>;
        })}
      </div>
      <div className="grid grid-cols-7 gap-2 flex-1">
        {days.map((day, index) => {
          const dayRequests = getRequestsForDay(day);
          const dayTasks = getTasksForDay(day);
          const dayDryIceOrders = getDryIceOrdersForDay(day);
          const dayGasCylinderOrders = getGasCylinderOrdersForDay(day);
          const allItems = [...dayRequests.map(r => ({
            type: 'timeoff' as const,
            item: r
          })), ...dayTasks.map(t => ({
            type: 'task' as const,
            item: t
          })), ...dayDryIceOrders.map(o => ({
            type: 'dryice' as const,
            item: o
          })), ...dayGasCylinderOrders.map(o => ({
            type: 'gascylinder' as const,
            item: o
          }))];
          const isCurrentDay = isToday(day);
          const isDragOver = dragOverDate && isSameDay(dragOverDate, day);
          const isWeekendDay = isWeekend(day);
          return <div key={day.toISOString()} onClick={e => handleDayClick(day, e)} className={cn("p-3 rounded-xl border transition-all duration-300 hover:shadow-md flex flex-col", isWeekendDay ? "bg-primary/5 backdrop-blur-sm border-primary/20 hover:bg-primary/10" : "bg-card/80 backdrop-blur-sm border-border/50", isCurrentDay && "ring-2 ring-primary/50 bg-gradient-to-br from-primary/10 to-transparent shadow-lg shadow-primary/5", isDragOver && "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.02]", isAdmin && "cursor-pointer")} style={{
            animationDelay: `${index * 30}ms`
          }} onDragOver={e => handleDragOver(e, day)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, day)}>
            <div className={cn("text-sm font-bold mb-3 flex items-center justify-center w-7 h-7 rounded-full", isCurrentDay ? "bg-primary text-primary-foreground" : "text-foreground")}>
              {format(day, "d")}
            </div>
            <div className="space-y-1.5">
              {allItems.slice(0, 6).map(entry => {
                if (entry.type === 'timeoff') {
                  const request = entry.item as RequestWithProfile;
                  return <CalendarItemPreview key={request.id} item={request} type="timeoff" side="bottom" align="start">
                    <div onClick={e => handleItemClick({
                      type: "timeoff",
                      data: request
                    }, e)} className={cn("text-xs px-2 py-1.5 rounded-lg truncate flex items-center gap-1.5 transition-transform hover:scale-105 cursor-pointer", getTypeColor(request.type, request.status))} title={`${getEmployeeName(request)} - ${getLeaveTypeLabel(request)}${request.day_part && request.day_part !== "full_day" ? ` (${getDayPartLabel(request.day_part)})` : ""}`}>
                      {request.day_part === "morning" ? <Sun className="w-3 h-3 shrink-0 text-amber-300" /> : request.day_part === "afternoon" ? <Sunset className="w-3 h-3 shrink-0" /> : <Palmtree className="w-3 h-3 shrink-0" />}
                      <span className="truncate font-medium">{getEmployeeName(request)} • {getLeaveTypeLabel(request)}</span>
                    </div>
                  </CalendarItemPreview>;
                } else if (entry.type === 'task') {
                  const task = entry.item as TaskWithProfile;
                  return <CalendarItemPreview key={task.id} item={task} type="task" side="bottom" align="start">
                    <div draggable onDragStart={e => handleDragStart(e, task)} onDragEnd={handleDragEnd} onClick={e => handleItemClick({
                      type: "task",
                      data: task
                    }, e)} className={cn("text-xs px-2 py-1.5 rounded-lg truncate flex items-center gap-1.5 transition-all hover:scale-105 cursor-pointer group", getTaskStatusColor(task.status), draggedTask?.id === task.id && "opacity-50")} title={`${task.task_type?.name || "Taak"}${hasTimeInfo(task.start_time, task.end_time) ? ` (${formatTimeRange(task.start_time, task.end_time)})` : ""}`}>
                      {hasTimeInfo(task.start_time, task.end_time) ? <Clock className="w-3 h-3 shrink-0 opacity-70" /> : <GripVertical className="w-3 h-3 shrink-0 opacity-50 group-hover:opacity-100 cursor-grab" />}
                      <ClipboardList className="w-3 h-3 shrink-0" />
                      <span className="truncate font-medium">
                        {hasTimeInfo(task.start_time, task.end_time) && <span className="opacity-80 mr-1">{formatTimeRange(task.start_time, task.end_time)}</span>}
                        {task.task_type?.name || "Taak"}
                      </span>
                    </div>
                  </CalendarItemPreview>;
                } else if (entry.type === 'dryice') {
                  const order = entry.item as DryIceOrderWithDetails;
                  return <DryIceOrderPreview key={order.id} order={order} side="bottom" align="start">
                    <div draggable onDragStart={(e: any) => handleDryIceDragStart(e, order)} onDragEnd={handleDragEnd} onClick={e => handleDryIceOrderClick(order, e)} className={cn("text-xs px-2 py-1.5 rounded-lg truncate flex items-center gap-1.5 transition-transform hover:scale-105 cursor-pointer border border-cyan-500/30 bg-muted-foreground text-destructive-foreground", draggedDryIceOrder?.id === order.id && "opacity-50")}>
                      <Snowflake className="w-3 h-3 shrink-0" />
                      <span className="truncate font-medium">{order.customer_name} • {order.quantity_kg}kg</span>
                    </div>
                  </DryIceOrderPreview>;
                } else if (entry.type === 'gascylinder') {
                  const order = entry.item as GasCylinderOrderWithDetails;
                  return <div key={order.id} onClick={e => handleGasCylinderOrderClick(order, e)} className={cn("text-xs px-2 py-1.5 rounded-lg truncate flex items-center gap-1.5 transition-transform hover:scale-105 cursor-pointer bg-orange-500/20 text-orange-700 dark:text-orange-300 border border-orange-500/30")}>
                    <Cylinder className="w-3 h-3 shrink-0" />
                    <span className="truncate font-medium">{order.customer_name} • {order.cylinder_count}x</span>
                  </div>;
                }
                return null;
              })}
              {allItems.length > 6 && <div className="text-xs text-primary font-medium pl-1">
                +{allItems.length - 6} meer
              </div>}
            </div>
          </div>;
        })}
      </div>
    </div>;
  };

  // Month View
  const renderMonthView = () => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, {
      weekStartsOn: 1
    });
    const calendarEnd = endOfWeek(monthEnd, {
      weekStartsOn: 1
    });
    const days = eachDayOfInterval({
      start: calendarStart,
      end: calendarEnd
    });
    return <div className="space-y-3 animate-fade-in">
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day, index) => {
          // Index 5 and 6 are Saturday and Sunday (0-indexed, starting from Monday)
          const isWeekendDay = index >= 5;
          return <div key={day} className={cn("text-center text-xs font-semibold py-2 uppercase tracking-wider", isWeekendDay ? "text-primary/70 bg-primary/5 rounded-lg" : "text-muted-foreground")}>
            {day}
          </div>;
        })}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day, index) => {
          const dayRequests = getRequestsForDay(day);
          const dayTasks = getTasksForDay(day);
          const dayDryIceOrders = getDryIceOrdersForDay(day);
          const allItems = [...dayRequests.map(r => ({
            type: 'timeoff' as const,
            item: r
          })), ...dayTasks.map(t => ({
            type: 'task' as const,
            item: t
          })), ...dayDryIceOrders.map(o => ({
            type: 'dryice' as const,
            item: o
          }))];
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isCurrentDay = isToday(day);
          const isDragOver = dragOverDate && isSameDay(dragOverDate, day);
          const isWeekendDay = isWeekend(day);
          return <div key={day.toISOString()} onClick={e => isCurrentMonth && handleDayClick(day, e)} className={cn("min-h-[90px] p-2 rounded-xl border transition-all duration-200", isCurrentMonth ? isWeekendDay ? "bg-primary/5 backdrop-blur-sm border-primary/20 hover:bg-primary/10 hover:shadow-sm" : "bg-card/80 backdrop-blur-sm border-border/50 hover:bg-card hover:shadow-sm" : "bg-muted/20 border-transparent opacity-50", isCurrentDay && "ring-2 ring-primary/50 bg-gradient-to-br from-primary/10 to-transparent", isDragOver && "ring-2 ring-blue-500 bg-blue-50/50 dark:bg-blue-950/30 scale-[1.02]", isCurrentMonth && isAdmin && "cursor-pointer")} onDragOver={e => handleDragOver(e, day)} onDragLeave={handleDragLeave} onDrop={e => handleDrop(e, day)}>
            <div className={cn("text-xs font-bold mb-1.5 flex items-center justify-center w-6 h-6 rounded-full transition-colors", isCurrentDay ? "bg-primary text-primary-foreground" : isCurrentMonth ? "text-foreground" : "text-muted-foreground/50")}>
              {format(day, "d")}
            </div>
            <div className="space-y-1">
              {allItems.slice(0, 4).map(entry => {
                if (entry.type === 'timeoff') {
                  const request = entry.item as RequestWithProfile;
                  return <CalendarItemPreview key={request.id} item={request} type="timeoff" side="right" align="start">
                    <div onClick={e => handleItemClick({
                      type: "timeoff",
                      data: request
                    }, e)} className={cn("text-[10px] px-1.5 py-1 rounded-md truncate flex items-center gap-1 transition-transform hover:scale-105 cursor-pointer", getTypeColor(request.type, request.status))}>
                      {request.day_part === "morning" ? <Sun className="w-2.5 h-2.5 shrink-0" /> : request.day_part === "afternoon" ? <Sunset className="w-2.5 h-2.5 shrink-0" /> : <Palmtree className="w-2.5 h-2.5 shrink-0" />}
                      <span className="truncate font-medium">{getEmployeeName(request)} • {getLeaveTypeLabel(request)}</span>
                    </div>
                  </CalendarItemPreview>;
                } else if (entry.type === 'task') {
                  const task = entry.item as TaskWithProfile;
                  return <CalendarItemPreview key={task.id} item={task} type="task" side="right" align="start">
                    <div draggable onDragStart={e => handleDragStart(e, task)} onDragEnd={handleDragEnd} onClick={e => handleItemClick({
                      type: "task",
                      data: task
                    }, e)} className={cn("text-[10px] px-1.5 py-1 rounded-md truncate flex items-center gap-1 transition-all hover:scale-105 cursor-pointer group", getTaskStatusColor(task.status), draggedTask?.id === task.id && "opacity-50")}>
                      {hasTimeInfo(task.start_time, task.end_time) ? <Clock className="w-2.5 h-2.5 shrink-0 opacity-70" /> : <GripVertical className="w-2.5 h-2.5 shrink-0 opacity-50 group-hover:opacity-100 cursor-grab" />}
                      <ClipboardList className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate font-medium">
                        {hasTimeInfo(task.start_time, task.end_time) && <span className="opacity-80 mr-0.5">{formatTimeRange(task.start_time, task.end_time)}</span>}
                        {task.task_type?.name || "Taak"}
                      </span>
                    </div>
                  </CalendarItemPreview>;
                } else if (entry.type === 'dryice') {
                  const order = entry.item as DryIceOrderWithDetails;
                  return <DryIceOrderPreview key={order.id} order={order} side="bottom" align="start">
                    <div draggable onDragStart={(e: any) => handleDryIceDragStart(e, order)} onDragEnd={handleDragEnd} onClick={e => handleDryIceOrderClick(order, e)} className={cn("text-[10px] px-1.5 py-1 rounded-md truncate flex items-center gap-1 transition-transform hover:scale-105 cursor-pointer bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-500/30", draggedDryIceOrder?.id === order.id && "opacity-50")}>
                      <Snowflake className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate font-medium">{order.customer_name} • {order.quantity_kg}kg</span>
                    </div>
                  </DryIceOrderPreview>;
                }
                return null;
              })}
              {allItems.length > 4 && <div className="text-[10px] text-primary font-semibold pl-1">
                +{allItems.length - 4}
              </div>}
            </div>
          </div>;
        })}
      </div>
    </div>;
  };

  // Year View
  const renderYearView = () => {
    const yearStart = startOfYear(currentDate);
    const yearEnd = endOfYear(currentDate);
    const months = eachMonthOfInterval({
      start: yearStart,
      end: yearEnd
    });
    return <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 animate-fade-in">
      {months.map((month, index) => {
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);
        const monthDays = eachDayOfInterval({
          start: monthStart,
          end: monthEnd
        });
        const monthRequests = showTimeOff ? filteredRequests.filter(request => {
          if (request.status === "rejected") return false;
          const start = parseISO(request.start_date);
          const end = parseISO(request.end_date);
          return monthDays.some(day => isWithinInterval(day, {
            start,
            end
          }));
        }) : [];
        const monthTasks = showTasks ? filteredTasks.filter(task => {
          const dueDate = parseISO(task.due_date);
          return monthDays.some(day => isSameDay(day, dueDate));
        }) : [];
        const monthDryIceOrders = showDryIce ? filteredDryIceOrders.filter(order => {
          const scheduledDate = parseISO(order.scheduled_date);
          return monthDays.some(day => isSameDay(day, scheduledDate));
        }) : [];
        const totalItems = monthRequests.length + monthTasks.length + monthDryIceOrders.length;
        const isCurrentMonth = isSameMonth(month, new Date());
        return <Card key={month.toISOString()} className={cn("cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-xl border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden group", isCurrentMonth && "ring-2 ring-primary/50 shadow-lg shadow-primary/10")} onClick={() => {
          setCurrentDate(month);
          setViewType("month");
        }} style={{
          animationDelay: `${index * 40}ms`
        }}>
          <div className={cn("h-1 w-full transition-all duration-300", isCurrentMonth ? "gradient-primary" : "bg-border group-hover:bg-primary/50")} />
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold capitalize">
              {format(month, "MMMM", {
                locale: nl
              })}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {totalItems === 0 ? <div className="text-xs text-muted-foreground italic">Geen items gepland</div> : <div className="space-y-1.5">
              {monthRequests.slice(0, 1).map(request => <Badge key={request.id} variant="secondary" className={cn("text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 w-fit", getTypeColor(request.type, request.status))}>
                <Palmtree className="w-2.5 h-2.5" />
                {getLeaveTypeLabel(request)}
              </Badge>)}
              {monthTasks.slice(0, 1).map(task => <Badge key={task.id} variant="secondary" className={cn("text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 w-fit", getTaskStatusColor(task.status))}>
                <ClipboardList className="w-2.5 h-2.5" />
                {(task.task_type?.name || "Taak").substring(0, 15)}{(task.task_type?.name || "Taak").length > 15 ? '...' : ''}
              </Badge>)}
              {monthDryIceOrders.slice(0, 1).map(order => <Badge key={order.id} variant="secondary" className="text-[10px] px-2 py-0.5 font-medium flex items-center gap-1 w-fit bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border-cyan-500/30">
                <Snowflake className="w-2.5 h-2.5" />
                {order.customer_name.substring(0, 12)}{order.customer_name.length > 12 ? '...' : ''}
              </Badge>)}
              {totalItems > 3 && <div className="text-xs text-primary font-semibold">
                +{totalItems - 3} meer
              </div>}
            </div>}
          </CardContent>
        </Card>;
      })}
    </div>;
  };
  return <div className="flex-1 flex flex-col bg-card/90 backdrop-blur-xl overflow-hidden">
    {/* Sticky Header */}
    <div className="sticky top-0 z-20 bg-card/95 backdrop-blur-xl">
      {/* Decorative gradient bar */}
      <div className="h-1 w-full gradient-primary" />

      <div className="px-4 py-4 border-b border-border/50">
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
                <Checkbox id="showTimeOff" checked={showTimeOff} onCheckedChange={checked => setShowTimeOff(checked as boolean)} />
                <label htmlFor="showTimeOff" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <Palmtree className="h-3.5 w-3.5 text-lime-800" />
                  Verlof
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="showTasks" checked={showTasks} onCheckedChange={checked => setShowTasks(checked as boolean)} />
                <label htmlFor="showTasks" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <ClipboardList className="h-3.5 w-3.5 text-blue-500" />
                  Taken
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="showDryIce" checked={showDryIce} onCheckedChange={checked => setShowDryIce(checked as boolean)} />
                <label htmlFor="showDryIce" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <Snowflake className="h-3.5 w-3.5 text-cyan-500" />
                  Droogijs
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="showGasCylinders" checked={showGasCylinders} onCheckedChange={checked => setShowGasCylinders(checked as boolean)} />
                <label htmlFor="showGasCylinders" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                  <Cylinder className="h-3.5 w-3.5 text-orange-500" />
                  Gascilinders
                </label>
              </div>
            </div>

            {/* Mobile View Toggle */}
            <div className="md:hidden">
              <ToggleGroup type="single" value={viewType} onValueChange={value => value && setViewType(value as ViewType)} className="bg-muted/50 p-1 rounded-xl border border-border/50">
                <ToggleGroupItem value="day" aria-label="Dagweergave" className="text-xs px-3 rounded-lg transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md data-[state=on]:shadow-primary/25">
                  <CalendarDays className="h-4 w-4 mr-1.5" />
                  Dag
                </ToggleGroupItem>
                <ToggleGroupItem value="list" aria-label="Lijstweergave" className="text-xs px-3 rounded-lg transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md data-[state=on]:shadow-primary/25">
                  <List className="h-4 w-4 mr-1.5" />
                  Lijst
                </ToggleGroupItem>
              </ToggleGroup>
            </div>

            <div className="hidden md:block">
              <ToggleGroup type="single" value={viewType} onValueChange={value => value && setViewType(value as ViewType)} className="bg-muted/50 p-1 rounded-xl border border-border/50">
                <ToggleGroupItem value="list" aria-label="Lijstweergave" className="text-xs px-3 rounded-lg transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md data-[state=on]:shadow-primary/25">
                  <List className="h-4 w-4 mr-1.5" />
                  Lijst
                </ToggleGroupItem>
                <ToggleGroupItem value="day" aria-label="Dagweergave" className="text-xs px-3 rounded-lg transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md data-[state=on]:shadow-primary/25">
                  <CalendarDays className="h-4 w-4 mr-1.5" />
                  Dag
                </ToggleGroupItem>
                <ToggleGroupItem value="week" aria-label="Weekweergave" className="text-xs px-3 rounded-lg transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md data-[state=on]:shadow-primary/25">
                  <Grid3X3 className="h-4 w-4 mr-1.5" />
                  Week
                </ToggleGroupItem>
                <ToggleGroupItem value="month" aria-label="Maandweergave" className="text-xs px-3 rounded-lg transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md data-[state=on]:shadow-primary/25">
                  <CalendarIcon className="h-4 w-4 mr-1.5" />
                  Maand
                </ToggleGroupItem>
                <ToggleGroupItem value="year" aria-label="Jaarweergave" className="text-xs px-3 rounded-lg transition-all data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:shadow-md data-[state=on]:shadow-primary/25">
                  <LayoutGrid className="h-4 w-4 mr-1.5" />
                  Jaar
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-6 p-3 rounded-xl bg-muted/30 border border-border/50">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-background" onClick={() => navigate("prev")}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())} className="text-xs font-medium border-primary/30 text-primary hover:bg-primary/10">
              Vandaag
            </Button>
          </div>
          <span className="text-base font-semibold capitalize text-foreground">
            {getDateRangeLabel()}
          </span>
          <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg hover:bg-background" onClick={() => navigate("next")}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </div>

    <div className="flex-1 flex flex-col overflow-auto px-4 pb-4">
      {loading ? <div className="flex-1 py-4">
        <CalendarSkeleton className="h-full" />
      </div> : <FadeIn show={!loading} className="flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div key={viewType} initial={{
            opacity: 0,
            y: 20,
            scale: 0.98
          }} animate={{
            opacity: 1,
            y: 0,
            scale: 1
          }} exit={{
            opacity: 0,
            y: -20,
            scale: 0.98
          }} transition={{
            duration: 0.3,
            ease: [0.4, 0, 0.2, 1]
          }} className="flex-1 flex flex-col">
            {viewType === "list" && renderListView()}
            {viewType === "day" && renderDayView()}
            {viewType === "week" && renderWeekView()}
            {viewType === "month" && renderMonthView()}
            {viewType === "year" && renderYearView()}
          </motion.div>
        </AnimatePresence>
      </FadeIn>}
    </div>

    {/* Calendar Item Dialog */}
    <CalendarItemDialog item={selectedItem && selectedItem.type !== "dryice" ? selectedItem as {
      type: "timeoff";
      data: RequestWithProfile;
    } | {
      type: "task";
      data: TaskWithProfile;
    } : null} open={dialogOpen && selectedItem?.type !== "dryice"} onOpenChange={setDialogOpen} onUpdate={handleDialogUpdate} isAdmin={isAdmin} profiles={profiles} />

    {/* Dry Ice Order Dialog */}
    <DryIceOrderDialog order={selectedDryIceOrder} open={dryIceDialogOpen} onOpenChange={setDryIceDialogOpen} onUpdate={handleDialogUpdate} isAdmin={isAdmin} productTypes={dryIceProductTypes} packagingOptions={dryIcePackaging} />

    {/* Create Menu Dialog */}
    <Dialog open={showCreateMenu} onOpenChange={setShowCreateMenu}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Nieuw item aanmaken
          </DialogTitle>
          <DialogDescription>
            Wat wil je aanmaken voor {createDate ? format(createDate, "d MMMM yyyy", {
              locale: nl
            }) : "deze dag"}?
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-4 py-4">
          <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-blue-50 hover:border-blue-300 dark:hover:bg-blue-950/30" onClick={handleCreateTask}>
            <ClipboardList className="h-8 w-8 text-blue-500" />
            <span className="font-medium">Taak</span>
          </Button>
          <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-primary/5 hover:border-primary/30" onClick={handleCreateLeave}>
            <Palmtree className="h-8 w-8 text-primary" />
            <span className="font-medium">Verlof</span>
          </Button>
          <Button variant="outline" className="h-24 flex flex-col items-center justify-center gap-2 hover:bg-cyan-50 hover:border-cyan-300 dark:hover:bg-cyan-950/30" onClick={handleCreateDryIce}>
            <Snowflake className="h-8 w-8 text-cyan-500" />
            <span className="font-medium">Droogijs</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Create Task Dialog */}
    <CreateTaskDialog open={createTaskDialogOpen} onOpenChange={setCreateTaskDialogOpen} onCreate={handleTaskCreated} initialDate={createDate} profiles={profiles} currentUserId={currentUserId} />

    {/* Create Leave Request Dialog */}
    <CreateLeaveRequestDialog open={createLeaveDialogOpen} onOpenChange={setCreateLeaveDialogOpen} onCreate={handleTaskCreated} initialDate={createDate} profiles={profiles} currentUserId={currentUserId} currentProfileId={currentProfileId} isAdmin={isAdmin} />

    {/* Create Dry Ice Order Dialog */}
    <CreateDryIceOrderCalendarDialog open={createDryIceDialogOpen} onOpenChange={setCreateDryIceDialogOpen} onCreate={handleTaskCreated} initialDate={createDate} />

    <AlertDialog open={moveSeriesDialogOpen} onOpenChange={setMoveSeriesDialogOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Herhalende order verplaatsen</AlertDialogTitle>
          <AlertDialogDescription>
            Dit is een herhalende order. Wil je alleen deze order verplaatsen of de hele reeks?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => {
            setMoveSeriesDialogOpen(false);
            setDraggedSeriesOrder(null);
            setMoveSeriesTargetDate(null);
          }}>Annuleren</AlertDialogCancel>
          <AlertDialogAction onClick={() => handleMoveSeries('single')}>Alleen deze</AlertDialogAction>
          <AlertDialogAction onClick={() => handleMoveSeries('series')}>Hele reeks</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>;
}