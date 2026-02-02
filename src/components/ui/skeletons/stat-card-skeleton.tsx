import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

interface StatCardSkeletonProps {
  count?: number;
  className?: string;
}

function SkeletonBox({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-muted",
        className
      )}
      style={style}
    >
      <div className="absolute inset-0 -translate-x-full animate-skeleton-shimmer bg-gradient-to-r from-transparent via-primary/5 to-transparent" />
    </div>
  );
}

function StatCardSkeleton({ count = 4, className }: StatCardSkeletonProps) {
  return (
    <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <SkeletonBox className="h-4 w-24" />
            <SkeletonBox className="h-4 w-4 rounded-full" />
          </CardHeader>
          <CardContent>
            <SkeletonBox className="h-8 w-20 mb-2" />
            <SkeletonBox className="h-3 w-32" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export { StatCardSkeleton, SkeletonBox };
