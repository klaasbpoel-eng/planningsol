import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { CalendarDays } from "lucide-react";
import { isWithinInterval, parseISO } from "date-fns";
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
      backgroundColor: "hsl(var(--success) / 0.2)",
      color: "hsl(var(--success))",
      fontWeight: "600",
      borderRadius: "8px",
    },
    pending: {
      backgroundColor: "hsl(var(--warning) / 0.2)",
      color: "hsl(var(--warning))",
      fontWeight: "600",
      borderRadius: "8px",
    },
  };

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CalendarDays className="h-5 w-5 text-primary" />
          Calendar View
        </CardTitle>
        <CardDescription>Your scheduled time off at a glance</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex justify-center">
          <Calendar
            mode="multiple"
            selected={[...modifiers.approved, ...modifiers.pending]}
            modifiers={modifiers}
            modifiersStyles={modifiersStyles}
            className="rounded-md"
            numberOfMonths={1}
          />
        </div>
        <div className="flex flex-wrap justify-center gap-4 mt-4 pt-4 border-t">
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded bg-success/30" />
            <span className="text-muted-foreground">Approved</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-3 h-3 rounded bg-warning/30" />
            <span className="text-muted-foreground">Pending</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
