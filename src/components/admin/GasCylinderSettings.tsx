import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Cylinder, Settings, Trash2, Loader2, FolderOpen } from "lucide-react";
import { GasTypeManager } from "@/components/production/GasTypeManager";
import { GasTypeCategoryManager } from "@/components/production/GasTypeCategoryManager";
import { CylinderSizeManager } from "@/components/production/CylinderSizeManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export function GasCylinderSettings() {
  const [gasTypeManagerOpen, setGasTypeManagerOpen] = useState(false);
  const [gasCategoryManagerOpen, setGasCategoryManagerOpen] = useState(false);
  const [cylinderSizeManagerOpen, setCylinderSizeManagerOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const handleResetTable = async () => {
    setIsResetting(true);
    try {
      // For reset, we might need a specific API method if it's custom logic
      // The current implementation calls an edge function 'reset-gas-cylinder-orders'
      // This is specific to Supabase. 
      // If we are in MySQL mode, we should truncate the table in MySQL.
      // But `api.ts` doesn't have a reset method yet. 
      // For now, let's keep the Edge Function call IF it's Supabase, 
      // but for MySQL we need a way to send a raw query or a specific reset command.
      // Let's add a generic `execute` to api for admin tasks or just specific reset methods later.
      // For this phase, I'll assume we only support Reset on Supabase until I add it to API.
      // OR, I can add `api.orders.reset()`

      const { data, error } = await supabase.functions.invoke("reset-gas-cylinder-orders");

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Tabel succesvol gereset", {
        description: "De gas_cylinder_orders tabel is verwijderd en opnieuw aangemaakt.",
      });
    } catch (error: any) {
      console.error("Error resetting table:", error);
      toast.error("Fout bij resetten van tabel", {
        description: error.message || "Er is een onbekende fout opgetreden.",
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle className="text-lg">Gascilinder Instellingen</CardTitle>
              <CardDescription>Beheer gastypes en cilinderinhouden</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => setGasTypeManagerOpen(true)}
              className="flex items-center gap-2"
            >
              <Flame className="h-4 w-4 text-orange-500" />
              Gastypes beheren
            </Button>
            <Button
              variant="outline"
              onClick={() => setGasCategoryManagerOpen(true)}
              className="flex items-center gap-2"
            >
              <FolderOpen className="h-4 w-4 text-primary" />
              Gastype categorieën
            </Button>
            <Button
              variant="outline"
              onClick={() => setCylinderSizeManagerOpen(true)}
              className="flex items-center gap-2"
            >
              <Cylinder className="h-4 w-4 text-blue-500" />
              Cilinderinhouden beheren
            </Button>
          </div>

          <div className="border-t pt-4">
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Gevaarlijke acties</h4>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  className="flex items-center gap-2"
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Gascilinder orders tabel resetten
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deze actie verwijdert <strong>alle gascilinder orders</strong> permanent en
                    maakt de tabel opnieuw aan. Dit kan niet ongedaan worden gemaakt.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleResetTable}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Ja, reset de tabel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      <GasTypeManager
        open={gasTypeManagerOpen}
        onOpenChange={setGasTypeManagerOpen}
      />
      <GasTypeCategoryManager
        open={gasCategoryManagerOpen}
        onOpenChange={setGasCategoryManagerOpen}
      />
      <CylinderSizeManager
        open={cylinderSizeManagerOpen}
        onOpenChange={setCylinderSizeManagerOpen}
      />
    </>
  );
}
