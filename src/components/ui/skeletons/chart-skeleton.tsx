import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkeletonBox } from "./stat-card-skeleton";

interface ChartSkeletonProps {
  className?: string;
  height?: number;
  showLegend?: boolean;
}

function ChartSkeleton({ 
  className, 
  height = 300,
  showLegend = true 
}: ChartSkeletonProps) {
  return (
    <Card className={cn("glass-card", className)}>
      <CardHeader className="pb-2">
        <SkeletonBox className="h-5 w-40" />
        <SkeletonBox className="h-4 w-56 mt-1" />
      </CardHeader>
      <CardContent>
        <div 
          className="relative flex items-end justify-between gap-2 px-4"
          style={{ height }}
        >
          {/* Y-axis labels */}
          <div className="absolute left-0 top-0 bottom-8 flex flex-col justify-between">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBox key={i} className="h-3 w-8" />
            ))}
          </div>
          
          {/* Chart bars */}
          <div className="flex-1 flex items-end justify-around gap-3 ml-12 pb-8">
            {[65, 45, 80, 55, 70, 40, 85, 60, 50, 75, 45, 90].map((h, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2">
                <SkeletonBox 
                  className="w-full rounded-t-sm" 
                  style={{ height: `${h}%`, minHeight: 20 }} 
                />
              </div>
            ))}
          </div>
        </div>
        
        {/* X-axis labels */}
        <div className="flex justify-around ml-12 mt-2">
          {Array.from({ length: 12 }).map((_, i) => (
            <SkeletonBox key={i} className="h-3 w-6" />
          ))}
        </div>

        {/* Legend */}
        {showLegend && (
          <div className="flex justify-center gap-6 mt-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2">
                <SkeletonBox className="h-3 w-3 rounded-full" />
                <SkeletonBox className="h-3 w-16" />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { ChartSkeleton };
