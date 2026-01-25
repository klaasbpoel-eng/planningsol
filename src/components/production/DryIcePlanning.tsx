import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Snowflake, Calendar, Package } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export function DryIcePlanning() {
  // Placeholder data - will be replaced with real data later
  const productionOrders: any[] = [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Snowflake className="h-5 w-5 text-cyan-500" />
            Droogijs Productie
          </h2>
          <p className="text-sm text-muted-foreground">
            Beheer productieorders voor droogijs
          </p>
        </div>
        <Button className="bg-cyan-500 hover:bg-cyan-600">
          <Plus className="h-4 w-4 mr-2" />
          Nieuwe productieorder
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production queue */}
        <div className="lg:col-span-2">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Productiewachtrij
              </CardTitle>
              <CardDescription>
                Geplande productieorders voor droogijs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {productionOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Snowflake className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Geen productieorders gepland</p>
                  <p className="text-sm">Voeg een nieuwe productieorder toe om te beginnen</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead>Hoeveelheid</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {productionOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>{order.orderNumber}</TableCell>
                        <TableCell>{order.customer}</TableCell>
                        <TableCell>{order.quantity} kg</TableCell>
                        <TableCell>{order.date}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{order.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick info */}
        <div className="space-y-4">
          <Card className="glass-card border-cyan-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Package className="h-4 w-4 text-cyan-500" />
                Producttypen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                <span className="text-sm">Blokken (10kg)</span>
                <Badge variant="secondary">Standaard</Badge>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                <span className="text-sm">Pellets (3mm)</span>
                <Badge variant="secondary">Beschikbaar</Badge>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/50">
                <span className="text-sm">Sticks (16mm)</span>
                <Badge variant="secondary">Beschikbaar</Badge>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Productiecapaciteit</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Dagcapaciteit</span>
                  <span className="font-medium">500 kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vandaag gepland</span>
                  <span className="font-medium">0 kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Beschikbaar</span>
                  <span className="font-medium text-green-500">500 kg</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
