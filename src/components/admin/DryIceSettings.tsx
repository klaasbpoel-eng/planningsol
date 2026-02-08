import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Snowflake, Package, Box, Gauge, Loader2, Check, Trash2 } from "lucide-react";
import { DryIceProductTypeManager } from "@/components/production/DryIceProductTypeManager";
import { DryIcePackagingManager } from "@/components/production/DryIcePackagingManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const DRY_ICE_CAPACITY_KEY = "dry_ice_daily_capacity_kg";
const DRY_ICE_DEFAULT_PRODUCT_TYPE_KEY = "dry_ice_default_product_type_id";
const DEFAULT_CAPACITY = 500;

export function DryIceSettings() {
  const [productTypeManagerOpen, setProductTypeManagerOpen] = useState(false);
  const [packagingManagerOpen, setPackagingManagerOpen] = useState(false);
  const [dailyCapacity, setDailyCapacity] = useState<number>(DEFAULT_CAPACITY);
  const [loadingCapacity, setLoadingCapacity] = useState(true);
  const [savingCapacity, setSavingCapacity] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Default product type setting
  const [productTypes, setProductTypes] = useState<{ id: string; name: string }[]>([]);
  const [defaultProductTypeId, setDefaultProductTypeId] = useState<string>("");
  const [loadingProductTypes, setLoadingProductTypes] = useState(true);
  const [savingDefaultType, setSavingDefaultType] = useState(false);

  useEffect(() => {
    fetchDailyCapacity();
    fetchProductTypes();
  }, []);

  const fetchProductTypes = async () => {
    setLoadingProductTypes(true);

    try {
      // Fetch product types
      const types = await api.dryIceProductTypes.getAll();
      if (types) {
        setProductTypes(types);
      }

      // Fetch current default setting
      const setting = await api.appSettings.getByKey(DRY_ICE_DEFAULT_PRODUCT_TYPE_KEY);

      if (setting?.value) {
        setDefaultProductTypeId(setting.value);
      } else if (types && types.length > 0) {
        // Default to first type if no setting exists
        const defaultType = types.find((t: any) => t.name.toLowerCase().includes("9mm"));
        setDefaultProductTypeId(defaultType?.id || types[0].id);
      }
    } catch (error) {
      console.error("Error fetching defaults:", error);
    } finally {
      setLoadingProductTypes(false);
    }
  };

  const fetchDailyCapacity = async () => {
    setLoadingCapacity(true);
    try {
      const data = await api.appSettings.getByKey(DRY_ICE_CAPACITY_KEY);
      if (data?.value) {
        setDailyCapacity(Number(data.value));
      } else {
        setDailyCapacity(DEFAULT_CAPACITY);
      }
    } catch (error) {
      console.error("Error fetching capacity:", error);
      setDailyCapacity(DEFAULT_CAPACITY);
    } finally {
      setLoadingCapacity(false);
    }
  };

  const saveDailyCapacity = async () => {
    setSavingCapacity(true);

    try {
      await api.appSettings.upsert(
        DRY_ICE_CAPACITY_KEY,
        dailyCapacity.toString(),
        "Dagelijkse productiecapaciteit voor droogijs in kg"
      );
      toast.success("Dagcapaciteit opgeslagen");
    } catch (error) {
      console.error("Error saving capacity:", error);
      toast.error("Fout bij opslaan dagcapaciteit");
    } finally {
      setSavingCapacity(false);
    }
  };

  const saveDefaultProductType = async (typeId: string) => {
    setSavingDefaultType(true);
    setDefaultProductTypeId(typeId);

    try {
      await api.appSettings.upsert(
        DRY_ICE_DEFAULT_PRODUCT_TYPE_KEY,
        typeId,
        "Standaard producttype voor nieuwe droogijs orders"
      );
      toast.success("Standaard producttype opgeslagen");
    } catch (error) {
      console.error("Error saving default product type:", error);
      toast.error("Fout bij opslaan standaard producttype");
    } finally {
      setSavingDefaultType(false);
    }
  };

  const handleResetTable = async () => {
    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("reset-dry-ice-orders");

      if (error) {
        throw error;
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Tabel succesvol gereset", {
        description: "De dry_ice_orders tabel is verwijderd en opnieuw aangemaakt.",
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
            <Snowflake className="h-5 w-5 text-cyan-500" />
            <div>
              <CardTitle className="text-lg">Droogijs Instellingen</CardTitle>
              <CardDescription>Beheer producttypen, verpakkingen en capaciteit</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Daily Capacity Setting */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Gauge className="h-4 w-4 text-cyan-500" />
              Dagcapaciteit (kg)
            </Label>
            <div className="flex items-center gap-3">
              {loadingCapacity ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Input
                    type="number"
                    min={0}
                    step={50}
                    value={dailyCapacity}
                    onChange={(e) => setDailyCapacity(Number(e.target.value))}
                    className="w-32"
                  />
                  <Button
                    onClick={saveDailyCapacity}
                    disabled={savingCapacity}
                    size="sm"
                  >
                    {savingCapacity ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Check className="h-4 w-4" />
                    )}
                    <span className="ml-1">Opslaan</span>
                  </Button>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              De maximale hoeveelheid droogijs die per dag geproduceerd kan worden.
            </p>
          </div>

          {/* Default Product Type Setting */}
          <div className="space-y-3">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Package className="h-4 w-4 text-cyan-500" />
              Standaard producttype
            </Label>
            <div className="flex items-center gap-3">
              {loadingProductTypes ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  <Select
                    value={defaultProductTypeId}
                    onValueChange={saveDefaultProductType}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Selecteer standaard type" />
                    </SelectTrigger>
                    <SelectContent>
                      {productTypes.map((pt) => (
                        <SelectItem key={pt.id} value={pt.id}>
                          {pt.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {savingDefaultType && <Loader2 className="h-4 w-4 animate-spin" />}
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Dit producttype wordt automatisch geselecteerd bij nieuwe orders.
            </p>
          </div>

          {/* Management buttons */}
          <div className="flex flex-wrap gap-3 pt-2 border-t">
            <Button
              variant="outline"
              onClick={() => setProductTypeManagerOpen(true)}
              className="flex items-center gap-2"
            >
              <Package className="h-4 w-4 text-cyan-500" />
              Producttypen beheren
            </Button>
            <Button
              variant="outline"
              onClick={() => setPackagingManagerOpen(true)}
              className="flex items-center gap-2"
            >
              <Box className="h-4 w-4 text-cyan-500" />
              Verpakkingen beheren
            </Button>
          </div>

          {/* Dangerous actions */}
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
                  Droogijs orders tabel resetten
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Weet je het zeker?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deze actie verwijdert <strong>alle droogijs orders</strong> permanent en
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

      <DryIceProductTypeManager
        open={productTypeManagerOpen}
        onOpenChange={setProductTypeManagerOpen}
      />
      <DryIcePackagingManager
        open={packagingManagerOpen}
        onOpenChange={setPackagingManagerOpen}
      />
    </>
  );
}
