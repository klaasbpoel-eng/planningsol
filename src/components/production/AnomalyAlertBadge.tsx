import { AlertTriangle, TrendingUp, TrendingDown, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { AnomalyResult } from "@/hooks/useAnomalyDetection";

interface AnomalyAlertBadgeProps {
  anomaly: AnomalyResult;
  compact?: boolean;
  className?: string;
}

export function AnomalyAlertBadge({ anomaly, compact = false, className }: AnomalyAlertBadgeProps) {
  if (!anomaly.isAnomaly) return null;

  const getIcon = () => {
    if (anomaly.type === "spike") {
      return <TrendingUp className="h-3 w-3" />;
    }
    if (anomaly.type === "drop") {
      return <TrendingDown className="h-3 w-3" />;
    }
    return <AlertTriangle className="h-3 w-3" />;
  };

  const getSeverityClasses = () => {
    switch (anomaly.severity) {
      case "high":
        return "bg-destructive/15 text-destructive border-destructive/30 animate-pulse";
      case "medium":
        return "bg-warning/15 text-warning border-warning/30";
      case "low":
        return "bg-blue-500/15 text-blue-500 border-blue-500/30";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  const getLabel = () => {
    if (compact) {
      return anomaly.type === "spike" ? "↑" : anomaly.type === "drop" ? "↓" : "!";
    }
    switch (anomaly.type) {
      case "spike":
        return "Piek";
      case "drop":
        return "Daling";
      default:
        return "Ongewoon";
    }
  };

  const badge = (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[10px] font-medium transition-all",
        getSeverityClasses(),
        compact ? "px-1.5 py-0" : "px-2 py-0.5",
        className
      )}
    >
      {getIcon()}
      {!compact && <span>{getLabel()}</span>}
    </Badge>
  );

  if (!anomaly.message) return badge;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 text-warning shrink-0" />
            <div>
              <p className="font-medium text-sm">Anomalie gedetecteerd</p>
              <p className="text-xs text-muted-foreground mt-0.5">{anomaly.message}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface AnomalyAlertsPanelProps {
  anomalies: { label: string; result: AnomalyResult }[];
  className?: string;
}

export function AnomalyAlertsPanel({ anomalies, className }: AnomalyAlertsPanelProps) {
  const activeAnomalies = anomalies.filter((a) => a.result.isAnomaly);

  if (activeAnomalies.length === 0) return null;

  const highSeverity = activeAnomalies.filter((a) => a.result.severity === "high");
  const mediumSeverity = activeAnomalies.filter((a) => a.result.severity === "medium");

  return (
    <div
      className={cn(
        "rounded-lg border p-3",
        highSeverity.length > 0
          ? "bg-destructive/5 border-destructive/20"
          : mediumSeverity.length > 0
          ? "bg-warning/5 border-warning/20"
          : "bg-blue-500/5 border-blue-500/20",
        className
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">Productie-anomalieën</span>
        <Badge variant="secondary" className="ml-auto text-xs">
          {activeAnomalies.length} {activeAnomalies.length === 1 ? "alert" : "alerts"}
        </Badge>
      </div>
      <div className="space-y-1.5">
        {activeAnomalies.map((anomaly, index) => (
          <div
            key={index}
            className="flex items-center justify-between text-sm bg-background/50 rounded px-2 py-1.5"
          >
            <span className="text-muted-foreground">{anomaly.label}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs">
                {anomaly.result.percentDeviation > 0 ? "+" : ""}
                {anomaly.result.percentDeviation}%
              </span>
              <AnomalyAlertBadge anomaly={anomaly.result} compact />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
