import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function PendingApproval() {
  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Uitgelogd");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-xl border-0 bg-card">
        <CardHeader className="space-y-1 text-center pb-2">
          <div className="flex items-center justify-center gap-2 mb-4">
            <div className="p-3 bg-amber-500 rounded-xl">
              <Clock className="h-8 w-8 text-white" />
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
          <div className="bg-muted/50 rounded-lg p-4 text-center">
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
