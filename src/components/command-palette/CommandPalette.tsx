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
  Home,
  LogOut,
  Moon,
  Sun,
  Settings,
  Snowflake,
  Cylinder,
  BarChart3,
  Plus,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import { useUserRole } from "@/hooks/useUserRole";
import { NAVIGATION_ITEMS } from "@/config/navigation";
import { OPEN_COMMAND_PALETTE_EVENT } from "@/lib/command-palette";

const RECENT_KEY = "command-palette-recent";
const MAX_RECENT = 5;

interface RecentAction {
  id: string;
  label: string;
}

function getRecentActions(): RecentAction[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
  } catch {
    return [];
  }
}

function addRecentAction(action: RecentAction) {
  const recent = getRecentActions().filter((a) => a.id !== action.id);
  recent.unshift(action);
  localStorage.setItem(RECENT_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

// All navigable items with keywords for fuzzy search
const NAV_ITEMS = [
  { id: "dashboard", label: "Start", path: "/", icon: Home, keywords: ["home", "start", "overzicht"] },
  ...NAVIGATION_ITEMS,
];

const QUICK_ACTIONS = [
  { id: "qa-verlof", label: "Verlof aanvragen", path: "/verlof", icon: Plus, iconClass: "text-warning", keywords: ["vrij", "vakantie", "aanvragen"] },
  { id: "qa-bestelling", label: "Nieuwe interne bestelling", path: "/interne-bestellingen", icon: Plus, iconClass: "text-success", keywords: ["order", "nieuw", "bestelling"] },
  { id: "qa-productie", label: "Nieuwe productieorder", path: "/productie", icon: Plus, iconClass: "text-primary", keywords: ["prod", "nieuw", "order"] },
];

const PRODUCTION_ITEMS = [
  { id: "droogijs", label: "Droogijs Planning", path: "/productie", icon: Snowflake, iconClass: "text-cyan-500", keywords: ["dry ice", "ijs", "co2", "koud"] },
  { id: "gascilinder", label: "Gascilinder Planning", path: "/productie", icon: Cylinder, iconClass: "text-blue-500", keywords: ["gas", "fles", "cilinder", "vullen"] },
  { id: "rapportages", label: "Rapportages", path: "/productie", icon: BarChart3, iconClass: "text-primary", keywords: ["rapport", "report", "grafiek", "chart", "statistiek"] },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [recentActions, setRecentActions] = useState<RecentAction[]>([]);
  const [userId, setUserId] = useState<string | undefined>();
  const { isAdmin } = useUserRole(userId);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    const openFromButton = () => setOpen(true);
    document.addEventListener(OPEN_COMMAND_PALETTE_EVENT, openFromButton);
    return () => {
      document.removeEventListener("keydown", down);
      document.removeEventListener(OPEN_COMMAND_PALETTE_EVENT, openFromButton);
    };
  }, []);

  useEffect(() => {
    if (open) setRecentActions(getRecentActions());
  }, [open]);

  const runCommand = useCallback((command: () => void, action?: RecentAction) => {
    setOpen(false);
    if (action) addRecentAction(action);
    command();
  }, []);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast.error(error.message);
    else toast.success("Uitgelogd");
  };

  // Build a lookup for rendering recent items
  const allItems = [...QUICK_ACTIONS, ...NAV_ITEMS, ...PRODUCTION_ITEMS];

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Zoek naar pagina's, acties..." />
      <CommandList className="max-h-[450px] max-sm:max-h-[calc(100dvh-120px)]">
        <CommandEmpty>Geen resultaten gevonden.</CommandEmpty>

        {/* Recent Actions */}
        {recentActions.length > 0 && (
          <>
            <CommandGroup heading="Recent">
              {recentActions.map((recent) => {
                const item = allItems.find((i) => i.id === recent.id);
                const Icon = item?.icon || History;
                return (
                  <CommandItem
                    key={`recent-${recent.id}`}
                    onSelect={() => runCommand(() => navigate(item?.path || "/"), recent)}
                    className="gap-2"
                  >
                    <Icon className={`h-4 w-4 ${"iconClass" in (item || {}) ? (item as any).iconClass : ""}`} />
                    <span>{recent.label}</span>
                    <span className="ml-auto text-xs text-muted-foreground">recent</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}

        {/* Quick Actions */}
        <CommandGroup heading="Snelle acties">
          {QUICK_ACTIONS.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => runCommand(() => navigate(item.path), { id: item.id, label: item.label })}
              className="gap-2"
              keywords={item.keywords}
            >
              <item.icon className={`h-4 w-4 ${item.iconClass}`} />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Navigatie">
          {NAV_ITEMS.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => runCommand(() => navigate(item.path), { id: item.id, label: item.label })}
              className="gap-2"
              keywords={item.keywords}
            >
              <item.icon className="h-4 w-4" />
              <span>{item.label}</span>
            </CommandItem>
          ))}
          {isAdmin && (
            <CommandItem
              key="admin-settings"
              onSelect={() => runCommand(() => navigate("/admin?tab=settings"), { id: "admin-settings", label: "Instellingen" })}
              className="gap-2"
              keywords={["settings", "instellingen", "beheer", "admin", "configuratie"]}
            >
              <Settings className="h-4 w-4" />
              <span>Instellingen</span>
            </CommandItem>
          )}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Productie">
          {PRODUCTION_ITEMS.map((item) => (
            <CommandItem
              key={item.id}
              onSelect={() => runCommand(() => navigate(item.path), { id: item.id, label: item.label })}
              className="gap-2"
              keywords={item.keywords}
            >
              <item.icon className={`h-4 w-4 ${item.iconClass}`} />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Thema">
          <CommandItem onSelect={() => runCommand(() => setTheme("light"))} className="gap-2" keywords={["light", "licht", "wit"]}>
            <Sun className="h-4 w-4" />
            <span>Licht thema</span>
            {theme === "light" && <span className="ml-auto text-xs text-primary">✓</span>}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("dark"))} className="gap-2" keywords={["dark", "donker", "zwart", "nacht"]}>
            <Moon className="h-4 w-4" />
            <span>Donker thema</span>
            {theme === "dark" && <span className="ml-auto text-xs text-primary">✓</span>}
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setTheme("system"))} className="gap-2" keywords={["systeem", "auto", "automatisch"]}>
            <Settings className="h-4 w-4" />
            <span>Systeem thema</span>
            {theme === "system" && <span className="ml-auto text-xs text-primary">✓</span>}
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        <CommandGroup heading="Account">
          <CommandItem onSelect={() => runCommand(handleLogout)} className="gap-2" keywords={["logout", "afmelden", "uit"]}>
            <LogOut className="h-4 w-4" />
            <span>Uitloggen</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>

      <div className="border-t border-border p-2 text-xs text-muted-foreground flex items-center justify-between">
        <div className="flex items-center gap-1">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">↑↓</kbd>
          <span>navigeren</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">↵</kbd>
          <span>selecteren</span>
        </div>
        <div className="flex items-center gap-1">
          <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">esc</kbd>
          <span>sluiten</span>
        </div>
      </div>
    </CommandDialog>
  );
}
