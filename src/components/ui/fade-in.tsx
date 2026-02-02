import * as React from "react";
import { cn } from "@/lib/utils";

interface FadeInProps {
  show: boolean;
  children: React.ReactNode;
  className?: string;
  duration?: number;
}

const FadeIn = React.memo(function FadeIn({ 
  show, 
  children, 
  className,
  duration = 300 
}: FadeInProps) {
  const [shouldRender, setShouldRender] = React.useState(show);

  React.useEffect(() => {
    if (show) {
      setShouldRender(true);
    }
  }, [show]);

  if (!shouldRender) return null;

  return (
    <div
      className={cn(
        show ? "animate-fade-in-up" : "opacity-0",
        className
      )}
      style={{ animationDuration: `${duration}ms` }}
    >
      {children}
    </div>
  );
});

FadeIn.displayName = "FadeIn";

export { FadeIn };
