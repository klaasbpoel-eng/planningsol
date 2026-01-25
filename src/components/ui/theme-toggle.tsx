import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCallback } from "react";

interface ThemeToggleProps {
  className?: string;
  variant?: "default" | "header";
}

export function ThemeToggle({ className, variant = "default" }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme();

  const toggleTheme = useCallback(() => {
    // Add transitioning class for smooth animation
    document.documentElement.classList.add("transitioning");
    
    // Change theme
    setTheme(theme === "dark" ? "light" : "dark");
    
    // Remove transitioning class after animation completes
    setTimeout(() => {
      document.documentElement.classList.remove("transitioning");
    }, 400);
  }, [theme, setTheme]);

  if (variant === "header") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleTheme}
        className={cn(
          "text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground relative overflow-hidden group",
          className
        )}
      >
        <div className="relative h-4 w-4">
          <Sun className="h-4 w-4 absolute inset-0 rotate-0 scale-100 transition-all duration-500 ease-out dark:-rotate-90 dark:scale-0" />
          <Moon className="h-4 w-4 absolute inset-0 rotate-90 scale-0 transition-all duration-500 ease-out dark:rotate-0 dark:scale-100" />
        </div>
        <span className="hidden sm:inline ml-2 transition-opacity duration-300">
          {theme === "dark" ? "Licht" : "Donker"}
        </span>
        {/* Ripple effect */}
        <span className="absolute inset-0 rounded-md bg-primary-foreground/10 scale-0 group-active:scale-100 transition-transform duration-300 ease-out" />
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={cn(
        "relative h-9 w-9 rounded-lg border-border/50 bg-background/50 backdrop-blur-sm hover:bg-accent/50 transition-all duration-300 group overflow-hidden",
        className
      )}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all duration-500 ease-out dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all duration-500 ease-out dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Thema wisselen</span>
      {/* Ripple effect */}
      <span className="absolute inset-0 rounded-lg bg-accent/20 scale-0 group-active:scale-100 transition-transform duration-300 ease-out" />
    </Button>
  );
}
