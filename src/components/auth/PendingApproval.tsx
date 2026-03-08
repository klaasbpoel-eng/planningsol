import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import siteLogo from "@/assets/site_logo.png";

export function PendingApproval() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Uitgelogd");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-mesh-animate p-4 relative overflow-hidden">
      {/* Decorative blurred elements */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />

      <Card className="w-full max-w-md glass-card-premium border-0 relative z-10">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="flex items-center justify-center mb-4">
            <div className="p-4 bg-background/80 rounded-2xl shadow-sm border border-border/30">
              <img src={siteLogo} alt="SOL Group" className="h-10 w-auto" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="p-2.5 bg-amber-500/10 rounded-xl">
              <Clock className="h-6 w-6 text-amber-500" />
            </div>
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">
            Wachten op goedkeuring
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            Uw account wacht op goedkeuring door een beheerder
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="bg-muted/50 rounded-lg p-4 text-center border border-border/30">
            <p className="text-sm text-muted-foreground">
              U ontvangt bericht zodra uw account is goedgekeurd. 
              Neem contact op met uw beheerder als dit te lang duurt.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4">
          <Button
            variant="outline"
            className="w-full h-11"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Uitloggen
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
