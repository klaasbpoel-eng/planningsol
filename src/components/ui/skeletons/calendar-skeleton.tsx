import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkeletonBox } from "./stat-card-skeleton";

interface CalendarSkeletonProps {
  className?: string;
}

function CalendarSkeleton({ className }: CalendarSkeletonProps) {
  const weekDays = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
  
  return (
    <Card className={cn("glass-card", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <SkeletonBox className="h-6 w-32" />
          <div className="flex gap-2">
            <SkeletonBox className="h-8 w-8 rounded-md" />
            <SkeletonBox className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
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
                className="aspect-square p-1 rounded-md border border-border/50"
              >
                <SkeletonBox className="h-4 w-4 mb-1" />
                {/* Random events */}
                {Math.random() > 0.7 && (
                  <SkeletonBox className="h-2 w-full rounded-sm mt-1" />
                )}
              </div>
            ))}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export { CalendarSkeleton };
