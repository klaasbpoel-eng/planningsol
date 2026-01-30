import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Snowflake, Calendar, Package, Loader2, Trash2, Box, Repeat, Edit2, AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { CreateDryIceOrderDialog } from "./CreateDryIceOrderDialog";
import { DryIceOrderDialog } from "@/components/calendar/DryIceOrderDialog";
import { useUserRole } from "@/hooks/useUserRole";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface ProductType {
  id: string;
  name: string;
}

interface Packaging {
  id: string;
  name: string;
}

interface DryIceOrder {
  id: string;
  order_number: string;
  customer_name: string;
  quantity_kg: number;
  product_type: string;
  product_type_id: string | null;
  packaging_id: string | null;
  scheduled_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_recurring: boolean | null;
  recurrence_end_date: string | null;
  container_has_wheels: boolean | null;
  box_count: number | null;
  assigned_to: string | null;
  created_by: string;
  customer_id: string | null;
  parent_order_id: string | null;
}

export function DryIcePlanning() {
  const [orders, setOrders] = useState<DryIceOrder[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<Packaging[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DryIceOrder | null>(null);
  const [userId, setUserId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<DryIceOrder | null>(null);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const { isAdmin } = useUserRole(userId);

  const handleEditOrder = (order: DryIceOrder) => {
    setSelectedOrder(order);
    setEditDialogOpen(true);
  };

  const handleEditDialogClose = (open: boolean) => {
    setEditDialogOpen(open);
    if (!open) {
      setSelectedOrder(null);
    }
  };

  const handleOrderUpdated = () => {
    fetchOrders();
    setEditDialogOpen(false);
    setSelectedOrder(null);
  };

  const handleOrderCreated = () => {
    fetchOrders();
    setDialogOpen(false);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id);
    });
  }, []);

  useEffect(() => {
    fetchOrders();
    fetchProductTypes();
    fetchPackaging();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("dry_ice_orders")
      .select("*")
      .order("scheduled_date", { ascending: true });

    if (error) {
      console.error("Error fetching orders:", error);
      toast.error("Fout bij ophalen orders");
    } else {
      setOrders(data || []);
    }
    setLoading(false);
  };

  const fetchProductTypes = async () => {
    const { data, error } = await supabase
      .from("dry_ice_product_types")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order");

    if (!error && data) {
      setProductTypes(data);
    }
  };

  const fetchPackaging = async () => {
    const { data, error } = await supabase
      .from("dry_ice_packaging")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order");

    if (!error && data) {
      setPackagingOptions(data);
    }
  };

  const handleDeleteClick = (order: DryIceOrder) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    
    const { error } = await supabase
      .from("dry_ice_orders")
      .delete()
      .eq("id", orderToDelete.id);

    if (error) {
      toast.error("Fout bij verwijderen order");
    } else {
      toast.success("Order verwijderd");
      fetchOrders();
    }
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
  };

  const handleDeleteAllClick = () => {
    setDeleteAllDialogOpen(true);
  };

  const handleConfirmDeleteAll = async () => {
    setDeletingAll(true);
    
    try {
      const BATCH_SIZE = 1000;
      let totalDeleted = 0;
      let hasMore = true;
      
      while (hasMore) {
        // Haal een batch IDs op
        const { data: batch, error: fetchError } = await supabase
          .from("dry_ice_orders")
          .select("id")
          .limit(BATCH_SIZE);
        
        if (fetchError) throw fetchError;
        if (!batch || batch.length === 0) {
          hasMore = false;
          break;
        }
        
        const ids = batch.map(order => order.id);
        
        // Verwijder deze batch
        const { error: deleteError } = await supabase
          .from("dry_ice_orders")
          .delete()
          .in("id", ids);
        
        if (deleteError) throw deleteError;
        
        totalDeleted += batch.length;
        hasMore = batch.length === BATCH_SIZE;
      }
      
      toast.success(`Alle ${totalDeleted} droogijs orders zijn verwijderd`);
      fetchOrders();
    } catch (err) {
      toast.error("Fout bij verwijderen van orders");
      console.error("Error:", err);
    } finally {
      setDeletingAll(false);
      setDeleteAllDialogOpen(false);
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    // Optimistic update
    setOrders(prev => prev.map(order => 
      order.id === id ? { ...order, status: newStatus } : order
    ));

    const { error } = await supabase
      .from("dry_ice_orders")
      .update({ status: newStatus as "pending" | "in_progress" | "completed" | "cancelled" })
      .eq("id", id);

    if (error) {
      toast.error("Fout bij bijwerken status");
      fetchOrders(); // Revert on error
    } else {
      toast.success("Status bijgewerkt");
    }
  };

  const statusLabels: Record<string, string> = {
    pending: "Gepland",
    in_progress: "Bezig",
    completed: "Voltooid",
    cancelled: "Geannuleerd",
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      pending: { variant: "secondary", label: "Gepland" },
      in_progress: { variant: "default", label: "Bezig" },
      completed: { variant: "outline", label: "Voltooid" },
      cancelled: { variant: "destructive", label: "Geannuleerd" },
    };
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getProductTypeLabel = (order: DryIceOrder) => {
    if (order.product_type_id) {
      const pt = productTypes.find(p => p.id === order.product_type_id);
      if (pt) return pt.name;
    }
    // Fallback to old enum-based labels
    const labels: Record<string, string> = {
      blocks: "Blokken",
      pellets: "Pellets",
      sticks: "Sticks",
    };
    return labels[order.product_type] || order.product_type;
  };

  const getPackagingLabel = (order: DryIceOrder) => {
    if (order.packaging_id) {
      const pkg = packagingOptions.find(p => p.id === order.packaging_id);
      if (pkg) return pkg.name;
    }
    return "-";
  };

  const todayTotal = orders
    .filter(o => o.scheduled_date === format(new Date(), "yyyy-MM-dd") && o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.quantity_kg), 0);

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
        {isAdmin && (
          <div className="flex gap-2">
            <Button 
              variant="destructive" 
              onClick={handleDeleteAllClick}
              disabled={orders.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Alle orders verwijderen
            </Button>
            <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe productieorder
            </Button>
          </div>
        )}
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
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : orders.length === 0 ? (
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
                      <TableHead>Type</TableHead>
                      <TableHead>Hoeveelheid</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="w-[80px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {order.order_number}
                            {order.is_recurring && (
                              <span title="Onderdeel van herhalende reeks" className="text-cyan-500">
                                <Repeat className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>{getProductTypeLabel(order)}</TableCell>
                        <TableCell>{order.quantity_kg} kg</TableCell>
                        <TableCell>
                          {format(new Date(order.scheduled_date), "d MMM yyyy", { locale: nl })}
                        </TableCell>
                        <TableCell>
                          {isAdmin ? (
                            <Select 
                              value={order.status} 
                              onValueChange={(newStatus) => handleStatusChange(order.id, newStatus)}
                            >
                              <SelectTrigger className="h-8 w-[130px] bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background border shadow-lg z-50">
                                {Object.entries(statusLabels).map(([value, label]) => (
                                  <SelectItem key={value} value={value}>{label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            getStatusBadge(order.status)
                          )}
                        </TableCell>
                        {isAdmin && (
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleEditOrder(order)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleDeleteClick(order)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
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
                  <span className="font-medium">{todayTotal} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Beschikbaar</span>
                  <span className="font-medium text-green-500">{500 - todayTotal} kg</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateDryIceOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleOrderCreated}
      />

      <DryIceOrderDialog
        order={selectedOrder ? {
          ...selectedOrder,
          product_type: selectedOrder.product_type as "blocks" | "pellets" | "sticks",
          status: selectedOrder.status as "pending" | "in_progress" | "completed" | "cancelled",
          is_recurring: selectedOrder.is_recurring ?? false,
          product_type_info: productTypes.find(p => p.id === selectedOrder.product_type_id) ? {
            ...productTypes.find(p => p.id === selectedOrder.product_type_id)!,
            description: null,
            is_active: true,
            sort_order: 0,
            created_at: "",
            updated_at: ""
          } : null,
          packaging_info: packagingOptions.find(p => p.id === selectedOrder.packaging_id) ? {
            ...packagingOptions.find(p => p.id === selectedOrder.packaging_id)!,
            description: null,
            is_active: true,
            sort_order: 0,
            created_at: "",
            updated_at: "",
            capacity_kg: null
          } : null,
        } : null}
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        onUpdate={handleOrderUpdated}
        isAdmin={isAdmin}
        productTypes={productTypes.map(pt => ({ ...pt, description: null, is_active: true, sort_order: 0, created_at: "", updated_at: "" }))}
        packagingOptions={packagingOptions.map(pkg => ({ ...pkg, description: null, is_active: true, sort_order: 0, created_at: "", updated_at: "", capacity_kg: null }))}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Order verwijderen</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je order {orderToDelete?.order_number} wilt verwijderen? 
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Alle droogijs orders verwijderen
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                <strong>Let op!</strong> Je staat op het punt om <strong>ALLE {orders.length} droogijs orders</strong> uit de database te verwijderen.
              </p>
              <p>
                Deze actie is <strong>permanent</strong> en kan <strong>niet</strong> ongedaan worden gemaakt.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Annuleren</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingAll}
            >
              {deletingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verwijderen...
                </>
              ) : (
                "Ja, verwijder alles"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
