import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Flame, Cylinder, Settings } from "lucide-react";
import { GasTypeManager } from "@/components/production/GasTypeManager";
import { CylinderSizeManager } from "@/components/production/CylinderSizeManager";

export function GasCylinderSettings() {
  const [gasTypeManagerOpen, setGasTypeManagerOpen] = useState(false);
  const [cylinderSizeManagerOpen, setCylinderSizeManagerOpen] = useState(false);

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
        <CardContent>
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
              onClick={() => setCylinderSizeManagerOpen(true)}
              className="flex items-center gap-2"
            >
              <Cylinder className="h-4 w-4 text-blue-500" />
              Cilinderinhouden beheren
            </Button>
          </div>
        </CardContent>
      </Card>

      <GasTypeManager
        open={gasTypeManagerOpen}
        onOpenChange={setGasTypeManagerOpen}
      />
      <CylinderSizeManager
        open={cylinderSizeManagerOpen}
        onOpenChange={setCylinderSizeManagerOpen}
      />
    </>
  );
}
