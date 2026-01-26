import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Snowflake, Package, Box } from "lucide-react";
import { DryIceProductTypeManager } from "@/components/production/DryIceProductTypeManager";
import { DryIcePackagingManager } from "@/components/production/DryIcePackagingManager";

export function DryIceSettings() {
  const [productTypeManagerOpen, setProductTypeManagerOpen] = useState(false);
  const [packagingManagerOpen, setPackagingManagerOpen] = useState(false);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-cyan-500" />
            <div>
              <CardTitle className="text-lg">Droogijs Instellingen</CardTitle>
              <CardDescription>Beheer producttypen en verpakkingen</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
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
