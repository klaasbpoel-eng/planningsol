import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { 
  CalendarDays, 
  ChevronLeft, 
  ChevronRight,
  Calendar as CalendarIcon,
  List,
  Grid3X3,
  LayoutGrid
} from "lucide-react";
import { 
  format, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth,
  startOfYear,
  endOfYear,
  eachDayOfInterval,
  eachWeekOfInterval,
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
  getWeek,
  getYear
} from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"] & {
  profiles?: {
    full_name: string | null;
    email: string | null;
  } | null;
};

type ViewType = "day" | "week" | "month" | "year";

export function CalendarOverview() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<ViewType>("month");
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("time_off_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("start_date", { ascending: true });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  const getRequestsForDay = (day: Date) => {
    return requests.filter((request) => {
      if (request.status === "rejected") return false;
      const start = parseISO(request.start_date);
      const end = parseISO(request.end_date);
      return isWithinInterval(day, { start, end });
    });
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
    
    return (
      <div className="space-y-4">
        <div className={cn(
          "p-6 rounded-lg border",
          isToday(currentDate) ? "ring-2 ring-primary bg-primary/5" : "bg-card"
        )}>
          <div className="text-center mb-4">
            <div className="text-4xl font-bold text-foreground">{format(currentDate, "d")}</div>
            <div className="text-lg text-muted-foreground">{format(currentDate, "EEEE", { locale: nl })}</div>
          </div>
          
          {dayRequests.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              Geen verlof gepland voor deze dag
            </div>
          ) : (
            <div className="space-y-2">
              {dayRequests.map((request) => (
                <div
                  key={request.id}
                  className={cn(
                    "p-3 rounded-lg text-sm",
                    getTypeColor(request.type, request.status)
                  )}
                >
                  <div className="font-medium">{getTypeLabel(request.type)}</div>
                  <div className="text-xs opacity-80">
                    {format(parseISO(request.start_date), "d MMM", { locale: nl })} - {format(parseISO(request.end_date), "d MMM", { locale: nl })}
                  </div>
                  {request.reason && (
                    <div className="text-xs opacity-70 mt-1">{request.reason}</div>
                  )}
                </div>
              ))}
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
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-2">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {days.map((day) => {
            const dayRequests = getRequestsForDay(day);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[120px] p-2 rounded-lg border transition-colors",
                  "bg-card border-border",
                  isCurrentDay && "ring-2 ring-primary ring-offset-1"
                )}
              >
                <div className={cn(
                  "text-sm font-medium mb-2",
                  isCurrentDay ? "text-primary" : "text-foreground"
                )}>
                  {format(day, "d")}
                </div>
                <div className="space-y-1">
                  {dayRequests.slice(0, 3).map((request) => (
                    <div
                      key={request.id}
                      className={cn(
                        "text-xs px-2 py-1 rounded truncate",
                        getTypeColor(request.type, request.status)
                      )}
                    >
                      {getTypeLabel(request.type)}
                    </div>
                  ))}
                  {dayRequests.length > 3 && (
                    <div className="text-xs text-muted-foreground">
                      +{dayRequests.length - 3} meer
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
      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((day) => {
            const dayRequests = getRequestsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={day.toISOString()}
                className={cn(
                  "min-h-[80px] p-1 rounded-lg border transition-colors",
                  isCurrentMonth 
                    ? "bg-card border-border" 
                    : "bg-muted/30 border-transparent",
                  isCurrentDay && "ring-2 ring-primary ring-offset-1"
                )}
              >
                <div className={cn(
                  "text-xs font-medium mb-1",
                  isCurrentMonth ? "text-foreground" : "text-muted-foreground/50",
                  isCurrentDay && "text-primary"
                )}>
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5">
                  {dayRequests.slice(0, 2).map((request) => (
                    <div
                      key={request.id}
                      className={cn(
                        "text-[10px] px-1 py-0.5 rounded truncate",
                        getTypeColor(request.type, request.status)
                      )}
                    >
                      {getTypeLabel(request.type)}
                    </div>
                  ))}
                  {dayRequests.length > 2 && (
                    <div className="text-[10px] text-muted-foreground">
                      +{dayRequests.length - 2}
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
      <div className="grid grid-cols-3 md:grid-cols-4 gap-4">
        {months.map((month) => {
          const monthStart = startOfMonth(month);
          const monthEnd = endOfMonth(month);
          const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });
          
          const monthRequests = requests.filter((request) => {
            if (request.status === "rejected") return false;
            const start = parseISO(request.start_date);
            const end = parseISO(request.end_date);
            return monthDays.some(day => isWithinInterval(day, { start, end }));
          });

          const isCurrentMonth = isSameMonth(month, new Date());

          return (
            <Card 
              key={month.toISOString()} 
              className={cn(
                "cursor-pointer hover:shadow-md transition-shadow",
                isCurrentMonth && "ring-2 ring-primary"
              )}
              onClick={() => {
                setCurrentDate(month);
                setViewType("month");
              }}
            >
              <CardHeader className="pb-2 pt-3 px-3">
                <CardTitle className="text-sm font-medium">
                  {format(month, "MMMM", { locale: nl })}
                </CardTitle>
              </CardHeader>
              <CardContent className="px-3 pb-3">
                {monthRequests.length === 0 ? (
                  <div className="text-xs text-muted-foreground">Geen verlof</div>
                ) : (
                  <div className="space-y-1">
                    {monthRequests.slice(0, 2).map((request) => (
                      <Badge
                        key={request.id}
                        variant="secondary"
                        className={cn(
                          "text-[10px] px-1 py-0",
                          getTypeColor(request.type, request.status)
                        )}
                      >
                        {getTypeLabel(request.type)}
                      </Badge>
                    ))}
                    {monthRequests.length > 2 && (
                      <div className="text-[10px] text-muted-foreground">
                        +{monthRequests.length - 2} meer
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
    <Card className="shadow-lg border-0">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Kalenderoverzicht
            </CardTitle>
            <CardDescription>Bekijk al uw verlofaanvragen</CardDescription>
          </div>
          
          <ToggleGroup 
            type="single" 
            value={viewType} 
            onValueChange={(value) => value && setViewType(value as ViewType)}
            className="justify-start"
          >
            <ToggleGroupItem value="day" aria-label="Dagweergave" className="text-xs px-3">
              <List className="h-4 w-4 mr-1" />
              Dag
            </ToggleGroupItem>
            <ToggleGroupItem value="week" aria-label="Weekweergave" className="text-xs px-3">
              <Grid3X3 className="h-4 w-4 mr-1" />
              Week
            </ToggleGroupItem>
            <ToggleGroupItem value="month" aria-label="Maandweergave" className="text-xs px-3">
              <CalendarIcon className="h-4 w-4 mr-1" />
              Maand
            </ToggleGroupItem>
            <ToggleGroupItem value="year" aria-label="Jaarweergave" className="text-xs px-3">
              <LayoutGrid className="h-4 w-4 mr-1" />
              Jaar
            </ToggleGroupItem>
          </ToggleGroup>
        </div>

        <div className="flex items-center justify-between mt-4">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate("prev")}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium capitalize">
            {getDateRangeLabel()}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate("next")}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <>
            {viewType === "day" && renderDayView()}
            {viewType === "week" && renderWeekView()}
            {viewType === "month" && renderMonthView()}
            {viewType === "year" && renderYearView()}
          </>
        )}

        <div className="flex flex-wrap justify-center gap-4 mt-6 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded bg-primary" />
            <span className="text-muted-foreground">Vakantie</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded bg-destructive" />
            <span className="text-muted-foreground">Ziekteverlof</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded bg-accent" />
            <span className="text-muted-foreground">Persoonlijk</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded bg-warning/80" />
            <span className="text-muted-foreground">In behandeling</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
