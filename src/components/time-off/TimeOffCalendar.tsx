import { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Sparkles } from "lucide-react";
import { parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];

interface TimeOffCalendarProps {
  requests: TimeOffRequest[];
}

export function TimeOffCalendar({ requests }: TimeOffCalendarProps) {
  const modifiers = useMemo(() => {
    const approved: Date[] = [];
    const pending: Date[] = [];
    
    requests.forEach((request) => {
      const start = parseISO(request.start_date);
      const end = parseISO(request.end_date);
      const dates = request.status === "approved" ? approved : pending;
      
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(new Date(d));
      }
    });
    
    return { approved, pending };
  }, [requests]);

  const modifiersStyles = {
    approved: {
      background: "linear-gradient(135deg, hsl(142 70% 40% / 0.25), hsl(142 70% 40% / 0.15))",
      color: "hsl(142 70% 35%)",
      fontWeight: "600",
      borderRadius: "10px",
      boxShadow: "0 2px 8px hsl(142 70% 40% / 0.2)",
      border: "1px solid hsl(142 70% 40% / 0.3)",
    },
    pending: {
      background: "linear-gradient(135deg, hsl(38 92% 50% / 0.25), hsl(38 92% 50% / 0.15))",
      color: "hsl(38 92% 40%)",
      fontWeight: "600",
      borderRadius: "10px",
      boxShadow: "0 2px 8px hsl(38 92% 50% / 0.2)",
      border: "1px solid hsl(38 92% 50% / 0.3)",
    },
  };

  const totalApproved = modifiers.approved.length;
  const totalPending = modifiers.pending.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className="glass-calendar overflow-hidden hover-glow">
        <CardHeader className="pb-4 calendar-header-modern border-b border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2.5 text-lg">
                <div className="p-2 rounded-xl bg-primary/10">
                  <CalendarDays className="h-5 w-5 text-primary" />
                </div>
                <span className="text-gradient">Kalenderweergave</span>
              </CardTitle>
              <CardDescription className="mt-1.5">Uw geplande verlof in één oogopslag</CardDescription>
            </div>
            {(totalApproved > 0 || totalPending > 0) && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="bg-success/10 text-success border-success/20 font-medium">
                  <Sparkles className="h-3 w-3 mr-1" />
                  {totalApproved} goedgekeurd
                </Badge>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="flex justify-center">
            <Calendar
              mode="multiple"
              selected={[...modifiers.approved, ...modifiers.pending]}
              modifiers={modifiers}
              modifiersStyles={modifiersStyles}
              locale={nl}
              weekStartsOn={1}
              className="rounded-xl border-0 p-2"
              numberOfMonths={1}
              classNames={{
                months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
                month: "space-y-4",
                caption: "flex justify-center pt-1 relative items-center",
                caption_label: "text-base font-semibold text-gradient",
                nav: "space-x-1 flex items-center",
                nav_button: cn(
                  "h-8 w-8 bg-transparent p-0 opacity-60 hover:opacity-100 hover:bg-primary/10 rounded-lg transition-all duration-200"
                ),
                nav_button_previous: "absolute left-1",
                nav_button_next: "absolute right-1",
                table: "w-full border-collapse",
                head_row: "flex",
                head_cell: "text-muted-foreground rounded-lg w-10 font-medium text-xs uppercase tracking-wider",
                row: "flex w-full mt-1",
                cell: cn(
                  "relative p-0.5 text-center text-sm focus-within:relative focus-within:z-20",
                  "[&:has([aria-selected])]:bg-transparent"
                ),
                day: cn(
                  "h-10 w-10 p-0 font-medium rounded-lg transition-all duration-200",
                  "hover:bg-primary/10 hover:scale-105",
                  "aria-selected:opacity-100"
                ),
                day_selected: "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground shadow-lg shadow-primary/25",
                day_today: "today-badge",
                day_outside: "text-muted-foreground/40 opacity-50",
                day_disabled: "text-muted-foreground/30",
                day_hidden: "invisible",
              }}
            />
          </div>
          <motion.div 
            className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-border/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-success/5 border border-success/20">
              <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-success/40 to-success/20 shadow-sm shadow-success/20" />
              <span className="text-sm font-medium text-success/90">Goedgekeurd</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-warning/5 border border-warning/20">
              <div className="w-4 h-4 rounded-lg bg-gradient-to-br from-warning/40 to-warning/20 shadow-sm shadow-warning/20" />
              <span className="text-sm font-medium text-warning/90">In behandeling</span>
            </div>
          </motion.div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
