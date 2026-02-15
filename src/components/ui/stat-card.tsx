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
    value: number;
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
  const getTrendIcon = () => {
    if (!trend) return null;
    if (trend.value > 0) {
      return <TrendingUp className="h-3 w-3" />;
    } else if (trend.value < 0) {
      return <TrendingDown className="h-3 w-3" />;
    }
    return <Minus className="h-3 w-3" />;
  };

  const getTrendColor = () => {
    if (!trend) return "";
    if (trend.value > 0) return "text-success";
    if (trend.value < 0) return "text-destructive";
    return "text-muted-foreground";
  };

  const formatTrendValue = () => {
    if (!trend) return "";
    const prefix = trend.value > 0 ? "+" : "";
    return `${prefix}${trend.value}%`;
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
