import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Trophy } from "lucide-react";
import { SkeletonBox } from "./stat-card-skeleton";

interface CustomerListSkeletonProps {
  count?: number;
  className?: string;
}

function CustomerListSkeleton({ count = 5, className }: CustomerListSkeletonProps) {
  return (
    <Card className={cn("glass-card", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Trophy className="h-4 w-4 text-yellow-500" />
          <SkeletonBox className="h-4 w-32" />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between p-2 rounded-lg bg-muted/30"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <SkeletonBox className="h-6 w-6 rounded-full" />
              <div className="flex-1 min-w-0">
                <SkeletonBox className="h-4 w-32 mb-1" />
                <div className="flex items-center gap-2">
                  <SkeletonBox className="h-3 w-16" />
                  <SkeletonBox className="h-3 w-16" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <SkeletonBox className="h-3 w-3" />
              <SkeletonBox className="h-5 w-12 rounded-full" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export { CustomerListSkeleton };
