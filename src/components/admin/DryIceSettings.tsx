import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Snowflake, Package, Box, Gauge, Loader2, Check } from "lucide-react";
import { DryIceProductTypeManager } from "@/components/production/DryIceProductTypeManager";
import { DryIcePackagingManager } from "@/components/production/DryIcePackagingManager";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DRY_ICE_CAPACITY_KEY = "dry_ice_daily_capacity_kg";
const DEFAULT_CAPACITY = 500;

export function DryIceSettings() {
  const [productTypeManagerOpen, setProductTypeManagerOpen] = useState(false);
  const [packagingManagerOpen, setPackagingManagerOpen] = useState(false);
  const [dailyCapacity, setDailyCapacity] = useState<number>(DEFAULT_CAPACITY);
  const [loadingCapacity, setLoadingCapacity] = useState(true);
  const [savingCapacity, setSavingCapacity] = useState(false);

  useEffect(() => {
    fetchDailyCapacity();
  }, []);

  const fetchDailyCapacity = async () => {
    setLoadingCapacity(true);
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", DRY_ICE_CAPACITY_KEY)
      .maybeSingle();

    if (!error && data?.value) {
      setDailyCapacity(Number(data.value));
    } else {
      setDailyCapacity(DEFAULT_CAPACITY);
    }
    setLoadingCapacity(false);
  };

  const saveDailyCapacity = async () => {
    setSavingCapacity(true);
    
    // Upsert the setting
    const { error } = await supabase
      .from("app_settings")
      .upsert(
        {
          key: DRY_ICE_CAPACITY_KEY,
          value: dailyCapacity.toString(),
          description: "Dagelijkse productiecapaciteit voor droogijs in kg"
        },
        { onConflict: "key" }
      );

    if (error) {
      console.error("Error saving capacity:", error);
      toast.error("Fout bij opslaan dagcapaciteit");
    } else {
      toast.success("Dagcapaciteit opgeslagen");
    }
    setSavingCapacity(false);
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
