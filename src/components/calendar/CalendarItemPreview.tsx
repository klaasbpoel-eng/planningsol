import { ReactNode } from "react";
import { format, parseISO, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { Badge } from "@/components/ui/badge";
import {
  Palmtree,
  ClipboardList,
  User,
  Calendar,
  Clock,
  Sun,
  Sunset,
  AlertCircle,
  CheckCircle2,
  Timer
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";
import { formatTimeRange, getDayPartLabel, hasTimeInfo } from "@/lib/calendar-utils";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TaskType = Database["public"]["Tables"]["task_types"]["Row"];

type RequestWithProfile = TimeOffRequest & {
  profile?: Profile | null;
};

type TaskWithProfile = Task & {
  profile?: Profile | null;
  task_type?: TaskType | null;
};

interface CalendarItemPreviewProps {
  children: ReactNode;
  item: RequestWithProfile | TaskWithProfile;
  type: "timeoff" | "task";
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
}

export function CalendarItemPreview({
  children,
  item,
  type,
  side = "right",
  align = "center"
}: CalendarItemPreviewProps) {
  const getEmployeeName = (profile?: Profile | null) => {
    if (!profile) return "Algemeen";
    return profile.full_name || profile.email?.split("@")[0] || "Algemeen";
  };

  const getTypeLabel = (leaveType: string) => {
    switch (leaveType) {
      case "vacation": return "Vakantie";
      case "sick": return "Ziekteverlof";
      case "personal": return "Persoonlijk";
      default: return "Overig";
    }
  };

  const getTypeColor = (leaveType: string, status: string) => {
    if (status === "pending") return "bg-warning/20 text-warning border-warning/30";
    switch (leaveType) {
      case "vacation": return "bg-primary/20 text-primary border-primary/30";
      case "sick": return "bg-destructive/20 text-destructive border-destructive/30";
      case "personal": return "bg-accent/20 text-accent border-accent/30";
      default: return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved": return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
      case "pending": return <Timer className="h-3.5 w-3.5 text-warning" />;
      case "rejected": return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
      case "completed": return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
      case "in_progress": return <Timer className="h-3.5 w-3.5 text-blue-500" />;
      default: return <AlertCircle className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved": return "Goedgekeurd";
      case "pending": return "In behandeling";
      case "rejected": return "Afgewezen";
      case "completed": return "Voltooid";
      case "in_progress": return "Bezig";
      default: return "Te doen";
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high": return "bg-destructive/20 text-destructive border-destructive/30";
      case "medium": return "bg-warning/20 text-warning border-warning/30";
      case "low": return "bg-muted text-muted-foreground border-muted";
      default: return "bg-muted text-muted-foreground border-muted";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "high": return "Hoge prioriteit";
      case "medium": return "Gemiddelde prioriteit";
      case "low": return "Lage prioriteit";
      default: return "Prioriteit onbekend";
    }
  };

  if (type === "timeoff") {
    const request = item as RequestWithProfile;
    const startDate = parseISO(request.start_date);
    const endDate = parseISO(request.end_date);
    const duration = differenceInDays(endDate, startDate) + 1;

    return (
      <HoverCard openDelay={200} closeDelay={100}>
        <HoverCardTrigger asChild>
          {children}
        </HoverCardTrigger>
        <HoverCardContent
          side={side}
          align={align}
          className="w-72 p-0 overflow-hidden border-border/50 bg-popover shadow-xl z-50"
        >
          {/* Header */}
          <div className={cn(
            "px-4 py-3 border-b border-border/30",
            getTypeColor(request.type, request.status)
          )}>
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-background/50 rounded-lg backdrop-blur-sm">
                <Palmtree className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-sm truncate">{getTypeLabel(request.type)}</h4>
                <p className="text-xs opacity-80">Verlofaanvraag</p>
              </div>
              <div className="flex items-center gap-1 text-xs font-medium">
                {getStatusIcon(request.status)}
                <span>{getStatusLabel(request.status)}</span>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Employee */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Medewerker</p>
                <p className="text-sm font-medium">{getEmployeeName(request.profile)}</p>
              </div>
            </div>

            {/* Date range */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">Periode</p>
                <p className="text-sm font-medium">
                  {format(startDate, "d MMM", { locale: nl })} — {format(endDate, "d MMM yyyy", { locale: nl })}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {duration} {duration === 1 ? "dag" : "dagen"}
                </p>
              </div>
            </div>

            {/* Day part if applicable */}
            {request.day_part && request.day_part !== "full_day" && (
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted/50 rounded-lg">
                  {request.day_part === "morning" ? (
                    <Sun className="h-4 w-4 text-amber-500" />
                  ) : (
                    <Sunset className="h-4 w-4 text-orange-500" />
                  )}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Dagdeel</p>
                  <p className="text-sm font-medium">{getDayPartLabel(request.day_part)}</p>
                </div>
              </div>
            )}

            {/* Reason if available */}
            {request.reason && (
              <div className="pt-2 border-t border-border/30">
                <p className="text-xs text-muted-foreground mb-1">Reden</p>
                <p className="text-sm text-foreground/80 italic line-clamp-2">{request.reason}</p>
              </div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    );
  }

  // Task preview
  const task = item as TaskWithProfile;

  return (
    <HoverCard openDelay={200} closeDelay={100}>
      <HoverCardTrigger asChild>
        {children}
      </HoverCardTrigger>
      <HoverCardContent
        side={side}
        align={align}
        className="w-72 p-0 overflow-hidden border-border/50 bg-popover shadow-xl z-50"
      >
        {/* Header with task type color */}
        <div
          className="px-4 py-3 border-b border-border/30"
          style={{
            backgroundColor: task.task_type?.color ? `${task.task_type.color}20` : undefined,
            borderLeftWidth: 4,
            borderLeftColor: task.task_type?.color || "hsl(var(--muted))"
          }}
        >
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-background/50 rounded-lg backdrop-blur-sm">
              <ClipboardList className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="font-semibold text-sm truncate">{task.task_type?.name || "Taak"}</h4>
              <p className="text-xs text-muted-foreground">Taak</p>
            </div>
            <div className="flex items-center gap-1 text-xs font-medium">
              {getStatusIcon(task.status)}
              <span>{getStatusLabel(task.status)}</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-3">
          {/* Assigned to */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted/50 rounded-lg">
              <User className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Toegewezen aan</p>
              <p className="text-sm font-medium">{getEmployeeName(task.profile)}</p>
            </div>
          </div>

          {/* Due date */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-muted/50 rounded-lg">
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Deadline</p>
              <p className="text-sm font-medium">
                {format(parseISO(task.due_date), "EEEE d MMMM yyyy", { locale: nl })}
              </p>
            </div>
          </div>

          {/* Time if applicable */}
          {hasTimeInfo(task.start_time, task.end_time) && (
            <div className="flex items-center gap-3">
              <div className="p-2 bg-muted/50 rounded-lg">
                <Clock className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Tijd</p>
                <p className="text-sm font-medium">{formatTimeRange(task.start_time, task.end_time)}</p>
              </div>
            </div>
          )}

          {/* Priority */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/30">
            <Badge
              variant="outline"
              className={cn("text-xs", getPriorityColor(task.priority))}
            >
              {getPriorityLabel(task.priority)}
            </Badge>
          </div>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
