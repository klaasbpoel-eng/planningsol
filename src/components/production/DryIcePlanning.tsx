import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Snowflake, Calendar, Package, Loader2, Trash2, Box, Repeat, Edit2, AlertTriangle, Filter, X, ArrowUp, ArrowDown, ArrowUpDown, FileSpreadsheet } from "lucide-react";
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
import { formatNumber } from "@/lib/utils";
import { CreateDryIceOrderDialog } from "./CreateDryIceOrderDialog";
import { DryIceOrderDialog } from "@/components/calendar/DryIceOrderDialog";
import { DryIceExcelImportDialog } from "./DryIceExcelImportDialog";
import { useUserPermissions } from "@/hooks/useUserPermissions";
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

type StatusFilter = "all" | "pending" | "in_progress" | "completed" | "cancelled";
type SortColumn = "order_number" | "customer_name" | "product_type" | "quantity_kg" | "scheduled_date" | "status";
type SortDirection = "asc" | "desc";

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
  location: "sol_emmen" | "sol_tilburg";
}

interface DryIcePlanningProps {
  onDataChanged?: () => void;
}

export function DryIcePlanning({ onDataChanged }: DryIcePlanningProps) {
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
  const [deleteYear, setDeleteYear] = useState<number>(new Date().getFullYear());
  const [deleteYearCount, setDeleteYearCount] = useState<number | null>(null);
  const [loadingDeleteCount, setLoadingDeleteCount] = useState(false);
  const [dailyCapacity, setDailyCapacity] = useState<number>(500);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  
  // Filter states
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("scheduled_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  
  const { permissions } = useUserPermissions(userId);

  // Unique customers from orders for filtering
  const uniqueCustomers = [...new Set(orders.map(o => o.customer_name))].sort();
  
  // Generate available years (2022 to current year + 1)
  const availableYears = Array.from(
    { length: new Date().getFullYear() - 2021 + 1 },
    (_, i) => 2022 + i
  );

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    }
    return sortDirection === "asc" 
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

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
    onDataChanged?.();
  };

  const handleOrderCreated = () => {
    fetchOrders();
    setDialogOpen(false);
    onDataChanged?.();
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
    fetchDailyCapacity();
  }, [yearFilter]);

  const fetchDailyCapacity = async () => {
    const { data } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "dry_ice_daily_capacity_kg")
      .maybeSingle();

    if (data?.value) {
      setDailyCapacity(Number(data.value));
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    const startDate = `${yearFilter}-01-01`;
    const endDate = `${yearFilter}-12-31`;
    
    const { data, error } = await supabase
      .from("dry_ice_orders")
      .select("*")
      .gte("scheduled_date", startDate)
      .lte("scheduled_date", endDate)
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
      onDataChanged?.();
    }
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
  };

  const fetchDeleteYearCount = async (year: number) => {
    setLoadingDeleteCount(true);
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    
    const { count, error } = await supabase
      .from("dry_ice_orders")
      .select("*", { count: "exact", head: true })
      .gte("scheduled_date", startDate)
      .lte("scheduled_date", endDate);
    
    if (!error) {
      setDeleteYearCount(count || 0);
    }
    setLoadingDeleteCount(false);
  };

  const handleDeleteYearChange = (year: number) => {
    setDeleteYear(year);
    fetchDeleteYearCount(year);
  };

  const handleDeleteAllClick = () => {
    const currentYear = new Date().getFullYear();
    setDeleteYear(currentYear);
    fetchDeleteYearCount(currentYear);
    setDeleteAllDialogOpen(true);
  };

  const handleConfirmDeleteAll = async () => {
    setDeletingAll(true);
    
    try {
      // Roep server-side RPC functie aan voor snelle bulk delete
      const { data, error } = await supabase
        .rpc('bulk_delete_orders_by_year', {
          p_year: deleteYear,
          p_order_type: 'dry_ice'
        });
      
      if (error) throw error;
      
      toast.success(`Alle ${data} droogijs orders van ${deleteYear} zijn verwijderd`);
      fetchOrders();
      onDataChanged?.();
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

  // Filtering logic
  const filteredOrders = orders.filter(o => {
    const matchesCustomer = customerFilter === "all" || o.customer_name === customerFilter;
    const matchesProductType = productTypeFilter === "all" || o.product_type_id === productTypeFilter;
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesCustomer && matchesProductType && matchesStatus;
  });

  // Sorting logic
  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let comparison = 0;
    switch (sortColumn) {
      case "order_number":
      case "customer_name":
      case "product_type":
      case "status":
        comparison = (a[sortColumn] || "").localeCompare(b[sortColumn] || "");
        break;
      case "quantity_kg":
        comparison = Number(a.quantity_kg) - Number(b.quantity_kg);
        break;
      case "scheduled_date":
        comparison = new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const todayTotal = filteredOrders
    .filter(o => o.scheduled_date === format(new Date(), "yyyy-MM-dd") && o.status !== "cancelled")
    .reduce((sum, o) => sum + Number(o.quantity_kg), 0);

  const hasActiveFilters = customerFilter !== "all" || productTypeFilter !== "all" || statusFilter !== "all" || yearFilter !== new Date().getFullYear();

  const clearFilters = () => {
    setCustomerFilter("all");
    setProductTypeFilter("all");
    setStatusFilter("all");
    setYearFilter(new Date().getFullYear());
  };

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
        <div className="flex gap-2">
          {permissions?.canDeleteOrders && (
            <Button 
              variant="destructive" 
              onClick={handleDeleteAllClick}
              disabled={orders.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Alle orders verwijderen
            </Button>
          )}
          {permissions?.canCreateOrders && (
            <>
              <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
                <FileSpreadsheet className="h-4 w-4 mr-2" />
                Excel import
              </Button>
              <Button className="bg-cyan-500 hover:bg-cyan-600" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nieuwe productieorder
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Production queue */}
        <div className="lg:col-span-2">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Productiewachtrij
                  </CardTitle>
                  <CardDescription>
                    Geplande productieorders voor droogijs
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={yearFilter.toString()} onValueChange={(v) => setYearFilter(parseInt(v))}>
                    <SelectTrigger className="w-[100px] bg-background">
                      <SelectValue placeholder="Jaar" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      {availableYears.map((year) => (
                        <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {hasActiveFilters && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={clearFilters}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Wis filters
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredOrders.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Snowflake className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">
                    {hasActiveFilters
                      ? "Geen orders gevonden met de huidige filters" 
                      : "Geen productieorders gepland"}
                  </p>
                  <p className="text-sm">
                    {hasActiveFilters
                      ? "Pas de filters aan of voeg een nieuwe order toe" 
                      : "Voeg een nieuwe productieorder toe om te beginnen"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>
                        <div className="space-y-1">
                          <div className="flex items-center cursor-pointer select-none" onClick={() => handleSort("customer_name")}>
                            Klant<SortIcon column="customer_name" />
                          </div>
                          <Select value={customerFilter} onValueChange={(v) => setCustomerFilter(v)}>
                            <SelectTrigger className="h-7 text-xs bg-background w-full">
                              <SelectValue placeholder="Alle" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50 max-h-[300px]">
                              <SelectItem value="all">Alle klanten</SelectItem>
                              {uniqueCustomers.map((customer) => (
                                <SelectItem key={customer} value={customer}>{customer}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableHead>
                      <TableHead>
                        <div className="space-y-1">
                          <div className="flex items-center cursor-pointer select-none" onClick={() => handleSort("product_type")}>
                            Type<SortIcon column="product_type" />
                          </div>
                          <Select value={productTypeFilter} onValueChange={(v) => setProductTypeFilter(v)}>
                            <SelectTrigger className="h-7 text-xs bg-background w-full">
                              <SelectValue placeholder="Alle" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="all">Alle types</SelectItem>
                              {productTypes.map((pt) => (
                                <SelectItem key={pt.id} value={pt.id}>{pt.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort("quantity_kg")}>
                        <div className="flex items-center">Hoeveelheid<SortIcon column="quantity_kg" /></div>
                      </TableHead>
                      <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort("scheduled_date")}>
                        <div className="flex items-center">Datum<SortIcon column="scheduled_date" /></div>
                      </TableHead>
                      <TableHead>
                        <div className="space-y-1">
                          <div className="flex items-center cursor-pointer select-none" onClick={() => handleSort("status")}>
                            Status<SortIcon column="status" />
                          </div>
                          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                            <SelectTrigger className="h-7 text-xs bg-background w-full">
                              <SelectValue placeholder="Alle" />
                            </SelectTrigger>
                            <SelectContent className="bg-background border shadow-lg z-50">
                              <SelectItem value="all">Alle</SelectItem>
                              {Object.entries(statusLabels).map(([value, label]) => (
                                <SelectItem key={value} value={value}>{label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </TableHead>
                      {(permissions?.canEditOrders || permissions?.canDeleteOrders) && <TableHead className="w-[80px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {order.customer_name}
                            {order.is_recurring && (
                              <span title="Onderdeel van herhalende reeks" className="text-cyan-500">
                                <Repeat className="h-3.5 w-3.5" />
                              </span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{getProductTypeLabel(order)}</TableCell>
                        <TableCell>{formatNumber(order.quantity_kg, 0)} kg</TableCell>
                        <TableCell>
                          {format(new Date(order.scheduled_date), "d MMM yyyy", { locale: nl })}
                        </TableCell>
                        <TableCell>
                          {permissions?.canEditOrders ? (
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
                        {(permissions?.canEditOrders || permissions?.canDeleteOrders) && (
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
                  <span className="font-medium">{dailyCapacity} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Vandaag gepland</span>
                  <span className="font-medium">{todayTotal} kg</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Beschikbaar</span>
                  <span className={`font-medium ${dailyCapacity - todayTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {dailyCapacity - todayTotal} kg
                  </span>
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
        canEdit={permissions?.canEditOrders}
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
              Droogijs orders verwijderen per jaar
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-4">
              <p>
                Selecteer het jaar waarvan je alle droogijs orders wilt verwijderen.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">Jaar:</span>
                <Select value={deleteYear.toString()} onValueChange={(v) => handleDeleteYearChange(parseInt(v))}>
                  <SelectTrigger className="w-[120px] bg-background">
                    <SelectValue placeholder="Selecteer jaar" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    {availableYears.map((year) => (
                      <SelectItem key={year} value={year.toString()}>{year}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="p-3 bg-muted/50 rounded-lg border">
                {loadingDeleteCount ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Aantal orders laden...
                  </div>
                ) : deleteYearCount === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Er zijn geen droogijs orders in {deleteYear}.
                  </p>
                ) : (
                  <p className="text-sm">
                    <strong className="text-destructive">{deleteYearCount}</strong> droogijs orders zullen worden verwijderd.
                  </p>
                )}
              </div>
              <p className="text-destructive font-medium">
                Deze actie is permanent en kan niet ongedaan worden gemaakt.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingAll}>Annuleren</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleConfirmDeleteAll}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletingAll || deleteYearCount === 0}
            >
              {deletingAll ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Verwijderen...
                </>
              ) : (
                `Verwijder ${deleteYearCount || 0} orders`
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DryIceExcelImportDialog
        open={importDialogOpen}
        onOpenChange={setImportDialogOpen}
        onImported={() => {
          fetchOrders();
          onDataChanged?.();
        }}
      />
    </div>
  );
}
