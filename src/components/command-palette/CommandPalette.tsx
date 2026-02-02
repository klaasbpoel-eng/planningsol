import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  CalendarDays,
  Factory,
  Home,
  LogOut,
  Moon,
  Sun,
  Settings,
  Search,
  Users,
  ClipboardList,
  BarChart3,
  Snowflake,
  Cylinder,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "next-themes";

interface CommandPaletteProps {
  isAdmin?: boolean;
}

export function CommandPalette({ isAdmin }: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = useCallback((command: () => void) => {
    setOpen(false);
    command();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Uitgelogd");
    }
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Zoek naar pagina's, acties..." />
      <CommandList>
        <CommandEmpty>Geen resultaten gevonden.</CommandEmpty>
        
        <CommandGroup heading="Navigatie">
          <CommandItem
            onSelect={() => runCommand(() => navigate("/"))}
            className="gap-2"
          >
            <Home className="h-4 w-4" />
            <span>Dashboard</span>
            <span className="ml-auto text-xs text-muted-foreground">Home</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/kalender"))}
            className="gap-2"
          >
            <CalendarDays className="h-4 w-4" />
            <span>Kalender</span>
            <span className="ml-auto text-xs text-muted-foreground">Planning overzicht</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => navigate("/productie"))}
            className="gap-2"
          >
            <Factory className="h-4 w-4" />
            <span>Productieplanning</span>
            <span className="ml-auto text-xs text-muted-foreground">Orders & planning</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Productie">
          <CommandItem
            onSelect={() => runCommand(() => {
              navigate("/productie");
              // Will navigate to productie and user can select dry ice tab
            })}
            className="gap-2"
          >
            <Snowflake className="h-4 w-4 text-cyan-500" />
            <span>Droogijs Planning</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => {
              navigate("/productie");
              // Will navigate to productie and user can select gas cylinder tab
            })}
            className="gap-2"
          >
            <Cylinder className="h-4 w-4 text-blue-500" />
            <span>Gascilinder Planning</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => {
              navigate("/productie");
              // Will navigate to productie reports
            })}
            className="gap-2"
          >
            <BarChart3 className="h-4 w-4 text-primary" />
            <span>Rapportages</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Thema">
          <CommandItem
            onSelect={() => runCommand(() => setTheme("light"))}
            className="gap-2"
          >
            <Sun className="h-4 w-4" />
            <span>Licht thema</span>
            {theme === "light" && (
              <span className="ml-auto text-xs text-primary">✓ Actief</span>
            )}
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setTheme("dark"))}
            className="gap-2"
          >
            <Moon className="h-4 w-4" />
            <span>Donker thema</span>
            {theme === "dark" && (
              <span className="ml-auto text-xs text-primary">✓ Actief</span>
            )}
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => setTheme("system"))}
            className="gap-2"
          >
            <Settings className="h-4 w-4" />
            <span>Systeem thema</span>
            {theme === "system" && (
              <span className="ml-auto text-xs text-primary">✓ Actief</span>
            )}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem
            onSelect={() => runCommand(handleLogout)}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Uitloggen</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
      
      {/* Keyboard shortcut hint */}
      <div className="border-t border-border p-2 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-1">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            ↑↓
          </kbd>
          <span>navigeren</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            ↵
          </kbd>
          <span>selecteren</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            esc
          </kbd>
          <span>sluiten</span>
        </div>
      </div>
    </CommandDialog>
  );
}
