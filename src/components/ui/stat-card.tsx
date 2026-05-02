import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  value: number | string;
  label: ReactNode;
  icon: ReactNode;
  iconBgColor?: string;
  cardBgColor?: string;
  trend?: {
    /** Pass `null` to indicate "no comparable baseline" (avoids fake +999% / -999%). */
    value: number | null;
    label?: string;
  };
  className?: string;
}

export function StatCard({
  value,
  label,
  icon,
  iconBgColor = "bg-primary/10",
  cardBgColor = "",
  trend,
  className,
}: StatCardProps) {
  const trendValue = trend?.value;
  // A change is only visually emphasised when it's >=5% — smaller deltas are noise.
  const isMeaningful =
    trendValue !== null && trendValue !== undefined && Math.abs(trendValue) >= 5;

  const getTrendIcon = () => {
    if (!trend) return null;
    if (trendValue === null || !isMeaningful) return <Minus className="h-3 w-3" />;
    if (trendValue! > 0) return <TrendingUp className="h-3 w-3" />;
    return <TrendingDown className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (!trend) return "";
    if (trendValue === null || !isMeaningful) return "text-muted-foreground";
    if (trendValue! > 0) return "text-success";
    return "text-destructive";
  };

  const formatTrendValue = () => {
    if (!trend) return "";
    if (trendValue === null) return "—";
    const capped = Math.max(-500, Math.min(500, trendValue!));
    const prefix = capped > 0 ? "+" : "";
    if (capped >= 500) return "+500%+";
    if (capped <= -500) return "−500%+";
    return `${prefix}${capped}%`;
  };

  return (
    <Card className={cn("shadow-md border-0 hover-lift overflow-hidden", cardBgColor, className)}>
      <CardContent className="pt-5 pb-4 px-4 flex items-start gap-3">
        <div className={cn("p-2.5 rounded-xl shrink-0", iconBgColor)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5 flex-wrap">
            <p className="text-2xl font-bold text-foreground leading-tight">{value}</p>
            {trend && (
              <div
                className={cn(
                  "flex items-center gap-0.5 text-[11px] font-medium whitespace-nowrap",
                  getTrendColor()
                )}
              >
                {getTrendIcon()}
                <span>{formatTrendValue()}</span>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          {trend?.label && (
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">{trend.label}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
