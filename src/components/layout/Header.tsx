import { Button } from "@/components/ui/button";
import { LogOut, User, ArrowLeftRight, CalendarDays, Factory, Menu, X, Truck, BookOpen, Clock, Search, ScanBarcode, FileUp } from "lucide-react";
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

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  operator: "Operator",
  user: "Gebruiker",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-red-500/10 text-red-600 border-red-200",
  supervisor: "bg-purple-500/10 text-purple-600 border-purple-200",
  operator: "bg-blue-500/10 text-blue-600 border-blue-200",
  user: "bg-gray-500/10 text-gray-600 border-gray-200",
};

interface NavItem {
  path: string;
  label: string;
  shortLabel?: string;
  icon: React.ReactNode;
}

const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Planning",
    items: [
      { path: "/kalender", label: "Kalender", icon: <CalendarDays className="h-4 w-4" /> },
      { path: "/productie", label: "Productie", icon: <Factory className="h-4 w-4" /> },
      { path: "/dagoverzicht", label: "Dagoverzicht", shortLabel: "Dag", icon: <CalendarDays className="h-4 w-4" /> },
    ],
  },
  {
    label: "Beheer",
    items: [
      { path: "/interne-bestellingen", label: "Bestellingen", shortLabel: "Best.", icon: <Truck className="h-4 w-4" /> },
      { path: "/verlof", label: "Verlof", icon: <Clock className="h-4 w-4" /> },
      { path: "/vrijgaves", label: "Vrijgaves", icon: <FileUp className="h-4 w-4" /> },
    ],
  },
  {
    label: "Tools",
    items: [
      { path: "/toolbox", label: "Toolbox", icon: <BookOpen className="h-4 w-4" /> },
      { path: "/barcode", label: "Barcode", icon: <ScanBarcode className="h-4 w-4" /> },
    ],
  },
];

interface HeaderProps {
  userEmail?: string;
  isAdmin?: boolean;
  onSwitchView?: () => void;
  role?: AppRole;
}

export function Header({
  userEmail,
  isAdmin,
  onSwitchView,
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

  const isActive = (path: string) => location.pathname === path;


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
              {ROLE_LABELS[role] || "Gebruiker"}
            </p>
          </div>
        </div>
      )}

      <nav className="flex flex-col gap-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider">{group.label}</p>
            {group.items.map((item) => (
              <Link key={item.path} to={item.path} onClick={closeMobileMenu}>
                <Button
                  variant="ghost"
                  size="lg"
                  className={cn(
                    "w-full justify-start text-base h-12 gap-3",
                    isActive(item.path)
                      ? "bg-primary/10 text-primary font-semibold"
                      : "text-foreground"
                  )}
                >
                  {item.icon}
                  {item.label}
                </Button>
              </Link>
            ))}
          </div>
        ))}

        {isAdmin && onSwitchView && (
          <div>
            <p className="text-xs font-medium text-muted-foreground px-3 py-2 uppercase tracking-wider">Admin</p>
            <Button
              variant="ghost"
              size="lg"
              onClick={() => { onSwitchView(); closeMobileMenu(); }}
              className="w-full justify-start text-base h-12 gap-3 text-foreground"
            >
              <ArrowLeftRight className="h-4 w-4" />
              Medewerkersweergave
            </Button>
          </div>
        )}
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
    </div>
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-primary-foreground shadow-md border-b border-border/50">
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
                  className={`text-xs ${ROLE_COLORS[role] || ROLE_COLORS.user}`}
                >
                  {ROLE_LABELS[role] || "Gebruiker"}
                </Badge>
              </div>
            </div>
          </Link>
        </div>


        {/* Right side - Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!isMobile && (
            <Button
              variant="outline"
              size="sm"
              className="hidden md:flex items-center gap-2 text-muted-foreground hover:text-foreground h-8 px-3 border-border/50"
              onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true }))}
            >
              <Search className="h-3.5 w-3.5" />
              <span className="text-xs">Zoeken</span>
              <kbd className="pointer-events-none ml-1 inline-flex h-5 select-none items-center gap-0.5 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
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
                <div className="hidden lg:flex items-center gap-2 text-primary/80 text-sm ml-1">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="max-w-[120px] truncate">{userEmail}</span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-primary hover:bg-primary/10 hover:text-primary shrink-0"
              >
                <LogOut className="h-4 w-4 mr-2" />
                <span className="hidden lg:inline">Uitloggen</span>
              </Button>
            </>
          )}

          {/* Mobile menu */}
          {isMobile && (
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="sm" className="text-primary hover:bg-primary/10 p-2">
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
