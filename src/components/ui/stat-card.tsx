import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  value: number | string;
  label: string;
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
    <Card className={cn("shadow-md border-0 hover-lift", cardBgColor, className)}>
      <CardContent className="pt-6 flex items-center gap-4">
        <div className={cn("p-3 rounded-xl", iconBgColor)}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {trend && (
              <div
                className={cn(
                  "flex items-center gap-0.5 text-xs font-medium transition-all duration-200",
                  getTrendColor()
                )}
              >
                {getTrendIcon()}
                <span>{formatTrendValue()}</span>
              </div>
            )}
          </div>
          <p className="text-sm text-muted-foreground truncate">{label}</p>
          {trend?.label && (
            <p className="text-xs text-muted-foreground/70 mt-0.5">{trend.label}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
