import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ShoppingCart, Plus, Loader2, Eye, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { InternalOrderForm } from "@/components/orders/InternalOrderForm";
import { useUserRole } from "@/hooks/useUserRole";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  status: string;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  article_code: string;
  quantity: number;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { isAdmin } = useUserRole(userId);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
    });
  }, []);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setOrders(data);
    }
    setLoading(false);
  };

  const viewOrderDetails = async (order: Order) => {
    setSelectedOrder(order);
    
    const { data } = await supabase
      .from("order_items")
      .select("id, product_name, article_code, quantity")
      .eq("order_id", order.id);

    setOrderItems(data || []);
    setDetailsOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "In behandeling" },
      confirmed: { variant: "default", label: "Bevestigd" },
      shipped: { variant: "outline", label: "Verzonden" },
      delivered: { variant: "outline", label: "Geleverd" },
      cancelled: { variant: "destructive", label: "Geannuleerd" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted/30 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingCart className="h-6 w-6" />
              Bestellingen
            </h1>
            <p className="text-muted-foreground">Beheer klantbestellingen</p>
          </div>
        </div>

        <Tabs defaultValue="list" className="space-y-6">
          <TabsList>
            <TabsTrigger value="list">Bestellingen</TabsTrigger>
            {isAdmin && <TabsTrigger value="new">Nieuwe Bestelling</TabsTrigger>}
          </TabsList>

          <TabsContent value="list">
            <Card>
              <CardHeader>
                <CardTitle>Alle Bestellingen</CardTitle>
                <CardDescription>Overzicht van alle klantbestellingen</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : orders.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="font-medium">Geen bestellingen</p>
                    <p className="text-sm">Er zijn nog geen bestellingen aangemaakt</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bestelnummer</TableHead>
                        <TableHead>Klant</TableHead>
                        <TableHead>Leverdatum</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Aangemaakt</TableHead>
                        <TableHead className="w-[80px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-medium">{order.order_number}</TableCell>
                          <TableCell>{order.customer_name}</TableCell>
                          <TableCell>
                            {order.delivery_date 
                              ? format(new Date(order.delivery_date), "d MMM yyyy", { locale: nl })
                              : "-"
                            }
                          </TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(order.created_at), "d MMM yyyy", { locale: nl })}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => viewOrderDetails(order)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="new">
              <InternalOrderForm />
            </TabsContent>
          )}
        </Tabs>

        {/* Order Details Dialog */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Bestelling {selectedOrder?.order_number}</DialogTitle>
            </DialogHeader>
            {selectedOrder && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Klant:</span>
                    <p className="font-medium">{selectedOrder.customer_name}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <p>{getStatusBadge(selectedOrder.status)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Leverdatum:</span>
                    <p className="font-medium">
                      {selectedOrder.delivery_date 
                        ? format(new Date(selectedOrder.delivery_date), "d MMMM yyyy", { locale: nl })
                        : "Niet gespecificeerd"
                      }
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Aangemaakt:</span>
                    <p className="font-medium">
                      {format(new Date(selectedOrder.created_at), "d MMMM yyyy", { locale: nl })}
                    </p>
                  </div>
                </div>

                {selectedOrder.notes && (
                  <div>
                    <span className="text-sm text-muted-foreground">Opmerkingen:</span>
                    <p className="text-sm">{selectedOrder.notes}</p>
                  </div>
                )}

                <div>
                  <span className="text-sm text-muted-foreground">Producten:</span>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead className="text-right">Aantal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orderItems.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.product_name}</TableCell>
                          <TableCell className="text-muted-foreground">{item.article_code}</TableCell>
                          <TableCell className="text-right">{item.quantity}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
