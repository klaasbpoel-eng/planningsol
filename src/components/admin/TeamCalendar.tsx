import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight, Users } from "lucide-react";
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  isToday,
  addMonths,
  subMonths,
  parseISO,
  isWithinInterval,
  startOfWeek,
  endOfWeek
} from "date-fns";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface RequestWithProfile extends TimeOffRequest {
  profiles?: Profile | null;
}

interface TeamCalendarProps {
  requests: RequestWithProfile[];
}

export function TeamCalendar({ requests }: TeamCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const getRequestsForDay = (day: Date) => {
    return requests.filter((request) => {
      if (request.status === "rejected") return false;
      const start = parseISO(request.start_date);
      const end = parseISO(request.end_date);
      return isWithinInterval(day, { start, end });
    });
  };

  const getTypeColor = (type: string, status: string) => {
    if (status === "pending") return "bg-warning/80";
    switch (type) {
      case "vacation": return "bg-primary";
      case "sick": return "bg-destructive";
      case "personal": return "bg-accent";
      default: return "bg-muted-foreground";
    }
  };

  const weekDays = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

  // Get unique employees with time off
  const employeesOnLeave = useMemo(() => {
    const uniqueUsers = new Map<string, { name: string; count: number }>();
    requests.filter(r => r.status !== "rejected").forEach(request => {
      const name = request.profiles?.full_name || request.profiles?.email || "Unknown";
      const existing = uniqueUsers.get(request.user_id);
      if (existing) {
        existing.count++;
      } else {
        uniqueUsers.set(request.user_id, { name, count: 1 });
      }
    });
    return Array.from(uniqueUsers.values());
  }, [requests]);

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarDays className="h-5 w-5 text-primary" />
              Teamkalender
            </CardTitle>
            <CardDescription>Overzicht van alle geplande verloven</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium min-w-[120px] text-center">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Week day headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {calendarDays.map((day, index) => {
            const dayRequests = getRequestsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentMonth);
            const isCurrentDay = isToday(day);

            return (
              <div
                key={index}
                className={cn(
                  "min-h-[80px] p-1 rounded-lg border transition-colors",
                  isCurrentMonth 
                    ? "bg-card border-border" 
                    : "bg-muted/30 border-transparent",
                  isCurrentDay && "ring-2 ring-primary ring-offset-1"
                )}
              >
                <div
                  className={cn(
                    "text-xs font-medium mb-1",
                    isCurrentMonth ? "text-foreground" : "text-muted-foreground/50",
                    isCurrentDay && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5 overflow-hidden">
                  {dayRequests.slice(0, 3).map((request, i) => (
                    <div
                      key={`${request.id}-${i}`}
                      className={cn(
                        "text-[10px] px-1 py-0.5 rounded truncate text-white font-medium",
                        getTypeColor(request.type, request.status)
                      )}
                      title={`${request.profiles?.full_name || request.profiles?.email || "Unknown"} - ${request.type}${request.status === "pending" ? " (pending)" : ""}`}
                    >
                      {request.profiles?.full_name?.split(' ')[0] || request.profiles?.email?.split('@')[0] || "?"}
                    </div>
                  ))}
                  {dayRequests.length > 3 && (
                    <div className="text-[10px] text-muted-foreground px-1">
                      +{dayRequests.length - 3} meer
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-primary" />
            <span className="text-muted-foreground">Vakantie</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-destructive" />
            <span className="text-muted-foreground">Ziek</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-accent" />
            <span className="text-muted-foreground">Persoonlijk</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="w-3 h-3 rounded bg-warning/80" />
            <span className="text-muted-foreground">In behandeling</span>
          </div>
        </div>

        {/* Employee summary */}
        {employeesOnLeave.length > 0 && (
          <div className="mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 mb-3">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Medewerkers met Gepland Verlof</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {employeesOnLeave.map((emp, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {emp.name} ({emp.count})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
