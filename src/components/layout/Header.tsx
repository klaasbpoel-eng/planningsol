import { Button } from "@/components/ui/button";
import { Calendar, LogOut, User, Shield, ArrowLeftRight, CalendarDays, Factory, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "react-router-dom";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import siteLogo from "@/assets/site_logo.png";

interface HeaderProps {
  userEmail?: string;
  isAdmin?: boolean;
  onSwitchView?: () => void;
}

export function Header({ userEmail, isAdmin, onSwitchView }: HeaderProps) {
  const location = useLocation();
  
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Uitgelogd");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-primary-foreground shadow-md border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={siteLogo} alt="SOL Group Logo" className="h-10 w-auto" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-primary tracking-tight">
                  Verlofbeheer
                </h1>
                {isAdmin && (
                  <Badge className="bg-accent text-accent-foreground text-xs">
                    Beheerder
                  </Badge>
                )}
              </div>
              <p className="text-xs text-primary/70 hidden sm:block">
                {isAdmin ? "Beheer medewerkeraanvragen" : "Plan uw vrije tijd"}
              </p>
            </div>
          </Link>
        </div>
        
        <div className="flex items-center gap-2">
          <ThemeToggle variant="header" />
          <NotificationBell />
          <Link to="/kalender">
            <Button
              variant="ghost"
              size="sm"
              className={`text-primary hover:bg-primary/10 hover:text-primary ${
                location.pathname === "/kalender" 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold" 
                  : ""
              }`}
            >
              <CalendarDays className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Kalender</span>
            </Button>
          </Link>
          <Link to="/productie">
            <Button
              variant="ghost"
              size="sm"
              className={`text-primary hover:bg-primary/10 hover:text-primary ${
                location.pathname === "/productie" 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold" 
                  : ""
              }`}
            >
              <Factory className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Productie</span>
            </Button>
          </Link>
          <Link to="/klanten">
            <Button
              variant="ghost"
              size="sm"
              className={`text-primary hover:bg-primary/10 hover:text-primary ${
                location.pathname === "/klanten" 
                  ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold" 
                  : ""
              }`}
            >
              <Building2 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Klanten</span>
            </Button>
          </Link>
          {isAdmin && onSwitchView && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSwitchView}
              className="text-primary hover:bg-primary/10 hover:text-primary"
            >
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Medewerkersweergave</span>
            </Button>
          )}
          {userEmail && (
            <div className="hidden md:flex items-center gap-2 text-primary/80 text-sm">
              <User className="h-4 w-4" />
              <span className="max-w-[150px] truncate">{userEmail}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-primary hover:bg-primary/10 hover:text-primary"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Uitloggen</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
