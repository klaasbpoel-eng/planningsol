import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FloatingActionButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
  variant?: "default" | "accent" | "dryice";
}

export function FloatingActionButton({
  onClick,
  label = "Nieuwe order",
  className,
  variant = "default",
}: FloatingActionButtonProps) {
  const variantClasses = {
    default: "bg-primary text-primary-foreground hover:bg-primary/90",
    accent: "bg-accent text-accent-foreground hover:bg-accent/90",
    dryice: "bg-dryice text-dryice-foreground hover:bg-dryice/90",
  };

  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg md:hidden",
        "flex items-center justify-center p-0",
        "transition-transform hover:scale-105 active:scale-95",
        variantClasses[variant],
        className
      )}
      aria-label={label}
    >
      <Plus className="h-6 w-6" />
    </Button>
  );
}
