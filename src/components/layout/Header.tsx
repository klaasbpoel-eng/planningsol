import { Button } from "@/components/ui/button";
import { LogOut, User, Menu, Search, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "react-router-dom";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import siteLogo from "@/assets/site_logo.png";
import type { AppRole } from "@/hooks/useUserPermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { HOME_ITEM, getNavigationGroups, isNavigationItemActive, type NavigationItem } from "@/config/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { openCommandPalette } from "@/lib/command-palette";
import { useCurrentCustomRole } from "@/hooks/useCustomRole";
import { filterNavigationForRole, roleDisplayName } from "@/lib/customRoles";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  operator: "Operator",
  user: "Gebruiker",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-destructive/10 text-destructive border-destructive/30",
  supervisor: "bg-accent/10 text-accent border-accent/30",
  operator: "bg-primary/10 text-primary border-primary/30",
  user: "bg-muted text-muted-foreground border-border",
};

interface HeaderProps {
  userEmail?: string;
  isAdmin?: boolean;
  onSwitchView?: () => void;
  role?: AppRole;
}

export function Header({
  userEmail,
  isAdmin,
  role = "user",
}: HeaderProps) {
  const location = useLocation();
  const isMobile = useIsMobile();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Uitgelogd");
    }
  };

  const closeMobileMenu = () => setMobileMenuOpen(false);

  const customRole = useCurrentCustomRole(role);
  const roleName = roleDisplayName(role, customRole);
  const navigationGroups = filterNavigationForRole(getNavigationGroups(Boolean(isAdmin) || role === "admin"), customRole);
  const isActive = (item: NavigationItem) => isNavigationItemActive(item, location.pathname, location.search);


  const MobileNav = () => (
    <div className="flex flex-col p-2">
      {userEmail && (
        <div className="flex items-center gap-3 p-3 mb-2 rounded-lg bg-muted/50">
          <div className="p-2 rounded-full bg-primary/10">
            <User className="h-4 w-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{userEmail}</p>
            <p className="text-xs text-muted-foreground">
              {roleName}
            </p>
          </div>
        </div>
      )}

      <nav className="flex flex-col gap-1" aria-label="Hoofdmenu">
        <div className="grid grid-cols-2 gap-2 px-2 pb-3">
          <Link to={HOME_ITEM.path} onClick={closeMobileMenu} aria-current={isActive(HOME_ITEM) ? "page" : undefined}>
            <Button variant={isActive(HOME_ITEM) ? "secondary" : "outline"} className="w-full gap-2">
              <HOME_ITEM.icon className="h-4 w-4" /> {HOME_ITEM.label}
            </Button>
          </Link>
          <Button variant="outline" className="w-full gap-2" onClick={() => { openCommandPalette(); closeMobileMenu(); }}>
            <Search className="h-4 w-4" /> Zoeken
          </Button>
        </div>
        {navigationGroups.map((group) => (
          <div key={group.id}>
            <p className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider">{group.label}</p>
            {group.items.map((item) => (
              <Link key={item.path} to={item.path} onClick={closeMobileMenu} aria-current={isActive(item) ? "page" : undefined}>
                <Button
                  variant="ghost"
                  size="lg"
                  className={cn(
                    "w-full justify-start text-base h-12 gap-3",
                    isActive(item)
                      ? "bg-primary/10 text-primary font-semibold border-l-4 border-primary"
                      : "text-foreground border-l-4 border-transparent"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        ))}
      </nav>

      <div className="mt-auto pt-4 border-t mt-4">
        <Button
          variant="ghost"
          size="lg"
          onClick={() => { handleLogout(); closeMobileMenu(); }}
          className="w-full justify-start text-base h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Uitloggen
        </Button>
      </div>
      <div className="px-3 py-3 border-t text-center">
        <span className="text-xs text-muted-foreground font-medium">SOL Planner</span>
      </div>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-background/80 backdrop-blur-xl shadow-sm border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between overflow-x-hidden">
        {/* Left side - Logo */}
        <div className="flex items-center gap-3 shrink-0">
          <Link to="/" className="flex items-center gap-3">
            <img src={siteLogo} alt="SOL Group Logo" className="h-10 w-auto" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-primary tracking-tight">
                  Planner
                </h1>
                <Badge
                  variant="outline"
                  className={`text-xs hidden md:inline-flex ${ROLE_COLORS[role] || ROLE_COLORS.user}`}
                >
                  {roleName}
                </Badge>
              </div>
            </div>
          </Link>
        </div>


        {/* Desktop navigation: Vandaag + one menu per group */}
        {!isMobile && (
          <nav className="hidden md:flex items-center gap-1" aria-label="Hoofdmenu">
            <Link to={HOME_ITEM.path} aria-current={isActive(HOME_ITEM) ? "page" : undefined}>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  "h-8 gap-1.5 px-2.5 text-sm",
                  isActive(HOME_ITEM) ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <HOME_ITEM.icon className="h-4 w-4" />
                <span>{HOME_ITEM.label}</span>
              </Button>
            </Link>
            {navigationGroups.map((group) => {
              const groupActive = group.items.some(isActive);
              return (
                <DropdownMenu key={group.id}>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "h-8 gap-1.5 px-2.5 text-sm",
                        groupActive ? "bg-primary/10 text-primary font-semibold" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      <group.icon className="h-4 w-4" />
                      <span>{group.label}</span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-70" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-60">
                    <DropdownMenuLabel className="text-xs uppercase tracking-wider text-muted-foreground">{group.label}</DropdownMenuLabel>
                    {group.items.map((item) => (
                      <DropdownMenuItem key={item.path} asChild>
                        <Link
                          to={item.path}
                          aria-current={isActive(item) ? "page" : undefined}
                          className={cn("flex items-center gap-2 cursor-pointer", isActive(item) && "text-primary font-semibold")}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })}
          </nav>
        )}

        {/* Right side - Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {!isMobile && (
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground h-8 px-3 border-border/50"
              onClick={openCommandPalette}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Zoeken</span>
              <kbd className="pointer-events-none ml-1 hidden lg:inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                <span className="text-xs">⌘</span>K
              </kbd>
            </Button>
          )}

          <ThemeToggle variant="header" />
          <NotificationBell />

          {/* Desktop user & logout */}
          {!isMobile && (
            <>
              {userEmail && (
                <div className="hidden 2xl:flex items-center gap-2 text-primary/80 text-sm ml-1">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="max-w-[120px] truncate">{userEmail}</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                aria-label="Uitloggen"
                className="text-primary hover:bg-primary/10 hover:text-primary shrink-0"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden xl:inline">Uitloggen</span>
              </Button>
            </>
          )}

          {/* Mobile menu */}
          {isMobile && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 p-2" aria-label="Open navigatiemenu">
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>
                <MobileNav />
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}
