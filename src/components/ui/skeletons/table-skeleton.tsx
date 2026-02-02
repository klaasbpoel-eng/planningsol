import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { SkeletonBox } from "./stat-card-skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
  showHeader?: boolean;
}

function TableSkeleton({ 
  rows = 5, 
  columns = 6, 
  className,
  showHeader = true 
}: TableSkeletonProps) {
  return (
    <Card className={cn("glass-card", className)}>
      {showHeader && (
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <SkeletonBox className="h-6 w-40" />
            <div className="flex gap-2">
              <SkeletonBox className="h-9 w-24" />
              <SkeletonBox className="h-9 w-24" />
            </div>
          </div>
        </CardHeader>
      )}
      <CardContent className="pt-0">
        <div className="rounded-md border">
          {/* Table Header */}
          <div className="border-b bg-muted/30 p-3">
            <div className="flex gap-4">
              {Array.from({ length: columns }).map((_, i) => (
                <SkeletonBox 
                  key={i} 
                  className={cn(
                    "h-4",
                    i === 0 ? "w-16" : i === columns - 1 ? "w-20 ml-auto" : "w-24"
                  )} 
                />
              ))}
            </div>
          </div>
          {/* Table Rows */}
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <div 
              key={rowIndex} 
              className={cn(
                "flex items-center gap-4 p-3",
                rowIndex !== rows - 1 && "border-b"
              )}
            >
              {Array.from({ length: columns }).map((_, colIndex) => (
                <SkeletonBox 
                  key={colIndex} 
                  className={cn(
                    "h-4",
                    colIndex === 0 ? "w-16" : colIndex === columns - 1 ? "w-20 ml-auto" : "w-20"
                  )} 
                />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export { TableSkeleton };
