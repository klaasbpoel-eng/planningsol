import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkeletonBox } from "./stat-card-skeleton";

interface TimeOffCalendarSkeletonProps {
  className?: string;
}

function TimeOffCalendarSkeleton({ className }: TimeOffCalendarSkeletonProps) {
  const weekDays = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
  
  return (
    <Card className={cn("glass-calendar overflow-hidden", className)}>
      <CardHeader className="pb-4 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <SkeletonBox className="h-9 w-9 rounded-xl" />
            <SkeletonBox className="h-5 w-36" />
          </div>
          <SkeletonBox className="h-6 w-28 rounded-full" />
        </div>
        <SkeletonBox className="h-4 w-48 mt-1.5" />
      </CardHeader>
      <CardContent className="pt-6">
        <div className="flex justify-center">
          <div className="w-full max-w-[280px]">
            {/* Month navigation */}
            <div className="flex items-center justify-between mb-4">
              <SkeletonBox className="h-8 w-8 rounded-lg" />
              <SkeletonBox className="h-5 w-24" />
              <SkeletonBox className="h-8 w-8 rounded-lg" />
            </div>
            
            {/* Week days header */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {weekDays.map((day) => (
                <div key={day} className="text-center">
                  <SkeletonBox className="h-4 w-6 mx-auto" />
                </div>
              ))}
            </div>
            
            {/* Calendar grid - 5 weeks */}
            {Array.from({ length: 5 }).map((_, weekIndex) => (
              <div key={weekIndex} className="grid grid-cols-7 gap-1 mb-1">
                {Array.from({ length: 7 }).map((_, dayIndex) => (
                  <div 
                    key={dayIndex} 
                    className="aspect-square flex items-center justify-center"
                  >
                    <SkeletonBox className="h-10 w-10 rounded-lg" />
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        
        {/* Legend */}
        <div className="flex flex-wrap justify-center gap-6 mt-6 pt-6 border-t border-border/30">
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/30">
            <SkeletonBox className="w-4 h-4 rounded-lg" />
            <SkeletonBox className="h-4 w-20" />
          </div>
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-muted/30">
            <SkeletonBox className="w-4 h-4 rounded-lg" />
            <SkeletonBox className="h-4 w-24" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { TimeOffCalendarSkeleton };
