import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";
import { format, subDays, startOfDay, eachDayOfInterval, parseISO, isSameDay, isBefore } from "date-fns";
import { nl } from "date-fns/locale";
import type { Database } from "@/integrations/supabase/types";

type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface TaskProgressChartProps {
  tasks: Task[];
}

const chartConfig = {
  completed: {
    label: "Afgerond",
    color: "hsl(var(--success))",
  },
  pending: {
    label: "Openstaand",
    color: "hsl(var(--warning))",
  },
};

export function TaskProgressChart({ tasks }: TaskProgressChartProps) {
  const chartData = useMemo(() => {
    const today = startOfDay(new Date());
    const startDate = subDays(today, 13); // Last 14 days
    
    const days = eachDayOfInterval({ start: startDate, end: today });
    
    return days.map((day) => {
      // Count tasks that were due on or before this day
      const tasksUpToDay = tasks.filter((task) => {
        const dueDate = parseISO(task.due_date);
        return isBefore(dueDate, day) || isSameDay(dueDate, day);
      });
      
      const completed = tasksUpToDay.filter((t) => t.status === "completed").length;
      const pending = tasksUpToDay.filter((t) => t.status !== "completed").length;
      
      return {
        date: format(day, "d MMM", { locale: nl }),
        completed,
        pending,
        total: completed + pending,
      };
    });
  }, [tasks]);

  const totalCompleted = tasks.filter((t) => t.status === "completed").length;
  const totalTasks = tasks.length;
  const completionRate = totalTasks > 0 ? Math.round((totalCompleted / totalTasks) * 100) : 0;

  return (
    <Card className="shadow-md border-0">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Taakvoortgang
          </CardTitle>
          <div className="text-right">
            <p className="text-2xl font-bold text-success">{completionRate}%</p>
            <p className="text-xs text-muted-foreground">Voltooiingsgraad</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[200px] w-full">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--success))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--success))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPending" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--warning))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--warning))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis 
              dataKey="date" 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              interval="preserveStartEnd"
            />
            <YAxis 
              axisLine={false} 
              tickLine={false} 
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              allowDecimals={false}
            />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Area
              type="monotone"
              dataKey="completed"
              stroke="hsl(var(--success))"
              strokeWidth={2}
              fill="url(#colorCompleted)"
              name="Afgerond"
            />
            <Area
              type="monotone"
              dataKey="pending"
              stroke="hsl(var(--warning))"
              strokeWidth={2}
              fill="url(#colorPending)"
              name="Openstaand"
            />
          </AreaChart>
        </ChartContainer>
        <div className="flex items-center justify-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-success" />
            <span className="text-muted-foreground">Afgerond ({totalCompleted})</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-warning" />
            <span className="text-muted-foreground">Openstaand ({totalTasks - totalCompleted})</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
