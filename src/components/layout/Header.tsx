import { Button } from "@/components/ui/button";
import { Calendar, LogOut, User, Shield, ArrowLeftRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface HeaderProps {
  userEmail?: string;
  isAdmin?: boolean;
  onSwitchView?: () => void;
}

export function Header({ userEmail, isAdmin, onSwitchView }: HeaderProps) {
  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Signed out successfully");
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-primary shadow-lg">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-foreground/10 rounded-lg">
            {isAdmin ? (
              <Shield className="h-6 w-6 text-primary-foreground" />
            ) : (
              <Calendar className="h-6 w-6 text-primary-foreground" />
            )}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-primary-foreground tracking-tight">
                Verlofbeheer
              </h1>
              {isAdmin && (
                <Badge className="bg-accent text-accent-foreground text-xs">
                  Beheerder
                </Badge>
              )}
            </div>
            <p className="text-xs text-primary-foreground/70 hidden sm:block">
              {isAdmin ? "Beheer medewerkeraanvragen" : "Plan uw vrije tijd"}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {isAdmin && onSwitchView && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onSwitchView}
              className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
            >
              <ArrowLeftRight className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Medewerkersweergave</span>
            </Button>
          )}
          {userEmail && (
            <div className="hidden md:flex items-center gap-2 text-primary-foreground/80 text-sm">
              <User className="h-4 w-4" />
              <span className="max-w-[150px] truncate">{userEmail}</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
          >
            <LogOut className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Uitloggen</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
