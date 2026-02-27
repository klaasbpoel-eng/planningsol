import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Palmtree,
  Snowflake,
  Cylinder,
  Ambulance,
  Ruler,
} from "lucide-react";
import {
  format,
  addDays,
  subDays,
  startOfWeek,
  endOfWeek,
  isToday,
  eachDayOfInterval,
  isSameDay,
} from "date-fns";
import { nl } from "date-fns/locale";

type ViewMode = "day" | "week";

interface TaskItem {
  id: string;
  title: string | null;
  due_date: string;
  start_time: string | null;
  end_time: string | null;
  status: string;
  assigned_to: string | null;
  assignee_name?: string | null;
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
  status: string;
  scheduled_date: string;
}

interface GasCylinderOrder {
  id: string;
  customer_name: string;
  cylinder_count: number;
  cylinder_size: string;
  status: string;
  scheduled_date: string;
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

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [tasksRes, timeOffRes, dryIceRes, gasRes, ambulanceRes] = await Promise.all([
        supabase
          .from("tasks")
          .select("id, title, due_date, start_time, end_time, status, assigned_to, task_types:type_id(name, color)")
          .gte("due_date", fromStr)
          .lte("due_date", toStr)
          .neq("status", "cancelled"),
        supabase
          .from("time_off_requests")
          .select("id, start_date, end_date, status, day_part, profiles:profile_id(full_name), time_off_types:type_id(name, color)")
          .lte("start_date", toStr)
          .gte("end_date", fromStr)
          .eq("status", "approved"),
        supabase
          .from("dry_ice_orders")
          .select("id, customer_name, quantity_kg, status, scheduled_date")
          .gte("scheduled_date", fromStr)
          .lte("scheduled_date", toStr)
          .neq("status", "cancelled")
          .neq("status", "completed"),
        supabase
          .from("gas_cylinder_orders")
          .select("id, customer_name, cylinder_count, cylinder_size, status, scheduled_date, gas_types:gas_type_id(name)")
          .gte("scheduled_date", fromStr)
          .lte("scheduled_date", toStr)
          .neq("status", "cancelled")
          .neq("status", "completed"),
        supabase
          .from("ambulance_trips")
          .select("id, scheduled_date, cylinders_2l_300_o2, cylinders_2l_200_o2, cylinders_5l_o2_integrated, cylinders_1l_pindex_o2, cylinders_10l_o2_integrated, cylinders_5l_air_integrated, cylinders_2l_air_integrated, model_5l, status, notes, ambulance_trip_customers(customer_number, customer_name)")
          .gte("scheduled_date", fromStr)
          .lte("scheduled_date", toStr)
          .neq("status", "cancelled"),
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
    };
    fetchData();
  }, [fromStr, toStr, viewMode, currentDate]);

  const navigate = (dir: "prev" | "next") => {
    const delta = viewMode === "day" ? 1 : 7;
    setCurrentDate((d) => (dir === "next" ? addDays(d, delta) : subDays(d, delta)));
  };

  const goToToday = () => setCurrentDate(new Date());

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
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate("prev")}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={goToToday}
              className="text-lg font-semibold capitalize hover:text-primary transition-colors"
            >
              {headerLabel}
            </button>
            <Button variant="ghost" size="icon" onClick={() => navigate("next")}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex rounded-lg border bg-muted p-0.5">
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

              return (
                <div key={dayStr}>
                  {(viewMode === "week" || lookaheadActive) && (
                    <h4 className="text-sm font-semibold text-muted-foreground mb-2 capitalize">
                      {format(day, "EEEE d MMMM", { locale: nl })}
                      {isToday(day) && (
                        <Badge variant="secondary" className="ml-2 text-xs">Vandaag</Badge>
                      )}
                    </h4>
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
                          if (o.cylinders_5l_o2_integrated > 0) cylinderItems.push({ label: `5L O2 (${o.model_5l || "std"})`, count: o.cylinders_5l_o2_integrated });
                          if (o.cylinders_1l_pindex_o2 > 0) cylinderItems.push({ label: "1L Pindex O2", count: o.cylinders_1l_pindex_o2 });
                          if (o.cylinders_10l_o2_integrated > 0) cylinderItems.push({ label: "10L O2", count: o.cylinders_10l_o2_integrated });
                          if (o.cylinders_5l_air_integrated > 0) cylinderItems.push({ label: "5L Lucht", count: o.cylinders_5l_air_integrated });
                          if (o.cylinders_2l_air_integrated > 0) cylinderItems.push({ label: "2L Lucht", count: o.cylinders_2l_air_integrated });
                          const customers = o.ambulance_trip_customers ?? [];
                          return (
                            <div key={o.id} className="text-sm space-y-1.5">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-xs uppercase tracking-wide text-muted-foreground">Cilinders</span>
                                <StatusBadge status={o.status} />
                              </div>
                              {cylinderItems.length > 0 ? (
                                <ul className="space-y-0.5">
                                  {cylinderItems.map((c) => (
                                    <li key={c.label} className="flex items-center justify-between text-xs">
                                      <span>{c.label}</span>
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
                                        <span className="font-mono text-[10px] mr-1">{c.customer_number}</span>
                                        {c.customer_name}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </Section>
                    )}

                    {/* Gascilinders */}
                    {dayGas.length > 0 && (
                      <Section
                        icon={<Cylinder className="h-4 w-4" />}
                        label="Gascilinders"
                        count={dayGas.length}
                        color="text-orange-500"
                        badgeClass="bg-orange-500/10 text-orange-700 dark:text-orange-400"
                        bgClass="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900/30"
                      >
                        {dayGas.map((o) => {
                          const sizeLabels: Record<string, string> = {
                            small: "Klein",
                            medium: "Middel",
                            large: "Groot",
                          };
                          return (
                          <div key={o.id} className="flex items-center justify-between text-sm py-0.5 gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-xs">{o.customer_name}</div>
                              <div className="text-xs text-muted-foreground">
                                {o.gas_types?.name || "Gas"} — {o.cylinder_count} cil.
                              </div>
                              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                <Ruler className="h-3 w-3" />
                                <span>{sizeLabels[o.cylinder_size] || o.cylinder_size}</span>
                              </div>
                            </div>
                            <StatusBadge status={o.status} />
                          </div>
                          );
                        })}
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
                          <div key={o.id} className="flex items-center justify-between text-sm py-0.5 gap-2">
                            <div className="min-w-0">
                              <div className="truncate font-medium text-xs">{o.customer_name}</div>
                              <div className="text-xs text-muted-foreground">{o.quantity_kg} kg</div>
                            </div>
                            <StatusBadge status={o.status} />
                          </div>
                        ))}
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
                          <div key={t.id} className="flex items-center gap-2 text-sm py-0.5">
                            {t.start_time && (
                              <span className="text-muted-foreground font-mono text-xs w-24 shrink-0">
                                {t.start_time.slice(0, 5)}
                                {t.end_time && `–${t.end_time.slice(0, 5)}`}
                              </span>
                            )}
                            <span className="truncate">
                              {t.task_types?.name || t.title || "Taak"}
                              {t.title && t.task_types?.name ? ` — ${t.title}` : ""}
                            </span>
                            <span className="text-muted-foreground text-xs ml-auto shrink-0">
                              {t.assignee_name || "Algemeen"}
                            </span>
                          </div>
                        ))}
                      </Section>
                    )}

                    {/* Vrij */}
                    {dayTimeOff.length > 0 && (
                      <Section
                        icon={<Palmtree className="h-4 w-4" />}
                        label="Vrij"
                        count={dayTimeOff.length}
                        color="text-green-500"
                        badgeClass="bg-green-500/10 text-green-700 dark:text-green-400"
                        bgClass="bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900/30"
                      >
                        {dayTimeOff.map((t) => (
                          <div key={t.id} className="flex items-center gap-2 text-sm py-0.5">
                            <span className="truncate">
                              {t.profiles?.full_name || "Medewerker"}
                            </span>
                            <span className="text-muted-foreground text-xs ml-auto shrink-0">
                              {t.time_off_types?.name || "Verlof"}
                              {t.day_part && t.day_part !== "full_day" && ` (${t.day_part === "morning" ? "ochtend" : "middag"})`}
                            </span>
                          </div>
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

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed" ? "success" :
    status === "in_progress" ? "info" :
    status === "pending" ? "secondary" :
    "outline";

  return (
    <Badge variant={variant} className="ml-auto text-[10px] shrink-0">
      {statusLabels[status] || status}
    </Badge>
  );
}
