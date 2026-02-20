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

  const NavLinks = ({ mobile = false }: { mobile?: boolean }) => (
    <>
      <Link to="/kalender" onClick={mobile ? closeMobileMenu : undefined}>
        <Button
          variant={mobile ? "ghost" : "ghost"}
          size={mobile ? "lg" : "sm"}
          className={`${mobile ? "w-full justify-start text-base h-12" : ""
            } text-primary hover:bg-primary/10 hover:text-primary ${location.pathname === "/kalender"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold"
              : ""
            }`}
        >
          <CalendarDays className="h-4 w-4 mr-2" />
          Kalender
        </Button>
      </Link>
      <Link to="/productie" onClick={mobile ? closeMobileMenu : undefined}>
        <Button
          variant={mobile ? "ghost" : "ghost"}
          size={mobile ? "lg" : "sm"}
          className={`${mobile ? "w-full justify-start text-base h-12" : ""
            } text-primary hover:bg-primary/10 hover:text-primary ${location.pathname === "/productie"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold"
              : ""
            }`}
        >
          <Factory className="h-4 w-4 mr-2" />
          Productie
        </Button>
      </Link>
      <Link to="/interne-bestellingen" onClick={mobile ? closeMobileMenu : undefined}>
        <Button
          variant={mobile ? "ghost" : "ghost"}
          size={mobile ? "lg" : "sm"}
          className={`${mobile ? "w-full justify-start text-base h-12" : ""
            } text-primary hover:bg-primary/10 hover:text-primary ${location.pathname === "/interne-bestellingen"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold"
              : ""
            }`}
        >
          <Truck className="h-4 w-4 mr-2" />
          Interne Bestellingen
        </Button>
      </Link>
      <Link to="/verlof" onClick={mobile ? closeMobileMenu : undefined}>
        <Button
          variant={mobile ? "ghost" : "ghost"}
          size={mobile ? "lg" : "sm"}
          className={`${mobile ? "w-full justify-start text-base h-12" : ""
            } text-primary hover:bg-primary/10 hover:text-primary ${location.pathname === "/verlof"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold"
              : ""
            }`}
        >
          <Clock className="h-4 w-4 mr-2" />
          Verlof
        </Button>
      </Link>
      <Link to="/toolbox" onClick={mobile ? closeMobileMenu : undefined}>
        <Button
          variant={mobile ? "ghost" : "ghost"}
          size={mobile ? "lg" : "sm"}
          className={`${mobile ? "w-full justify-start text-base h-12" : ""
            } text-primary hover:bg-primary/10 hover:text-primary ${location.pathname === "/toolbox"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold"
              : ""
            }`}
        >
          <BookOpen className="h-4 w-4 mr-2" />
          Toolbox
        </Button>
      </Link>
      <Link to="/barcode" onClick={mobile ? closeMobileMenu : undefined}>
        <Button
          variant={mobile ? "ghost" : "ghost"}
          size={mobile ? "lg" : "sm"}
          className={`${mobile ? "w-full justify-start text-base h-12" : ""
            } text-primary hover:bg-primary/10 hover:text-primary ${location.pathname === "/barcode"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold"
              : ""
            }`}
        >
          <ScanBarcode className="h-4 w-4 mr-2" />
          Barcode
        </Button>
      </Link>
      <Link to="/vrijgaves" onClick={mobile ? closeMobileMenu : undefined}>
        <Button
          variant={mobile ? "ghost" : "ghost"}
          size={mobile ? "lg" : "sm"}
          className={`${mobile ? "w-full justify-start text-base h-12" : ""
            } text-primary hover:bg-primary/10 hover:text-primary ${location.pathname === "/vrijgaves"
              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold"
              : ""
            }`}
        >
          <FileUp className="h-4 w-4 mr-2" />
          Vrijgaves
        </Button>
      </Link>
      {isAdmin && onSwitchView && (
        <Button
          variant="ghost"
          size={mobile ? "lg" : "sm"}
          onClick={() => {
            onSwitchView();
            if (mobile) closeMobileMenu();
          }}
          className={`${mobile ? "w-full justify-start text-base h-12" : ""
            } text-primary hover:bg-primary/10 hover:text-primary`}
        >
          <ArrowLeftRight className="h-4 w-4 mr-2" />
          Medewerkersweergave
        </Button>
      )}
    </>
  );

  return (
    <header className="sticky top-0 z-50 w-full bg-primary-foreground shadow-md border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between overflow-x-hidden">
        {/* Left side - Logo and branding */}
        <div className="flex items-center gap-3">
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
        <div className="flex items-center gap-1">
          {/* Keyboard shortcut hint */}
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

          {/* Theme toggle - always visible */}
          <ThemeToggle variant="header" />

          {/* Notifications - always visible */}
          <NotificationBell />

          {/* Desktop navigation */}
          {!isMobile && (
            <>
              <NavLinks />
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
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-primary hover:bg-primary/10 p-2"
                >
                  <Menu className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[280px] p-0">
                <SheetHeader className="p-4 border-b">
                  <SheetTitle className="text-left">Menu</SheetTitle>
                </SheetHeader>
                <div className="flex flex-col p-2">
                  {/* User info */}
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

                  {/* Navigation links */}
                  <nav className="flex flex-col gap-1">
                    <NavLinks mobile />
                  </nav>

                  {/* Logout button at bottom */}
                  <div className="mt-auto pt-4 border-t mt-4">
                    <Button
                      variant="ghost"
                      size="lg"
                      onClick={() => {
                        handleLogout();
                        closeMobileMenu();
                      }}
                      className="w-full justify-start text-base h-12 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <LogOut className="h-4 w-4 mr-2" />
                      Uitloggen
                    </Button>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          )}
        </div>
      </div>
    </header>
  );
}