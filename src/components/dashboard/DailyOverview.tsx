import { useState, useEffect, useMemo, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
} from "@/components/ui/context-menu";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  ChevronLeft,
  ChevronRight,
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

type ViewMode = "day" | "week";

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
  ambulance_trip_customers: { customer_number: string; customer_name: string }[];
}

const statusLabels: Record<string, string> = {
  pending: "Gepland",
  in_progress: "In behandeling",
  completed: "Afgerond",
  cancelled: "Geannuleerd",
};

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

  // When in day mode, extend query range by 3 extra days so we can show upcoming items if today is empty
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
        .lte("due_date", toStr)
        ,
      supabase
        .from("time_off_requests")
        .select("id, start_date, end_date, status, day_part, profiles:profile_id(full_name), time_off_types:type_id(name, color)")
        .lte("start_date", toStr)
        .gte("end_date", fromStr)
        .eq("status", "approved"),
      supabase
        .from("dry_ice_orders")
        .select("id, customer_name, quantity_kg, box_count, status, scheduled_date, notes, dry_ice_packaging:packaging_id(name, capacity_kg)")
        .gte("scheduled_date", fromStr)
        .lte("scheduled_date", toStr)
        ,
      supabase
        .from("gas_cylinder_orders")
        .select("id, customer_name, cylinder_count, cylinder_size, status, scheduled_date, notes, gas_types:gas_type_id(name)")
        .gte("scheduled_date", fromStr)
        .lte("scheduled_date", toStr)
        ,
      supabase
        .from("ambulance_trips")
        .select("id, scheduled_date, cylinders_2l_300_o2, cylinders_2l_200_o2, cylinders_5l_o2_integrated, cylinders_1l_pindex_o2, cylinders_10l_o2_integrated, cylinders_5l_air_integrated, cylinders_2l_air_integrated, model_5l, status, notes, ambulance_trip_customers(customer_number, customer_name)")
        .gte("scheduled_date", fromStr)
        .lte("scheduled_date", toStr)
        ,
    ]);

    const rawTasks = (tasksRes.data as unknown as TaskItem[]) ?? [];
    
    // Fetch assignee names for tasks
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

    // In day mode, check if today is empty and we need lookahead
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

  // Click handlers
  const handleDryIceClick = async (order: DryIceOrder) => {
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
    const calendarItem = {
      type: "task" as const,
      data: {
        ...task,
        created_at: "",
        created_by: "",
        updated_at: "",
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
  const statusOptions = [
    { value: "pending", label: "Gepland", icon: Clock },
    { value: "in_progress", label: "Bezig", icon: Play },
    { value: "completed", label: "Voltooid", icon: CheckCircle2 },
    { value: "cancelled", label: "Geannuleerd", icon: XCircle },
  ];

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
      {statusOptions.map(({ value, label, icon: Icon }) => (
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

  // In day mode with lookahead, show upcoming days that have items; otherwise show the selected range
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

  return (
    <>
      <Card className="mb-6 print-daily-overview">
        {/* Print-only header */}
        <div className="hidden print-header">
          <div>
            <div className="print-header-title">Dagelijks Overzicht</div>
            <div className="text-sm text-muted-foreground capitalize">{headerLabel}</div>
          </div>
          <div className="print-header-meta">
            <div>Afgedrukt: {format(new Date(), "d MMMM yyyy 'om' HH:mm", { locale: nl })}</div>
          </div>
        </div>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
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
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.print()}
                className="print:hidden"
              >
                <Printer className="h-4 w-4 mr-1" />
                Print
              </Button>
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
        </CardHeader>
        <CardContent>
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
            <div className="space-y-4">
              {lookaheadActive && viewMode === "day" && (
                <p className="text-muted-foreground text-xs italic">
                  Vandaag geen items — hieronder de komende dagen:
                </p>
              )}
              {days.map((day) => {
                const dayStr = format(day, "yyyy-MM-dd");
                const dayTasks = tasks.filter((t) => t.due_date === dayStr);
                const dayTimeOff = timeOff.filter(
                  (t) => t.start_date <= dayStr && t.end_date >= dayStr
                );
                const dayDryIce = dryIceOrders.filter((o) => o.scheduled_date === dayStr);
                const dayGas = gasOrders.filter((o) => o.scheduled_date === dayStr);
                const dayAmbulance = ambulanceTrips.filter((o) => o.scheduled_date === dayStr);
                const dayEmpty = dayTasks.length === 0 && dayTimeOff.length === 0 && dayDryIce.length === 0 && dayGas.length === 0 && dayAmbulance.length === 0;

                if (dayEmpty && (viewMode === "week" || lookaheadActive)) return null;

                const totalDryIceKg = dayDryIce.reduce((sum, o) => sum + Number(o.quantity_kg), 0);

                return (
                  <div key={dayStr}>
                    {(viewMode === "week" || lookaheadActive) && (
                      <>
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
                      </>
                    )}

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
                                    className={`text-sm space-y-1.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded p-1 -m-1 transition-colors ${o.status === "cancelled" ? "opacity-50" : ""}`}
                                    onClick={() => handleAmbulanceClick(o)}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className={`font-medium text-xs uppercase tracking-wide text-muted-foreground ${o.status === "cancelled" ? "line-through" : ""}`}>Cilinders</span>
                                      <StatusBadge status={o.status} onStatusChange={() => handleQuickStatus("ambulance_trips", o.id, cycleStatus(o.status), setAmbulanceTrips)} />
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
                        >
                          {(() => {
                            // Group by customer
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
                                        className={`text-sm py-0.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded p-1 -m-1 transition-colors ${o.status === "in_progress" ? "border-l-2 border-blue-500 pl-2" : ""} ${o.status === "cancelled" ? "opacity-50" : ""}`}
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
                                          <StatusBadge status={o.status} onStatusChange={() => handleQuickStatus("gas_cylinder_orders", o.id, cycleStatus(o.status), setGasOrders)} />
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

                              // Multiple orders for same customer
                              return (
                                <div key={customerName} className="text-sm">
                                  <div className="font-medium text-xs mb-1">{customerName}</div>
                                  <div className="pl-2 border-l border-orange-300/50 dark:border-orange-700/50 space-y-1">
                                    {orders.map(o => (
                                      <ContextMenu key={o.id}>
                                        <ContextMenuTrigger asChild>
                                          <div
                                            className={`hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded p-1 -m-1 transition-colors ${o.status === "in_progress" ? "border-l-2 border-blue-500 pl-2" : ""} ${o.status === "cancelled" ? "opacity-50" : ""}`}
                                            onClick={() => handleGasClick(o)}
                                          >
                                            <div className="flex items-center justify-between gap-2">
                                              <div className={`text-xs text-muted-foreground ${o.status === "cancelled" ? "line-through" : ""}`}>
                                                {o.gas_types?.name || "Gas"} — {o.cylinder_count} cil.
                                                <span className="ml-1">
                                                  <Ruler className="h-3 w-3 inline" /> {sizeLabels[o.cylinder_size] || o.cylinder_size}
                                                </span>
                                              </div>
                                              <StatusBadge status={o.status} onStatusChange={() => handleQuickStatus("gas_cylinder_orders", o.id, cycleStatus(o.status), setGasOrders)} />
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
                        >
                          {dayDryIce.map((o) => (
                            <ContextMenu key={o.id}>
                              <ContextMenuTrigger asChild>
                                <div
                                  className={`text-sm py-0.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded p-1 -m-1 transition-colors ${o.status === "in_progress" ? "border-l-2 border-blue-500 pl-2" : ""} ${o.status === "cancelled" ? "opacity-50" : ""}`}
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
                                    <StatusBadge status={o.status} onStatusChange={() => handleQuickStatus("dry_ice_orders", o.id, cycleStatus(o.status), setDryIceOrders)} />
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
                        >
                          {dayTasks.map((t) => (
                            <ContextMenu key={t.id}>
                              <ContextMenuTrigger asChild>
                                <div
                                  className={`flex items-center gap-2 text-sm py-0.5 hover:bg-black/5 dark:hover:bg-white/5 cursor-pointer rounded p-1 -m-1 transition-colors ${
                                    t.priority === "high" ? "border-l-2 border-red-500 pl-2" :
                                    t.priority === "low" ? "border-l-2 border-muted-foreground/30 pl-2" : ""
                                  } ${t.status === "cancelled" ? "opacity-50" : ""}`}
                                  onClick={() => handleTaskClick(t)}
                                >
                                  {t.start_time && (
                                    <span className="text-muted-foreground font-mono text-xs w-24 shrink-0">
                                      {t.start_time.slice(0, 5)}
                                      {t.end_time && `–${t.end_time.slice(0, 5)}`}
                                    </span>
                                  )}
                                  <span className={`truncate ${t.status === "cancelled" ? "line-through" : ""}`}>
                                    {t.task_types?.name || t.title || "Taak"}
                                    {t.title && t.task_types?.name ? ` — ${t.title}` : ""}
                                  </span>
                                  <StatusBadge status={t.status} onStatusChange={() => handleQuickStatus("tasks", t.id, cycleStatus(t.status), setTasks)} />
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

                    {viewMode === "week" && <div className="border-b my-2" />}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialogs */}
      <DryIceOrderDialog
        order={selectedDryIceOrder}
        open={dryIceDialogOpen}
        onOpenChange={setDryIceDialogOpen}
        onUpdate={fetchData}
      />

      <GasCylinderOrderDialog
        order={selectedGasOrder}
        open={gasDialogOpen}
        onOpenChange={setGasDialogOpen}
        onUpdate={fetchData}
      />

      <AmbulanceTripDialog
        trip={selectedAmbulanceTrip}
        open={ambulanceDialogOpen}
        onOpenChange={setAmbulanceDialogOpen}
        onUpdate={fetchData}
        isAdmin={false}
      />

      <CalendarItemDialog
        item={selectedTask}
        open={taskDialogOpen}
        onOpenChange={setTaskDialogOpen}
        onUpdate={fetchData}
      />
    </>
  );
}

function Section({
  icon,
  label,
  count,
  color,
  badgeClass,
  bgClass,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  color: string;
  badgeClass: string;
  bgClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-lg border p-3 ${bgClass || ""}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={color}>{icon}</span>
        <span className="text-sm font-medium">{label}</span>
        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full ${badgeClass}`}>
          {count}
        </span>
      </div>
      <div className="divide-y divide-current/5 space-y-1.5">{children}</div>
    </div>
  );
}

const STATUS_CYCLE: string[] = ["pending", "in_progress", "completed"];

function StatusBadge({ status, onStatusChange }: { status: string; onStatusChange?: () => void }) {
  const variant =
    status === "completed" ? "success" :
    status === "in_progress" ? "info" :
    status === "cancelled" ? "destructive" :
    "secondary";

  return (
    <Badge
      variant={variant}
      className={`ml-auto text-[10px] shrink-0 ${onStatusChange ? "cursor-pointer hover:ring-2 hover:ring-ring hover:ring-offset-1 transition-all" : ""}`}
      onClick={onStatusChange ? (e: React.MouseEvent) => { e.stopPropagation(); onStatusChange(); } : undefined}
    >
      {statusLabels[status] || status}
    </Badge>
  );
}
