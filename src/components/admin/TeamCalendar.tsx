import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CalendarDays, ChevronLeft, ChevronRight, Users, Sun, Sunset, Sparkles } from "lucide-react";
import { getDayPartLabel } from "@/lib/calendar-utils";
import { nl } from "date-fns/locale";
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
    if (status === "pending") return "from-warning/90 to-warning/70";
    switch (type) {
      case "vacation": return "from-primary to-primary/80";
      case "sick": return "from-destructive to-destructive/80";
      case "personal": return "from-accent to-accent/80";
      default: return "from-muted-foreground to-muted-foreground/80";
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
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="glass-calendar overflow-hidden hover-glow">
        <CardHeader className="pb-4 calendar-header-modern border-b border-border/30">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="p-2 rounded-xl bg-primary/10">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <span className="text-gradient">Teamkalender</span>
              </CardTitle>
              <CardDescription className="mt-1.5">Overzicht van alle geplande verloven</CardDescription>
            </div>
            <div className="flex items-center gap-2 bg-background/50 backdrop-blur-sm rounded-xl p-1.5 border border-border/30">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-all duration-200"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <AnimatePresence mode="wait">
                <motion.span 
                  key={format(currentMonth, "yyyy-MM")}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="text-sm font-semibold min-w-[140px] text-center capitalize"
                >
                  {format(currentMonth, "MMMM yyyy", { locale: nl })}
                </motion.span>
              </AnimatePresence>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary transition-all duration-200"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-1.5 mb-3">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-semibold text-muted-foreground py-2 uppercase tracking-wider"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {calendarDays.map((day, index) => {
              const dayRequests = getRequestsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isCurrentDay = isToday(day);

              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2, delay: index * 0.005 }}
                  className={cn(
                    "min-h-[90px] p-1.5 rounded-xl transition-all duration-300",
                    isCurrentMonth 
                      ? "glass-day-cell" 
                      : "bg-muted/20 opacity-40",
                    isCurrentDay && "today-indicator",
                    dayRequests.length > 0 && isCurrentMonth && "hover:scale-[1.02]"
                  )}
                >
                  <div
                    className={cn(
                      "text-xs font-semibold mb-1.5 px-1",
                      isCurrentMonth ? "text-foreground" : "text-muted-foreground/50",
                      isCurrentDay && "text-primary"
                    )}
                  >
                    <span className={cn(
                      "inline-flex items-center justify-center w-6 h-6 rounded-lg",
                      isCurrentDay && "today-badge"
                    )}>
                      {format(day, "d")}
                    </span>
                  </div>
                  <div className="space-y-1 overflow-hidden">
                    {dayRequests.slice(0, 3).map((request, i) => (
                      <motion.div
                        key={`${request.id}-${i}`}
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className={cn(
                          "calendar-item-modern text-[10px] text-white flex items-center gap-1 bg-gradient-to-r",
                          getTypeColor(request.type, request.status)
                        )}
                        title={`${request.profiles?.full_name || request.profiles?.email || "Unknown"} - ${request.type}${request.status === "pending" ? " (pending)" : ""}${request.day_part && request.day_part !== "full_day" ? ` (${getDayPartLabel(request.day_part)})` : ""}`}
                      >
                        {request.day_part === "morning" ? (
                          <Sun className="w-2.5 h-2.5 shrink-0" />
                        ) : request.day_part === "afternoon" ? (
                          <Sunset className="w-2.5 h-2.5 shrink-0" />
                        ) : null}
                        <span className="truncate">
                          {request.profiles?.full_name?.split(' ')[0] || request.profiles?.email?.split('@')[0] || "?"}
                        </span>
                      </motion.div>
                    ))}
                    {dayRequests.length > 3 && (
                      <div className="text-[10px] text-muted-foreground px-1.5 font-medium">
                        +{dayRequests.length - 3} meer
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Legend */}
          <motion.div 
            className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-border/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
              <div className="w-3 h-3 rounded-md bg-gradient-to-br from-primary to-primary/70 shadow-sm" />
              <span className="text-xs font-medium text-muted-foreground">Vakantie</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-destructive/5 border border-destructive/10">
              <div className="w-3 h-3 rounded-md bg-gradient-to-br from-destructive to-destructive/70 shadow-sm" />
              <span className="text-xs font-medium text-muted-foreground">Ziek</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-accent/5 border border-accent/10">
              <div className="w-3 h-3 rounded-md bg-gradient-to-br from-accent to-accent/70 shadow-sm" />
              <span className="text-xs font-medium text-muted-foreground">Persoonlijk</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-warning/5 border border-warning/10">
              <div className="w-3 h-3 rounded-md bg-gradient-to-br from-warning to-warning/70 shadow-sm" />
              <span className="text-xs font-medium text-muted-foreground">In behandeling</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/30 ml-auto">
              <Sun className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-xs font-medium text-muted-foreground">Ochtend</span>
            </div>
            <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg border border-border/30">
              <Sunset className="w-3.5 h-3.5 text-orange-500" />
              <span className="text-xs font-medium text-muted-foreground">Middag</span>
            </div>
          </motion.div>

          {/* Employee summary */}
          {employeesOnLeave.length > 0 && (
            <motion.div 
              className="mt-6 pt-6 border-t border-border/30"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <div className="flex items-center gap-2.5 mb-4">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <span className="text-sm font-semibold">Medewerkers met Gepland Verlof</span>
                <Badge variant="secondary" className="ml-auto text-xs">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {employeesOnLeave.length} medewerkers
                </Badge>
              </div>
              <div className="flex flex-wrap gap-2">
                {employeesOnLeave.map((emp, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.03 }}
                  >
                    <Badge 
                      variant="secondary" 
                      className="text-xs font-medium px-3 py-1.5 bg-gradient-to-r from-secondary to-secondary/80 hover:from-primary/10 hover:to-primary/5 transition-all duration-200"
                    >
                      {emp.name} 
                      <span className="ml-1.5 text-muted-foreground">({emp.count})</span>
                    </Badge>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
