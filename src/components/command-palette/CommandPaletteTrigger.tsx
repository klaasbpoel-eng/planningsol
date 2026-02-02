import { Button } from "@/components/ui/button";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommandPaletteTriggerProps {
  className?: string;
  onClick?: () => void;
}

export function CommandPaletteTrigger({ className, onClick }: CommandPaletteTriggerProps) {
  return (
    <Button
      variant="outline"
      className={cn(
        "relative h-9 w-9 p-0 xl:h-9 xl:w-60 xl:justify-start xl:px-3 xl:py-2",
        "text-muted-foreground hover:text-foreground",
        className
      )}
      onClick={onClick}
    >
      <Search className="h-4 w-4 xl:mr-2" />
      <span className="hidden xl:inline-flex">Zoeken...</span>
      <kbd className="pointer-events-none absolute right-1.5 top-1.5 hidden h-6 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 xl:flex">
        <span className="text-xs">⌘</span>K
      </kbd>
    </Button>
  );
}
