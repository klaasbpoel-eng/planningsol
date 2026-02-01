import { Button } from "@/components/ui/button";
import { Calendar, LogOut, User, Shield, ArrowLeftRight, CalendarDays, Factory } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Link, useLocation } from "react-router-dom";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import siteLogo from "@/assets/site_logo.png";
import type { AppRole } from "@/hooks/useUserPermissions";

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
  const handleLogout = async () => {
    const {
      error
    } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Uitgelogd");
    }
  };
  return <header className="sticky top-0 z-50 w-full bg-primary-foreground shadow-md border-b border-border/50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-3">
            <img src={siteLogo} alt="SOL Group Logo" className="h-10 w-auto" />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold text-primary tracking-tight">
                  Planner
                </h1>
                <Badge variant="outline" className={`text-xs ${ROLE_COLORS[role] || ROLE_COLORS.user}`}>
                  {ROLE_LABELS[role] || "Gebruiker"}
                </Badge>
              </div>
              
            </div>
          </Link>
        </div>
        
        <div className="flex items-center gap-2">
          <ThemeToggle variant="header" />
          <NotificationBell />
          <Link to="/kalender">
            <Button variant="ghost" size="sm" className={`text-primary hover:bg-primary/10 hover:text-primary ${location.pathname === "/kalender" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold" : ""}`}>
              <CalendarDays className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Kalender</span>
            </Button>
          </Link>
          <Link to="/productie">
            <Button variant="ghost" size="sm" className={`text-primary hover:bg-primary/10 hover:text-primary ${location.pathname === "/productie" ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground font-semibold" : ""}`}>
              <Factory className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Productie</span>
            </Button>
          </Link>
          {isAdmin && onSwitchView && <Button variant="ghost" size="sm" onClick={onSwitchView} className="text-primary hover:bg-primary/10 hover:text-primary">
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Medewerkersweergave</span>
            </Button>}
          {userEmail && <div className="hidden md:flex items-center gap-2 text-primary/80 text-sm">
              <User className="h-4 w-4" />
              <span className="max-w-[150px] truncate">{userEmail}</span>
            </div>}
          <Button variant="ghost" size="sm" onClick={handleLogout} className="text-primary hover:bg-primary/10 hover:text-primary">
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Uitloggen</span>
          </Button>
        </div>
      </div>
    </header>;
}