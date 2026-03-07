import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
  ChevronsDownUp,
  ClipboardList,
  Palmtree,
  Snowflake,
  Cylinder,
  Ambulance,
  Ruler,
  Printer,
  Clock,
  Play,
  CheckCircle2,
  XCircle,
  CheckCheck,
  AlertTriangle,
  Maximize2,
  Minimize2,
  Search,
  Plus,
  Filter,
  MoreVertical,
  CalendarDays,
} from "lucide-react";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  isToday,
  eachDayOfInterval,
} from "date-fns";
import { nl } from "date-fns/locale";
import { DryIceOrderDialog } from "@/components/calendar/DryIceOrderDialog";
import { GasCylinderOrderDialog } from "@/components/production/GasCylinderOrderDialog";
import { AmbulanceTripDialog } from "@/components/calendar/AmbulanceTripDialog";
import { CalendarItemDialog } from "@/components/calendar/CalendarItemDialog";
import { CreateAmbulanceTripDialog } from "@/components/calendar/CreateAmbulanceTripDialog";
import { CreateDryIceOrderCalendarDialog } from "@/components/calendar/CreateDryIceOrderCalendarDialog";
import { CreateTaskDialog } from "@/components/calendar/CreateTaskDialog";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useDebounce } from "@/hooks/use-debounce";
import { useIsMobile } from "@/hooks/use-mobile";

type ViewMode = "day" | "week";
type StatusFilter = "all" | "open" | "completed";

interface TaskItem {
  id: string;
  title: string | null;
  due_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  assignee_name?: string | null;
  notes: string | null;
  type_id: string | null;
  series_id: string | null;
  task_types: { name: string; color: string } | null;
}

interface TimeOffItem {
  id: string;
  start_date: string;
  end_date: string;
  status: string;
  day_part: string | null;
  profiles: { full_name: string | null } | null;
  time_off_types: { name: string; color: string } | null;
}

interface DryIceOrder {
  id: string;
  customer_name: string;
  quantity_kg: number;
  box_count: number | null;
  status: string;
  scheduled_date: string;
  notes: string | null;
  parent_order_id: string | null;
  dry_ice_packaging: { name: string; capacity_kg: number | null } | null;
}

interface GasCylinderOrder {
  id: string;
  customer_name: string;
  cylinder_count: number;
  cylinder_size: string;
  status: string;
  scheduled_date: string;
  notes: string | null;
  series_id: string | null;
  gas_types: { name: string } | null;
}

interface AmbulanceTrip {
  id: string;
  scheduled_date: string;
  cylinders_2l_300_o2: number;
  cylinders_2l_200_o2: number;
  cylinders_5l_o2_integrated: number;
  cylinders_1l_pindex_o2: number;
  cylinders_10l_o2_integrated: number;
  cylinders_5l_air_integrated: number;
  cylinders_2l_air_integrated: number;
  model_5l: string;
  status: string;
  notes: string | null;
  series_id: string | null;
  ambulance_trip_customers: { customer_number: string; customer_name: string }[];
}

const statusLabels: Record<string, string> = {
  pending: "Gepland",
  in_progress: "In behandeling",
  completed: "Afgerond",
  cancelled: "Geannuleerd",
};

const STATUS_CYCLE: string[] = ["pending", "in_progress", "completed"];

const STATUS_OPTIONS = [
  { value: "pending", label: "Gepland", icon: Clock },
  { value: "in_progress", label: "Bezig", icon: Play },
  { value: "completed", label: "Voltooid", icon: CheckCircle2 },
  { value: "cancelled", label: "Geannuleerd", icon: XCircle },
];

const COLLAPSED_STORAGE_KEY = "daily-overview-collapsed-sections";

function getInitialCollapsedSections(): Record<string, boolean> {
  try {
    const stored = localStorage.getItem(COLLAPSED_STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

export function DailyOverview() {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffItem[]>([]);
  const [dryIceOrders, setDryIceOrders] = useState<DryIceOrder[]>([]);
  const [gasOrders, setGasOrders] = useState<GasCylinderOrder[]>([]);
  const [ambulanceTrips, setAmbulanceTrips] = useState<AmbulanceTrip[]>([]);
  const [lookaheadActive, setLookaheadActive] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  // Collapsible sections state
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>(getInitialCollapsedSections);

  const toggleSection = useCallback((sectionKey: string) => {
    setCollapsedSections(prev => {
      const next = { ...prev, [sectionKey]: !prev[sectionKey] };
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  // Create dialog state
  const [createAmbulanceOpen, setCreateAmbulanceOpen] = useState(false);
  const [createDryIceOpen, setCreateDryIceOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  // Auth & permissions
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const { isAdmin, permissions } = useUserPermissions(userId);
  const isMobile = useIsMobile();
  const [adminProfiles, setAdminProfiles] = useState<any[]>([]);
  const [adminTimeOffTypes, setAdminTimeOffTypes] = useState<any[]>([]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id));
  }, []);

  // Fetch admin-specific data for dialogs
  useEffect(() => {
    if (!isAdmin) return;
    Promise.all([
      supabase.from("profiles").select("id, full_name, user_id").order("full_name"),
      supabase.from("time_off_types").select("*").eq("is_active", true).order("name"),
    ]).then(([profilesRes, typesRes]) => {
      setAdminProfiles(profilesRes.data ?? []);
      setAdminTimeOffTypes(typesRes.data ?? []);
    });
  }, [isAdmin]);

  // Escape key to exit fullscreen
  useEffect(() => {
    if (!isFullscreen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isFullscreen]);

  // === KEYBOARD SHORTCUTS ===
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select" || (document.activeElement as HTMLElement)?.isContentEditable) return;
      // Check if any dialog is open
      if (document.querySelector("[role='dialog']")) return;

      switch (e.key) {
        case "ArrowLeft":
          e.preventDefault();
          navigate("prev");
          break;
        case "ArrowRight":
          e.preventDefault();
          navigate("next");
          break;
        case "t":
        case "T":
          e.preventDefault();
          goToToday();
          break;
        case "d":
        case "D":
          e.preventDefault();
          setViewMode("day");
          break;
        case "w":
        case "W":
          e.preventDefault();
          setViewMode("week");
          break;
        case "f":
        case "F":
          e.preventDefault();
          setIsFullscreen(f => !f);
          break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // === SWIPE NAVIGATION ===
  const touchStartX = useRef<number | null>(null);
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  }, []);
  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const diff = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(diff) < 50) return;
    if (diff > 0) navigate("prev");
    else navigate("next");
  }, []);
  
  // Overdue tick
  const [, setOverdueTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setOverdueTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const isOverdue = useCallback((scheduledDate: string, status: string) => {
    if (["completed", "cancelled"].includes(status)) return false;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const scheduled = new Date(scheduledDate + "T00:00:00");
    if (scheduled < today) return true;
    if (scheduled.getTime() === today.getTime() && now.getHours() >= 17) return true;
    return false;
  }, []);

  // Dialog state
  const [selectedDryIceOrder, setSelectedDryIceOrder] = useState<any>(null);
  const [dryIceDialogOpen, setDryIceDialogOpen] = useState(false);
  const [selectedGasOrder, setSelectedGasOrder] = useState<any>(null);
  const [gasDialogOpen, setGasDialogOpen] = useState(false);
  const [selectedAmbulanceTrip, setSelectedAmbulanceTrip] = useState<any>(null);
  const [ambulanceDialogOpen, setAmbulanceDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [selectedTimeOff, setSelectedTimeOff] = useState<TimeOffItem | null>(null);

  // Print state
  const [printRequested, setPrintRequested] = useState<"day" | "week" | null>(null);
  const preWeekPrintViewMode = useRef<ViewMode>("day");

  // === New item tracking ===
  const STORAGE_KEY = "daily-overview-seen-ids";
  const [seenItemIds, setSeenItemIds] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed: { ids: string[]; ts: number } = JSON.parse(stored);
        if (Date.now() - parsed.ts > 7 * 24 * 60 * 60 * 1000) {
          localStorage.removeItem(STORAGE_KEY);
          return new Set<string>();
        }
        return new Set(parsed.ids);
      }
    } catch {}
    return new Set<string>();
  });

  const persistSeen = useCallback((ids: Set<string>) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ids: Array.from(ids), ts: Date.now() }));
  }, []);

  const allCurrentIds = useMemo(() => {
    const ids = new Set<string>();
    tasks.forEach(t => ids.add(t.id));
    dryIceOrders.forEach(o => ids.add(o.id));
    gasOrders.forEach(o => ids.add(o.id));
    ambulanceTrips.forEach(o => ids.add(o.id));
    return ids;
  }, [tasks, dryIceOrders, gasOrders, ambulanceTrips]);

  const newItemIds = useMemo(() => {
    const n = new Set<string>();
    allCurrentIds.forEach(id => { if (!seenItemIds.has(id)) n.add(id); });
    return n;
  }, [allCurrentIds, seenItemIds]);

  const hasNewItems = newItemIds.size > 0;

  const markAsSeen = useCallback((id: string) => {
    setSeenItemIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      persistSeen(next);
      return next;
    });
  }, [persistSeen]);

  const markSeriesAsSeen = useCallback((seriesId: string | null | undefined, itemId: string) => {
    if (!seriesId) {
      markAsSeen(itemId);
      return;
    }
    setSeenItemIds(prev => {
      const next = new Set(prev);
      tasks.forEach(t => { if (t.series_id === seriesId) next.add(t.id); });
      dryIceOrders.forEach(o => { if (o.parent_order_id === seriesId) next.add(o.id); });
      gasOrders.forEach(o => { if (o.series_id === seriesId) next.add(o.id); });
      ambulanceTrips.forEach(o => { if (o.series_id === seriesId) next.add(o.id); });
      next.add(itemId);
      persistSeen(next);
      return next;
    });
  }, [tasks, dryIceOrders, gasOrders, ambulanceTrips, markAsSeen, persistSeen]);

  const markAllAsSeen = useCallback(() => {
    setSeenItemIds(prev => {
      const next = new Set(prev);
      allCurrentIds.forEach(id => next.add(id));
      persistSeen(next);
      return next;
    });
  }, [allCurrentIds, persistSeen]);

  const isNewItem = useCallback((id: string) => newItemIds.has(id), [newItemIds]);

  // Query range
  const queryRange = useMemo(() => {
    if (viewMode === "day") {
      return { from: currentDate, to: addDays(currentDate, 3) };
    }
    return {
      from: startOfWeek(currentDate, { weekStartsOn: 1 }),
      to: endOfWeek(currentDate, { weekStartsOn: 1 }),
    };
  }, [viewMode, currentDate]);

  const dateRange = useMemo(() => {
    if (viewMode === "day") {
      return { from: currentDate, to: currentDate };
    }
    return {
      from: startOfWeek(currentDate, { weekStartsOn: 1 }),
      to: endOfWeek(currentDate, { weekStartsOn: 1 }),
    };
  }, [viewMode, currentDate]);

  const fromStr = format(queryRange.from, "yyyy-MM-dd");
  const toStr = format(queryRange.to, "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [tasksRes, timeOffRes, dryIceRes, gasRes, ambulanceRes] = await Promise.all([
      supabase
        .from("tasks")
        .select("id, title, due_date, start_time, end_time, status, priority, assigned_to, notes, type_id, series_id, task_types:type_id(name, color)")
        .gte("due_date", fromStr)
        .lte("due_date", toStr),
      supabase
        .from("time_off_requests")
        .select("id, start_date, end_date, status, day_part, profiles:profile_id(full_name), time_off_types:type_id(name, color)")
        .lte("start_date", toStr)
        .gte("end_date", fromStr)
        .eq("status", "approved"),
      supabase
        .from("dry_ice_orders")
        .select("id, customer_name, quantity_kg, box_count, status, scheduled_date, notes, parent_order_id, dry_ice_packaging:packaging_id(name, capacity_kg)")
        .gte("scheduled_date", fromStr)
        .lte("scheduled_date", toStr),
      supabase
        .from("gas_cylinder_orders")
        .select("id, customer_name, cylinder_count, cylinder_size, status, scheduled_date, notes, series_id, gas_types:gas_type_id(name)")
        .gte("scheduled_date", fromStr)
        .lte("scheduled_date", toStr),
      supabase
        .from("ambulance_trips")
        .select("id, scheduled_date, cylinders_2l_300_o2, cylinders_2l_200_o2, cylinders_5l_o2_integrated, cylinders_1l_pindex_o2, cylinders_10l_o2_integrated, cylinders_5l_air_integrated, cylinders_2l_air_integrated, model_5l, status, notes, series_id, ambulance_trip_customers(customer_number, customer_name)")
        .gte("scheduled_date", fromStr)
        .lte("scheduled_date", toStr),
    ]);

    const rawTasks = (tasksRes.data as unknown as TaskItem[]) ?? [];
    
    const assigneeIds = [...new Set(rawTasks.map(t => t.assigned_to).filter(Boolean))];
    if (assigneeIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles_limited")
        .select("id, full_name")
        .in("id", assigneeIds as string[]);
      const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) ?? []);
      rawTasks.forEach(t => { t.assignee_name = t.assigned_to ? nameMap.get(t.assigned_to) ?? null : null; });
    }
    setTasks(rawTasks);

    const allTimeOff = (timeOffRes.data as TimeOffItem[] | null) ?? [];
    const allDryIce = (dryIceRes.data as DryIceOrder[] | null) ?? [];
    const allGas = (gasRes.data as GasCylinderOrder[] | null) ?? [];
    const allAmbulance = (ambulanceRes.data as AmbulanceTrip[] | null) ?? [];

    setTimeOff(allTimeOff);
    setDryIceOrders(allDryIce);
    setGasOrders(allGas);
    setAmbulanceTrips(allAmbulance);

    if (viewMode === "day") {
      const todayStr = format(currentDate, "yyyy-MM-dd");
      const todayHasItems =
        rawTasks.some(t => t.due_date === todayStr) ||
        allTimeOff.some(t => t.start_date <= todayStr && t.end_date >= todayStr) ||
        allDryIce.some(o => o.scheduled_date === todayStr) ||
        allGas.some(o => o.scheduled_date === todayStr) ||
        allAmbulance.some(o => o.scheduled_date === todayStr);
      
      const hasAnyUpcoming = rawTasks.length > 0 || allTimeOff.length > 0 || allDryIce.length > 0 || allGas.length > 0 || allAmbulance.length > 0;
      setLookaheadActive(!todayHasItems && hasAnyUpcoming);
    } else {
      setLookaheadActive(false);
    }

    setLoading(false);
  }, [fromStr, toStr, viewMode, currentDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('daily-overview-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'time_off_requests' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dry_ice_orders' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gas_cylinder_orders' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ambulance_trips' }, () => fetchData())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchData]);

  // Print effect — waits for render, then triggers print
  useEffect(() => {
    if (printRequested && !loading) {
      const timer = setTimeout(() => {
        window.print();
        if (printRequested === "week") {
          setViewMode(preWeekPrintViewMode.current);
        }
        setPrintRequested(null);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [printRequested, loading]);

  const handlePrintDay = () => {
    setPrintRequested("day");
  };

  const handlePrintWeek = () => {
    preWeekPrintViewMode.current = viewMode;
    if (viewMode !== "week") {
      setViewMode("week");
      setPrintRequested("week");
    } else {
      setPrintRequested("week");
    }
  };

  // Click handlers
  const handleDryIceClick = async (order: DryIceOrder) => {
    markSeriesAsSeen(order.parent_order_id, order.id);
    const { data } = await supabase
      .from("dry_ice_orders")
      .select("*, product_type_info:product_type_id(id, name, description, is_active, sort_order, created_at, updated_at), packaging_info:packaging_id(id, name, capacity_kg, description, is_active, sort_order, created_at, updated_at)")
      .eq("id", order.id)
      .single();
    if (data) {
      setSelectedDryIceOrder(data);
      setDryIceDialogOpen(true);
    }
  };

  const handleGasClick = async (order: GasCylinderOrder) => {
    markSeriesAsSeen(order.series_id, order.id);
    const { data } = await supabase
      .from("gas_cylinder_orders")
      .select("*, gas_type_ref:gas_type_id(id, name, color)")
      .eq("id", order.id)
      .single();
    if (data) {
      setSelectedGasOrder(data);
      setGasDialogOpen(true);
    }
  };

  const handleAmbulanceClick = async (trip: AmbulanceTrip) => {
    markSeriesAsSeen(trip.series_id, trip.id);
    const { data } = await supabase
      .from("ambulance_trips")
      .select("*, ambulance_trip_customers(*)")
      .eq("id", trip.id)
      .single();
    if (data) {
      const formatted = {
        ...data,
        customers: (data as any).ambulance_trip_customers || [],
      };
      setSelectedAmbulanceTrip(formatted);
      setAmbulanceDialogOpen(true);
    }
  };

  const handleTaskClick = (task: TaskItem) => {
    markSeriesAsSeen(task.series_id, task.id);
    const calendarItem = {
      type: "task" as const,
      data: {
        ...task,
        created_at: new Date().toISOString(),
        created_by: "",
        updated_at: new Date().toISOString(),
        priority: task.priority || "medium",
        task_type: task.task_types ? { id: task.type_id || "", name: task.task_types.name, color: task.task_types.color, is_active: true, sort_order: 0, created_at: "", updated_at: "", description: null, parent_id: null } : null,
        profile: task.assignee_name ? { full_name: task.assignee_name } as any : null,
      },
    };
    setSelectedTask(calendarItem);
    setTaskDialogOpen(true);
  };

  const navigate = (dir: "prev" | "next") => {
    const delta = viewMode === "day" ? 1 : 7;
    setCurrentDate((d) => (dir === "next" ? addDays(d, delta) : subDays(d, delta)));
  };

  const goToToday = () => setCurrentDate(new Date());

  // Quick status change handlers
  // statusOptions moved to module-level STATUS_OPTIONS

  const handleQuickStatus = async (
    table: "ambulance_trips" | "gas_cylinder_orders" | "dry_ice_orders" | "tasks",
    id: string,
    newStatus: string,
    setter: React.Dispatch<React.SetStateAction<any[]>>,
  ) => {
    const prev = (table === "ambulance_trips" ? ambulanceTrips : table === "gas_cylinder_orders" ? gasOrders : table === "dry_ice_orders" ? dryIceOrders : tasks) as any[];
    setter((items: any[]) => items.map(i => i.id === id ? { ...i, status: newStatus } : i));
    const { error } = await supabase.from(table).update({ status: newStatus }).eq("id", id);
    if (error) {
      setter(prev);
      toast.error("Status wijzigen mislukt");
    } else {
      toast.success("Status bijgewerkt");
    }
  };

  const cycleStatus = (currentStatus: string): string => {
    const idx = STATUS_CYCLE.indexOf(currentStatus);
    return STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
  };

  const renderStatusMenu = (currentStatus: string, onSelect: (status: string) => void) => (
    <>
      {STATUS_OPTIONS.map(({ value, label, icon: Icon }) => (
        <ContextMenuItem
          key={value}
          onClick={(e) => { e.stopPropagation(); onSelect(value); }}
          className={currentStatus === value ? "font-semibold bg-accent" : ""}
        >
          <Icon className="h-4 w-4 mr-2" />
          {label}
        </ContextMenuItem>
      ))}
    </>
  );

  const headerLabel = useMemo(() => {
    if (viewMode === "day") {
      return isToday(currentDate)
        ? `Vandaag, ${format(currentDate, "d MMMM yyyy", { locale: nl })}`
        : format(currentDate, "EEEE d MMMM yyyy", { locale: nl });
    }
    return `${format(dateRange.from, "d MMM", { locale: nl })} – ${format(dateRange.to, "d MMM yyyy", { locale: nl })}`;
  }, [viewMode, currentDate, dateRange]);

  const days = useMemo(() => {
    if (viewMode === "day") {
      if (lookaheadActive) {
        return eachDayOfInterval({ start: currentDate, end: addDays(currentDate, 3) });
      }
      return [currentDate];
    }
    return eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
  }, [viewMode, currentDate, dateRange, lookaheadActive]);

  const isEmpty = tasks.length === 0 && timeOff.length === 0 && dryIceOrders.length === 0 && gasOrders.length === 0 && ambulanceTrips.length === 0;

  // === FILTERING LOGIC ===
  const matchesSearch = useCallback((text: string) => {
    if (!debouncedSearch) return true;
    return text.toLowerCase().includes(debouncedSearch.toLowerCase());
  }, [debouncedSearch]);

  const matchesStatus = useCallback((status: string) => {
    if (statusFilter === "all") return true;
    if (statusFilter === "open") return !["completed", "cancelled"].includes(status);
    if (statusFilter === "completed") return status === "completed";
    return true;
  }, [statusFilter]);

  const matchesAny = useCallback((texts: (string | null | undefined)[]) => {
    if (!debouncedSearch) return true;
    const q = debouncedSearch.toLowerCase();
    return texts.some(t => t && t.toLowerCase().includes(q));
  }, [debouncedSearch]);

  const filteredTasks = useMemo(() => tasks.filter(t =>
    matchesStatus(t.status) &&
    matchesAny([t.task_types?.name, t.title, t.notes, t.assignee_name])
  ), [tasks, matchesAny, matchesStatus]);

  const filteredDryIce = useMemo(() => dryIceOrders.filter(o =>
    matchesStatus(o.status) && matchesAny([o.customer_name, o.notes, o.dry_ice_packaging?.name])
  ), [dryIceOrders, matchesAny, matchesStatus]);

  const filteredGas = useMemo(() => gasOrders.filter(o =>
    matchesStatus(o.status) && matchesAny([o.customer_name, o.gas_types?.name, o.notes, o.cylinder_size])
  ), [gasOrders, matchesAny, matchesStatus]);

  const filteredAmbulance = useMemo(() => ambulanceTrips.filter(o =>
    matchesStatus(o.status) && matchesAny([
      ...(o.ambulance_trip_customers?.map(c => c.customer_name) || []),
      ...(o.ambulance_trip_customers?.map(c => c.customer_number) || []),
      o.notes,
    ])
  ), [ambulanceTrips, matchesAny, matchesStatus]);

  const filteredTimeOff = useMemo(() => timeOff.filter(t =>
    matchesAny([t.profiles?.full_name, t.time_off_types?.name])
  ), [timeOff, matchesAny]);

  // === PROGRESS STATS (scoped to displayed dateRange, not full queryRange) ===
  const progressStats = useMemo(() => {
    const displayFrom = format(dateRange.from, "yyyy-MM-dd");
    const displayTo = format(dateRange.to, "yyyy-MM-dd");

    const inRange = (date: string) => date >= displayFrom && date <= displayTo;
    const inRangeTimeOff = (start: string, end: string) => start <= displayTo && end >= displayFrom;

    const visibleAmbulance = filteredAmbulance.filter(o => inRange(o.scheduled_date));
    const visibleGas = filteredGas.filter(o => inRange(o.scheduled_date));
    const visibleDryIce = filteredDryIce.filter(o => inRange(o.scheduled_date));
    const visibleTasks = filteredTasks.filter(t => inRange(t.due_date));
    const visibleTimeOff = filteredTimeOff.filter(t => inRangeTimeOff(t.start_date, t.end_date));

    const allItems = [
      ...visibleAmbulance.map(o => ({ status: o.status })),
      ...visibleGas.map(o => ({ status: o.status })),
      ...visibleDryIce.map(o => ({ status: o.status })),
      ...visibleTasks.map(t => ({ status: t.status })),
    ];
    const total = allItems.length;
    const completed = allItems.filter(i => i.status === "completed").length;
    const totalDryIceKg = visibleDryIce.reduce((sum, o) => sum + Number(o.quantity_kg), 0);
    const totalCylinders = visibleGas.reduce((sum, o) => sum + o.cylinder_count, 0);
    const upcomingCount =
      (filteredAmbulance.length - visibleAmbulance.length) +
      (filteredGas.length - visibleGas.length) +
      (filteredDryIce.length - visibleDryIce.length) +
      (filteredTasks.length - visibleTasks.length);
    return {
      total,
      completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
      ambulanceCount: visibleAmbulance.length,
      gasCount: visibleGas.length,
      dryIceCount: visibleDryIce.length,
      totalDryIceKg,
      totalCylinders,
      taskCount: visibleTasks.length,
      timeOffCount: visibleTimeOff.length,
      upcomingCount,
    };
  }, [filteredAmbulance, filteredGas, filteredDryIce, filteredTasks, filteredTimeOff, dateRange]);

  // Overdue stats
  const overdueStats = useMemo(() => {
    const ambulance = ambulanceTrips.filter(o => isOverdue(o.scheduled_date, o.status)).length;
    const gas = gasOrders.filter(o => isOverdue(o.scheduled_date, o.status)).length;
    const dryIce = dryIceOrders.filter(o => isOverdue(o.scheduled_date, o.status)).length;
    const task = tasks.filter(t => isOverdue(t.due_date, t.status)).length;
    return { ambulance, gas, dryIce, task, total: ambulance + gas + dryIce + task };
  }, [ambulanceTrips, gasOrders, dryIceOrders, tasks, isOverdue]);

  const fullscreenWrapper = isFullscreen ? "fixed inset-0 z-50 bg-background overflow-auto p-4" : "";

  const isFiltering = debouncedSearch !== "" || statusFilter !== "all";

  // === COLLAPSE ALL / EXPAND ALL ===
  const SECTION_KEYS = ["ambulance", "gas", "dryice", "tasks", "timeoff"];
  const allCollapsed = useMemo(() => SECTION_KEYS.every(k => collapsedSections[k]), [collapsedSections]);
  const toggleAllSections = useCallback(() => {
    setCollapsedSections(() => {
      const newVal = !allCollapsed;
      const next: Record<string, boolean> = {};
      SECTION_KEYS.forEach(k => { next[k] = newVal; });
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, [allCollapsed]);

  // === FILTER INDICATOR (hidden sections count) ===
  const hiddenSectionsCount = useMemo(() => {
    if (!isFiltering) return 0;
    let hidden = 0;
    // Check across all days if each category has zero results
    const hasCat = (arr: any[]) => arr.length > 0;
    if (!hasCat(filteredAmbulance)) hidden++;
    if (!hasCat(filteredGas)) hidden++;
    if (!hasCat(filteredDryIce)) hidden++;
    if (!hasCat(filteredTasks)) hidden++;
    if (!hasCat(filteredTimeOff)) hidden++;
    return hidden;
  }, [isFiltering, filteredAmbulance, filteredGas, filteredDryIce, filteredTasks, filteredTimeOff]);

  return (
    <div className={fullscreenWrapper}>
      <Card className="mb-6 print-daily-overview">
        {/* Print-only header */}
        <div className="hidden print-header">
          <div>
            <div className="print-header-title">
              {printRequested === "week" ? "Weekplanning" : "Dagelijks Overzicht"}
            </div>
            <div className="text-sm text-muted-foreground capitalize">{headerLabel}</div>
          </div>
          <div className="print-header-meta">
            <div>Afgedrukt: {format(new Date(), "d MMMM yyyy 'om' HH:mm", { locale: nl })}</div>
          </div>
        </div>
        <CardHeader className="pb-3">
          {/* Mobile toolbar */}
          <div className="flex flex-col gap-2 md:hidden print:hidden">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 min-w-0">
                <Button variant="ghost" size="icon" onClick={() => navigate("prev")} className="h-9 w-9 shrink-0">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <button
                  onClick={goToToday}
                  className="text-base font-semibold capitalize hover:text-primary transition-colors truncate"
                >
                  {headerLabel}
                </button>
                <Button variant="ghost" size="icon" onClick={() => navigate("next")} className="h-9 w-9 shrink-0">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handlePrintDay}>
                    <Printer className="h-4 w-4 mr-2" /> Dag printen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePrintWeek}>
                    <Printer className="h-4 w-4 mr-2" /> Week printen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggleAllSections}>
                    {allCollapsed ? <ChevronsUpDown className="h-4 w-4 mr-2" /> : <ChevronsDownUp className="h-4 w-4 mr-2" />}
                    {allCollapsed ? "Uitklappen" : "Inklappen"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setIsFullscreen(f => !f)}>
                    {isFullscreen ? <Minimize2 className="h-4 w-4 mr-2" /> : <Maximize2 className="h-4 w-4 mr-2" />}
                    {isFullscreen ? "Fullscreen sluiten" : "Fullscreen"}
                  </DropdownMenuItem>
                  {hasNewItems && (
                    <DropdownMenuItem onClick={markAllAsSeen}>
                      <CheckCheck className="h-4 w-4 mr-2" /> Alles gelezen
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="flex items-center justify-between">
              {!isToday(currentDate) ? (
                <Button variant="outline" size="sm" onClick={goToToday} className="text-xs h-8">
                  Vandaag
                </Button>
              ) : <div />}
              <div className="flex rounded-lg border bg-muted p-0.5 ml-auto">
                <button
                  onClick={() => setViewMode("day")}
                  className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${viewMode === "day" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  Dag
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${viewMode === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  Week
                </button>
              </div>
            </div>
          </div>
          {/* Desktop toolbar */}
          <div className="hidden md:flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={() => navigate("prev")} className="print:hidden">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <button
                onClick={goToToday}
                className="text-lg font-semibold capitalize hover:text-primary transition-colors"
              >
                {headerLabel}
              </button>
              <Button variant="ghost" size="icon" onClick={() => navigate("next")} className="print:hidden">
                <ChevronRight className="h-4 w-4" />
              </Button>
              {!isToday(currentDate) && (
                <Button variant="outline" size="sm" onClick={goToToday} className="print:hidden ml-1 text-xs">
                  Vandaag
                </Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="print:hidden">
                    <Printer className="h-4 w-4 mr-1" />
                    Print
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={handlePrintDay}>
                    Dag printen
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handlePrintWeek}>
                    Weekplanning printen
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={toggleAllSections} className="print:hidden">
                    {allCollapsed ? <ChevronsUpDown className="h-4 w-4" /> : <ChevronsDownUp className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{allCollapsed ? "Alles uitklappen" : "Alles inklappen"}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" onClick={() => setIsFullscreen(f => !f)} className="print:hidden">
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{isFullscreen ? "Fullscreen sluiten" : "Fullscreen"}</TooltipContent>
              </Tooltip>
              {hasNewItems && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={markAllAsSeen} className="print:hidden text-warning hover:text-warning">
                      <CheckCheck className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Alles als gelezen markeren</TooltipContent>
                </Tooltip>
              )}
              <div className="flex rounded-lg border bg-muted p-0.5 print:hidden">
                <button
                  onClick={() => setViewMode("day")}
                  className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${viewMode === "day" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  Dag
                </button>
                <button
                  onClick={() => setViewMode("week")}
                  className={`px-3 py-1 text-sm rounded-md font-medium transition-colors ${viewMode === "week" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  Week
                </button>
              </div>
            </div>
          </div>
          {/* Print-only header label */}
          <div className="hidden print:block text-lg font-semibold capitalize">{headerLabel}</div>
        </CardHeader>
        <CardContent onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {loading ? (
            <div className="space-y-3">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-5 w-32 mt-2" />
              <Skeleton className="h-4 w-full" />
            </div>
          ) : isEmpty ? (
            <p className="text-muted-foreground text-sm py-4 text-center">
              Geen items gepland voor {viewMode === "day" ? "de komende dagen" : "deze week"}.
            </p>
          ) : (
            <>
            {/* === PROGRESS BAR + SUMMARY === */}
            <div className="mb-4 print:hidden space-y-2">
              <div className="flex items-center gap-3">
                <Progress value={progressStats.percentage} className="flex-1 h-2.5" />
                <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">
                  {progressStats.completed}/{progressStats.total} afgerond
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {progressStats.ambulanceCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400">
                    <Ambulance className="h-3 w-3" /> {progressStats.ambulanceCount}
                  </span>
                )}
                {progressStats.gasCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-400">
                    <Cylinder className="h-3 w-3" /> {progressStats.totalCylinders} cil.
                  </span>
                )}
                {progressStats.dryIceCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400">
                    <Snowflake className="h-3 w-3" /> {progressStats.totalDryIceKg} kg
                  </span>
                )}
                {progressStats.taskCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400">
                    <ClipboardList className="h-3 w-3" /> {progressStats.taskCount}
                  </span>
                )}
                {progressStats.timeOffCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400">
                    <Palmtree className="h-3 w-3" /> {progressStats.timeOffCount}
                  </span>
                )}
              </div>
            </div>

            {/* === SEARCH + FILTER === */}
            <div className="mb-4 print:hidden flex flex-col md:flex-row md:items-center gap-2">
              <div className="relative flex-1 min-w-0 md:max-w-sm">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Zoek op klant of taak..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <div className="flex rounded-lg border bg-muted p-0.5">
                {(["all", "open", "completed"] as StatusFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                      statusFilter === f ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {f === "all" ? "Alles" : f === "open" ? "Open" : "Afgerond"}
                  </button>
                ))}
              </div>
            </div>

            {/* === FILTER INDICATOR === */}
            {isFiltering && hiddenSectionsCount > 0 && (
              <div className="mb-3 print:hidden flex items-center gap-1.5 text-xs text-muted-foreground">
                <Filter className="h-3 w-3" />
                <span>{hiddenSectionsCount} {hiddenSectionsCount === 1 ? "sectie" : "secties"} verborgen door filter</span>
              </div>
            )}

            {overdueStats.total > 0 && (
              <Alert className="overdue-banner mb-4 print:hidden">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                <AlertDescription className="text-sm font-medium text-destructive">
                  <span className="font-semibold">{overdueStats.total} openstaande {overdueStats.total === 1 ? "item" : "items"}</span>
                  {" na werktijd — "}
                  {[
                    overdueStats.ambulance > 0 && `${overdueStats.ambulance} ambulance`,
                    overdueStats.gas > 0 && `${overdueStats.gas} gascilinder`,
                    overdueStats.dryIce > 0 && `${overdueStats.dryIce} droogijs`,
                    overdueStats.task > 0 && `${overdueStats.task} ${overdueStats.task === 1 ? "taak" : "taken"}`,
                  ].filter(Boolean).join(", ")}
                </AlertDescription>
              </Alert>
            )}
            {progressStats.upcomingCount > 0 && viewMode === "day" && !lookaheadActive && (
              <div className="mb-3 print:hidden flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span>
                  Er {progressStats.upcomingCount === 1 ? "staat" : "staan"} nog{" "}
                  <span className="font-medium text-foreground">{progressStats.upcomingCount} {progressStats.upcomingCount === 1 ? "item" : "items"}</span>{" "}
                  gepland in de komende dagen — klik ▶ of schakel naar weekweergave.
                </span>
              </div>
            )}
            <div className="space-y-4">
              {lookaheadActive && viewMode === "day" && (
                <p className="text-muted-foreground text-xs italic">
                  Vandaag geen items — hieronder de komende dagen:
                </p>
              )}
              {days.map((day) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const dayTasks = filteredTasks.filter((t) => t.due_date === dayStr);
                const dayTimeOff = filteredTimeOff.filter(
                  (t) => t.start_date <= dayStr && t.end_date >= dayStr
                );
                const dayDryIce = filteredDryIce.filter((o) => o.scheduled_date === dayStr);
                const dayGas = filteredGas.filter((o) => o.scheduled_date === dayStr);
                const dayAmbulance = filteredAmbulance.filter((o) => o.scheduled_date === dayStr);
                const dayEmpty = dayTasks.length === 0 && dayTimeOff.length === 0 && dayDryIce.length === 0 && dayGas.length === 0 && dayAmbulance.length === 0;

                if (dayEmpty && !printRequested && (viewMode === "week" || lookaheadActive)) return null;

                const totalDryIceKg = dayDryIce.reduce((sum, o) => sum + Number(o.quantity_kg), 0);

                return (
                  <div key={dayStr}>
                    {(viewMode === "week" || lookaheadActive) && (
                      <div className={viewMode === "week" ? "sticky top-0 z-10 bg-card py-2 -mx-3 px-3" : ""}>
                        <h4 className="text-sm font-semibold text-muted-foreground mb-1 capitalize">
                          {format(day, "EEEE d MMMM", { locale: nl })}
                          {isToday(day) && (
                            <Badge variant="secondary" className="ml-2 text-xs">Vandaag</Badge>
                          )}
                        </h4>
                        {/* Day summary badges */}
                        <div className="flex flex-wrap gap-1.5 mb-2">
                          {dayAmbulance.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-700 dark:text-red-400">
                              <Ambulance className="h-3 w-3" /> {dayAmbulance.length}
                            </span>
                          )}
                          {dayGas.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-400">
                              <Cylinder className="h-3 w-3" /> {dayGas.length}
                            </span>
                          )}
                          {dayDryIce.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-700 dark:text-cyan-400">
                              <Snowflake className="h-3 w-3" /> {totalDryIceKg} kg
                            </span>
                          )}
                          {dayTasks.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-700 dark:text-blue-400">
                              <ClipboardList className="h-3 w-3" /> {dayTasks.length}
                            </span>
                          )}
                          {dayTimeOff.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400">
                              <Palmtree className="h-3 w-3" /> {dayTimeOff.length}
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {dayEmpty ? (
                      <p className="text-xs text-muted-foreground italic py-1">Geen items gepland</p>
                    ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                      {/* Ambulance */}
                      {dayAmbulance.length > 0 && (
                        <Section
                          icon={<Ambulance className="h-4 w-4" />}
                          label="Ambulance"
                          count={dayAmbulance.length}
                          color="text-red-500"
                          badgeClass="bg-red-500/10 text-red-700 dark:text-red-400"
                          bgClass="bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900/30"
                          collapsed={collapsedSections["ambulance"]}
                          onToggle={() => toggleSection("ambulance")}
                          onAdd={isAdmin ? () => setCreateAmbulanceOpen(true) : undefined}
                        >
                          {dayAmbulance.map((o) => {
                            const cylinderItems: { label: string; count: number }[] = [];
                            if (o.cylinders_2l_300_o2 > 0) cylinderItems.push({ label: "2L 300 O2", count: o.cylinders_2l_300_o2 });
                            if (o.cylinders_2l_200_o2 > 0) cylinderItems.push({ label: "2L 200 O2", count: o.cylinders_2l_200_o2 });
                            const model5lLabel = o.model_5l === "any" ? "Laag / Hoog" : o.model_5l === "high" ? "Hoog" : o.model_5l === "low" ? "Laag" : o.model_5l || "std";
                            if (o.cylinders_5l_o2_integrated > 0) cylinderItems.push({ label: `5L O2 (${model5lLabel})`, count: o.cylinders_5l_o2_integrated });
                            if (o.cylinders_1l_pindex_o2 > 0) cylinderItems.push({ label: "1L Pindex O2", count: o.cylinders_1l_pindex_o2 });
                            if (o.cylinders_10l_o2_integrated > 0) cylinderItems.push({ label: "10L O2", count: o.cylinders_10l_o2_integrated });
                            if (o.cylinders_5l_air_integrated > 0) cylinderItems.push({ label: "5L Lucht", count: o.cylinders_5l_air_integrated });
                            if (o.cylinders_2l_air_integrated > 0) cylinderItems.push({ label: "2L Lucht", count: o.cylinders_2l_air_integrated });
                            const customers = o.ambulance_trip_customers ?? [];
                            return (
                              <ContextMenu key={o.id}>
                                <ContextMenuTrigger asChild>
                                  <div
                                    className={`text-sm space-y-1.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded p-1 -m-1 transition-colors ${o.status === "cancelled" ? "opacity-50" : ""} ${isNewItem(o.id) ? "animate-new-item" : ""} ${isOverdue(o.scheduled_date, o.status) ? "overdue-item" : ""}`}
                                    onClick={() => handleAmbulanceClick(o)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className={`font-medium text-xs uppercase tracking-wide text-muted-foreground ${o.status === "cancelled" ? "line-through" : ""}`}>Cilinders</span>
                                      <div className="flex items-center gap-1">
                                        {isNewItem(o.id) && <Badge variant="warning" className="text-[9px] px-1.5 py-0">Nieuw</Badge>}
                                        <StatusBadge status={o.status} onStatusChange={() => handleQuickStatus("ambulance_trips", o.id, cycleStatus(o.status), setAmbulanceTrips)} isMobile={isMobile} onStatusSelect={(s) => handleQuickStatus("ambulance_trips", o.id, s, setAmbulanceTrips)} />
                                      </div>
                                    </div>
                                    {cylinderItems.length > 0 ? (
                                      <ul className="space-y-0.5">
                                        {cylinderItems.map((c) => (
                                          <li key={c.label} className="flex items-center justify-between text-xs">
                                            <span className="flex items-center gap-1">{c.label}{c.label.startsWith("5L O2") && <Ruler className="h-3 w-3 text-muted-foreground" />}</span>
                                            <span className="font-semibold">{c.count}×</span>
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <p className="text-xs text-muted-foreground">Geen cilinders</p>
                                    )}
                                    {customers.length > 0 && (
                                      <div>
                                        <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Klanten</span>
                                        <ul className="mt-0.5 space-y-0">
                                          {customers.map((c) => (
                                            <li key={c.customer_number} className="text-xs text-muted-foreground">
                                              <span className="font-mono text-xs mr-1">{c.customer_number}</span>
                                              {c.customer_name}
                                            </li>
                                          ))}
                                        </ul>
                                      </div>
                                    )}
                                    {o.notes && (
                                      <p className="text-xs text-muted-foreground italic mt-1 border-t border-current/5 pt-1">
                                        {o.notes}
                                      </p>
                                    )}
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent>
                                  {renderStatusMenu(o.status, (s) => handleQuickStatus("ambulance_trips", o.id, s, setAmbulanceTrips))}
                                </ContextMenuContent>
                              </ContextMenu>
                            );
                          })}
                        </Section>
                      )}

                      {/* Gascilinders - grouped by customer */}
                      {dayGas.length > 0 && (
                        <Section
                          icon={<Cylinder className="h-4 w-4" />}
                          label="Gascilinders"
                          count={dayGas.length}
                          color="text-orange-500"
                          badgeClass="bg-orange-500/10 text-orange-700 dark:text-orange-400"
                          bgClass="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/30"
                          collapsed={collapsedSections["gas"]}
                          onToggle={() => toggleSection("gas")}
                        >
                          {(() => {
                            const grouped = new Map<string, GasCylinderOrder[]>();
                            dayGas.forEach(o => {
                              const key = o.customer_name;
                              if (!grouped.has(key)) grouped.set(key, []);
                              grouped.get(key)!.push(o);
                            });

                            return Array.from(grouped.entries()).map(([customerName, orders]) => {
                              const sizeLabels: Record<string, string> = {
                                small: "Laag",
                                medium: "Laag",
                                large: "Hoog",
                              };

                              if (orders.length === 1) {
                                const o = orders[0];
                                return (
                                  <ContextMenu key={o.id}>
                                    <ContextMenuTrigger asChild>
                                       <div
                                        className={`text-sm py-0.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded p-1 -m-1 transition-colors ${o.status === "in_progress" ? "border-l-2 border-blue-500 pl-2" : ""} ${o.status === "cancelled" ? "opacity-50" : ""} ${isNewItem(o.id) ? "animate-new-item" : ""} ${isOverdue(o.scheduled_date, o.status) ? "overdue-item" : ""}`}
                                        onClick={() => handleGasClick(o)}
                                      >
                                        <div className="flex items-center justify-between gap-2">
                                          <div className={`min-w-0 ${o.status === "cancelled" ? "line-through" : ""}`}>
                                            <div className="truncate font-medium text-xs">{o.customer_name}</div>
                                            <div className="text-xs text-muted-foreground">
                                              {o.gas_types?.name || "Gas"} — {o.cylinder_count} cil.
                                            </div>
                                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                              <Ruler className="h-3 w-3" />
                                              <span>{sizeLabels[o.cylinder_size] || o.cylinder_size}</span>
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            {isNewItem(o.id) && <Badge variant="warning" className="text-[9px] px-1.5 py-0">Nieuw</Badge>}
                                            <StatusBadge status={o.status} onStatusChange={() => handleQuickStatus("gas_cylinder_orders", o.id, cycleStatus(o.status), setGasOrders)} isMobile={isMobile} onStatusSelect={(s) => handleQuickStatus("gas_cylinder_orders", o.id, s, setGasOrders)} />
                                          </div>
                                        </div>
                                        {o.notes && (
                                          <p className="text-xs text-muted-foreground italic mt-0.5">{o.notes}</p>
                                        )}
                                      </div>
                                    </ContextMenuTrigger>
                                    <ContextMenuContent>
                                      {renderStatusMenu(o.status, (s) => handleQuickStatus("gas_cylinder_orders", o.id, s, setGasOrders))}
                                    </ContextMenuContent>
                                  </ContextMenu>
                                );
                              }

                              return (
                                <div key={customerName} className="text-sm">
                                  <div className="font-medium text-xs mb-1">{customerName}</div>
                                  <div className="pl-2 border-l border-orange-300/50 dark:border-orange-700/50 space-y-1">
                                    {orders.map(o => (
                                      <ContextMenu key={o.id}>
                                        <ContextMenuTrigger asChild>
                                          <div
                                            className={`hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded p-1 -m-1 transition-colors ${o.status === "in_progress" ? "border-l-2 border-blue-500 pl-2" : ""} ${o.status === "cancelled" ? "opacity-50" : ""} ${isNewItem(o.id) ? "animate-new-item" : ""} ${isOverdue(o.scheduled_date, o.status) ? "overdue-item" : ""}`}
                                            onClick={() => handleGasClick(o)}
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <div className={`text-xs text-muted-foreground ${o.status === "cancelled" ? "line-through" : ""}`}>
                                                {o.gas_types?.name || "Gas"} — {o.cylinder_count} cil.
                                                <span className="ml-1">
                                                  <Ruler className="h-3 w-3 inline" /> {sizeLabels[o.cylinder_size] || o.cylinder_size}
                                                </span>
                                              </div>
                                              <div className="flex items-center gap-1">
                                                {isNewItem(o.id) && <Badge variant="warning" className="text-[9px] px-1.5 py-0">Nieuw</Badge>}
                                                <StatusBadge status={o.status} onStatusChange={() => handleQuickStatus("gas_cylinder_orders", o.id, cycleStatus(o.status), setGasOrders)} isMobile={isMobile} onStatusSelect={(s) => handleQuickStatus("gas_cylinder_orders", o.id, s, setGasOrders)} />
                                              </div>
                                            </div>
                                          </div>
                                        </ContextMenuTrigger>
                                        <ContextMenuContent>
                                          {renderStatusMenu(o.status, (s) => handleQuickStatus("gas_cylinder_orders", o.id, s, setGasOrders))}
                                        </ContextMenuContent>
                                      </ContextMenu>
                                    ))}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                        </Section>
                      )}

                      {/* Droogijs */}
                      {dayDryIce.length > 0 && (
                        <Section
                          icon={<Snowflake className="h-4 w-4" />}
                          label="Droogijs"
                          count={dayDryIce.length}
                          color="text-cyan-500"
                          badgeClass="bg-cyan-500/10 text-cyan-700 dark:text-cyan-400"
                          bgClass="bg-cyan-50 dark:bg-cyan-950/20 border-cyan-200 dark:border-cyan-900/30"
                          collapsed={collapsedSections["dryice"]}
                          onToggle={() => toggleSection("dryice")}
                          onAdd={isAdmin ? () => setCreateDryIceOpen(true) : undefined}
                        >
                          {dayDryIce.map((o) => (
                            <ContextMenu key={o.id}>
                              <ContextMenuTrigger asChild>
                                <div
                                  className={`text-sm py-0.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded p-1 -m-1 transition-colors ${o.status === "in_progress" ? "border-l-2 border-blue-500 pl-2" : ""} ${o.status === "cancelled" ? "opacity-50" : ""} ${isNewItem(o.id) ? "animate-new-item" : ""} ${isOverdue(o.scheduled_date, o.status) ? "overdue-item" : ""}`}
                                  onClick={() => handleDryIceClick(o)}
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className={`min-w-0 ${o.status === "cancelled" ? "line-through" : ""}`}>
                                      <div className="truncate font-medium text-xs">{o.customer_name}</div>
                                      <div className="text-xs text-muted-foreground">
                                        {o.quantity_kg} kg
                                        {o.dry_ice_packaging?.name ? ` · ${o.dry_ice_packaging.name}` : ""}
                                        {(() => {
                                          const count = o.box_count || (o.dry_ice_packaging?.capacity_kg ? Math.ceil(o.quantity_kg / o.dry_ice_packaging.capacity_kg) : null);
                                          return count ? ` · ${count}×` : "";
                                        })()}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {isNewItem(o.id) && <Badge variant="warning" className="text-[9px] px-1.5 py-0">Nieuw</Badge>}
                                      <StatusBadge status={o.status} onStatusChange={() => handleQuickStatus("dry_ice_orders", o.id, cycleStatus(o.status), setDryIceOrders)} isMobile={isMobile} onStatusSelect={(s) => handleQuickStatus("dry_ice_orders", o.id, s, setDryIceOrders)} />
                                    </div>
                                  </div>
                                  {o.notes && (
                                    <p className="text-xs text-muted-foreground italic mt-0.5">{o.notes}</p>
                                  )}
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                {renderStatusMenu(o.status, (s) => handleQuickStatus("dry_ice_orders", o.id, s, setDryIceOrders))}
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                          {dayDryIce.length >= 1 && (
                            <div className="border-t border-cyan-300/30 dark:border-cyan-700/30 pt-1.5 mt-1 flex items-center justify-between text-xs font-semibold">
                              <span>Totaal</span>
                              <span>{totalDryIceKg} kg</span>
                            </div>
                          )}
                        </Section>
                      )}

                      {/* Taken */}
                      {dayTasks.length > 0 && (
                        <Section
                          icon={<ClipboardList className="h-4 w-4" />}
                          label="Taken"
                          count={dayTasks.length}
                          color="text-blue-500"
                          badgeClass="bg-blue-500/10 text-blue-700 dark:text-blue-400"
                          bgClass="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900/30"
                          collapsed={collapsedSections["tasks"]}
                          onToggle={() => toggleSection("tasks")}
                          onAdd={isAdmin ? () => setCreateTaskOpen(true) : undefined}
                        >
                          {dayTasks.map((t) => (
                            <ContextMenu key={t.id}>
                              <ContextMenuTrigger asChild>
                                <div
                                  className={`flex items-center gap-2 text-sm py-0.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded p-1 -m-1 transition-colors ${
                                    t.priority === "high" ? "border-l-2 border-red-500 pl-2" :
                                    t.priority === "low" ? "border-l-2 border-muted-foreground/30 pl-2" : ""
                                  } ${t.status === "cancelled" ? "opacity-50" : ""} ${isNewItem(t.id) ? "animate-new-item" : ""} ${isOverdue(t.due_date, t.status) ? "overdue-item" : ""}`}
                                  onClick={() => handleTaskClick(t)}
                                >
                                  {t.start_time && (
                                    <span className="text-muted-foreground font-mono text-xs w-24 shrink-0">
                                      {t.start_time.slice(0, 5)}
                                      {t.end_time && `–${t.end_time.slice(0, 5)}`}
                                    </span>
                                  )}
                                  <span className={`min-w-0 break-words ${t.status === "cancelled" ? "line-through" : ""}`}>
                                    {t.task_types?.name || t.title || "Taak"}
                                    {t.title && t.task_types?.name ? ` — ${t.title}` : ""}
                                  </span>
                                  <div className="flex items-center gap-1 ml-auto">
                                    {isNewItem(t.id) && <Badge variant="warning" className="text-[9px] px-1.5 py-0">Nieuw</Badge>}
                                    <StatusBadge status={t.status} onStatusChange={() => handleQuickStatus("tasks", t.id, cycleStatus(t.status), setTasks)} isMobile={isMobile} onStatusSelect={(s) => handleQuickStatus("tasks", t.id, s, setTasks)} />
                                  </div>
                                </div>
                              </ContextMenuTrigger>
                              <ContextMenuContent>
                                {renderStatusMenu(t.status, (s) => handleQuickStatus("tasks", t.id, s, setTasks))}
                              </ContextMenuContent>
                            </ContextMenu>
                          ))}
                        </Section>
                      )}

                      {/* Vrij */}
                      {dayTimeOff.length > 0 && (
                        <Section
                          icon={<Palmtree className="h-4 w-4" />}
                          label="Afwezig"
                          count={dayTimeOff.length}
                          color="text-green-500"
                          badgeClass="bg-green-500/10 text-green-700 dark:text-green-400"
                          bgClass="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30"
                          collapsed={collapsedSections["timeoff"]}
                          onToggle={() => toggleSection("timeoff")}
                        >
                          {dayTimeOff.map((t) => (
                            <Popover key={t.id}>
                              <PopoverTrigger asChild>
                                <div className="flex items-center gap-2 text-sm py-0.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded p-1 -m-1 transition-colors">
                                  <span className="truncate">
                                    {t.profiles?.full_name || "Medewerker"}
                                  </span>
                                  <span className="text-muted-foreground text-xs ml-auto shrink-0">
                                    {t.time_off_types?.name || "Verlof"}
                                    {t.day_part && t.day_part !== "full_day" && ` (${t.day_part === "morning" ? "ochtend" : "middag"})`}
                                  </span>
                                </div>
                              </PopoverTrigger>
                              <PopoverContent className="w-64 p-3">
                                <div className="space-y-1.5">
                                  <div className="font-medium text-sm">{t.profiles?.full_name || "Medewerker"}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {t.time_off_types?.name || "Verlof"}
                                    {t.day_part && t.day_part !== "full_day" && ` (${t.day_part === "morning" ? "ochtend" : "middag"})`}
                                  </div>
                                  <div className="text-xs text-muted-foreground">
                                    {format(new Date(t.start_date), "d MMM", { locale: nl })} – {format(new Date(t.end_date), "d MMM yyyy", { locale: nl })}
                                  </div>
                                </div>
                              </PopoverContent>
                            </Popover>
                          ))}
                        </Section>
                      )}
                    </div>
                    )}

                    {viewMode === "week" && <div className="border-b my-2" />}
                  </div>
                );
              })}

              {/* Empty state when filtering */}
              {isFiltering && days.every(day => {
                const dayStr = format(day, "yyyy-MM-dd");
                return (
                  filteredTasks.filter(t => t.due_date === dayStr).length === 0 &&
                  filteredTimeOff.filter(t => t.start_date <= dayStr && t.end_date >= dayStr).length === 0 &&
                  filteredDryIce.filter(o => o.scheduled_date === dayStr).length === 0 &&
                  filteredGas.filter(o => o.scheduled_date === dayStr).length === 0 &&
                  filteredAmbulance.filter(o => o.scheduled_date === dayStr).length === 0
                );
              }) && (
                <p className="text-muted-foreground text-sm py-4 text-center">
                  Geen resultaten gevonden voor "{debouncedSearch}"{statusFilter !== "all" ? ` met filter "${statusFilter === "open" ? "Open" : "Afgerond"}"` : ""}.
                </p>
              )}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Mobile Admin FAB */}
      {isMobile && isAdmin && (
        <div className="fixed bottom-6 right-6 z-50 md:hidden print:hidden">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                className="h-14 w-14 rounded-full shadow-lg p-0"
                aria-label="Nieuw toevoegen"
              >
                <Plus className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="mb-2">
              <DropdownMenuItem onClick={() => setCreateAmbulanceOpen(true)}>
                <Ambulance className="h-4 w-4 mr-2" /> Ambulance rit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateDryIceOpen(true)}>
                <Snowflake className="h-4 w-4 mr-2" /> Droogijs order
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCreateTaskOpen(true)}>
                <ClipboardList className="h-4 w-4 mr-2" /> Taak
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}

      {/* Dialogs */}
      <DryIceOrderDialog
        order={selectedDryIceOrder}
        open={dryIceDialogOpen}
        onOpenChange={setDryIceDialogOpen}
        onUpdate={fetchData}
        isAdmin={isAdmin}
        canEdit={permissions.canEditOrders}
      />

      <GasCylinderOrderDialog
        order={selectedGasOrder}
        open={gasDialogOpen}
        onOpenChange={setGasDialogOpen}
        onUpdate={fetchData}
        isAdmin={isAdmin}
        canEdit={permissions.canEditOrders}
      />

      <AmbulanceTripDialog
        trip={selectedAmbulanceTrip}
        open={ambulanceDialogOpen}
        onOpenChange={setAmbulanceDialogOpen}
        onUpdate={fetchData}
        isAdmin={isAdmin}
      />

      <CalendarItemDialog
        item={selectedTask}
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        onUpdate={fetchData}
        isAdmin={isAdmin}
        profiles={adminProfiles}
        timeOffTypes={adminTimeOffTypes}
      />

      {/* Create dialogs */}
      <CreateAmbulanceTripDialog
        open={createAmbulanceOpen}
        onOpenChange={setCreateAmbulanceOpen}
        onCreate={fetchData}
        initialDate={currentDate}
      />

      <CreateDryIceOrderCalendarDialog
        open={createDryIceOpen}
        onOpenChange={setCreateDryIceOpen}
        onCreate={fetchData}
        initialDate={currentDate}
      />

      <CreateTaskDialog
        open={createTaskOpen}
        onOpenChange={setCreateTaskOpen}
        onCreate={fetchData}
        initialDate={currentDate}
        profiles={adminProfiles}
        currentUserId={userId}
      />
    </div>
  );
}

function Section({
  icon,
  label,
  count,
  color,
  badgeClass,
  bgClass,
  collapsed,
  onToggle,
  onAdd,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  badgeClass: string;
  bgClass?: string;
  collapsed?: boolean;
  onToggle?: () => void;
  onAdd?: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-3 ${bgClass || ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 min-w-0 text-left min-h-[44px] md:min-h-0"
        >
          <span className={color}>{icon}</span>
          <span className="text-sm font-medium">{label}</span>
          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badgeClass}`}>
            {count}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform print:hidden ${collapsed ? "-rotate-90" : ""}`} />
        </button>
        {onAdd && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={onAdd}
                className="print:hidden hidden md:flex h-6 w-6 rounded-md items-center justify-center hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              >
                <Plus className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent>Nieuw toevoegen</TooltipContent>
          </Tooltip>
        )}
      </div>
      {!collapsed && (
        <div className="divide-y divide-current/5 space-y-2 md:space-y-1.5">{children}</div>
      )}
    </div>
  );
}


function StatusBadge({ status, onStatusChange, isMobile, onStatusSelect }: {
  status: string;
  onStatusChange?: () => void;
  isMobile?: boolean;
  onStatusSelect?: (status: string) => void;
}) {
  const variant =
    status === "completed" ? "success" :
    status === "in_progress" ? "info" :
    status === "cancelled" ? "destructive" :
    "secondary";

  const badge = (
    <Badge
      variant={variant}
      className={`ml-auto text-[10px] shrink-0 ${onStatusChange ? "cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-1 transition-all" : ""} ${isMobile ? "px-2.5 py-1 min-h-[28px] text-[11px]" : ""}`}
      onClick={!isMobile && onStatusChange ? (e: React.MouseEvent) => { e.stopPropagation(); onStatusChange(); } : undefined}
    >
      {statusLabels[status] || status}
    </Badge>
  );

  if (isMobile && onStatusSelect) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <span className="cursor-pointer" onClick={(e: React.MouseEvent) => e.stopPropagation()}>{badge}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {STATUS_OPTIONS.map(({ value, label, icon: Icon }) => (
            <DropdownMenuItem
              key={value}
              onClick={(e) => { e.stopPropagation(); onStatusSelect(value); }}
              className={`min-h-[44px] ${status === value ? "font-semibold bg-accent" : ""}`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return badge;
}
