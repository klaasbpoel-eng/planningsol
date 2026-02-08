import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Snowflake, Calendar, Package, Trash2, Box, Repeat, Edit2, AlertTriangle, Filter, X, ArrowUp, ArrowDown, ArrowUpDown, FileSpreadsheet } from "lucide-react";
import { FloatingActionButton } from "@/components/ui/floating-action-button";
import { FadeIn } from "@/components/ui/fade-in";
import { TableSkeleton } from "@/components/ui/skeletons";
import { EmptyState } from "@/components/ui/empty-state";
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

import { DryIceOrderDialog } from "@/components/calendar/DryIceOrderDialog";
import { DryIceExcelImportDialog } from "./DryIceExcelImportDialog";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { MobileOrderCard, OrderDetail } from "./MobileOrderCard";
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

type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface DryIcePlanningProps {
  onDataChanged?: () => void;
  location?: ProductionLocation;
}

export function DryIcePlanning({ onDataChanged, location = "all" }: DryIcePlanningProps) {
  const [orders, setOrders] = useState<DryIceOrder[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<Packaging[]>([]);
  const [loading, setLoading] = useState(true);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<DryIceOrder | null>(null);
  const [userId, setUserId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<DryIceOrder | null>(null);
  const [dailyCapacity, setDailyCapacity] = useState<number>(500);
  const [importDialogOpen, setImportDialogOpen] = useState(false);

  // Filter states
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [productTypeFilter, setProductTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortColumn, setSortColumn] = useState<SortColumn>("scheduled_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const { permissions, isAdmin } = useUserPermissions(userId);

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
    try {
      const data = await api.appSettings.getByKey("dry_ice_daily_capacity_kg");
      if (data?.value) {
        setDailyCapacity(Number(data.value));
      }
    } catch (error) {
      console.error("Error fetching daily capacity:", error);
    }
  };

  const fetchOrders = async () => {
    setLoading(true);
    const startDate = `${yearFilter}-01-01`;
    const endDate = `${yearFilter}-12-31`;

    try {
      const data = await api.dryIceOrders.getAll(startDate, endDate);
      setOrders((data as DryIceOrder[]) || []);
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Fout bij ophalen orders");
    }
    setLoading(false);
  };

  const fetchProductTypes = async () => {
    try {
      const data = await api.dryIceProductTypes.getAll();
      if (data) {
        setProductTypes(data);
      }
    } catch (error) {
      console.error("Error fetching product types:", error);
    }
  };

  const fetchPackaging = async () => {
    try {
      const data = await api.dryIcePackaging.getAll();
      if (data) {
        setPackagingOptions(data);
      }
    } catch (error) {
      console.error("Error fetching packaging:", error);
    }
  };

  const handleDeleteClick = (order: DryIceOrder) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;

    try {
      await api.dryIceOrders.delete(orderToDelete.id);
      toast.success("Order verwijderd");
      fetchOrders();
      onDataChanged?.();
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Fout bij verwijderen order");
    }
    setDeleteDialogOpen(false);
    setOrderToDelete(null);
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    // Optimistic update
    setOrders(prev => prev.map(order =>
      order.id === id ? { ...order, status: newStatus } : order
    ));

    try {
      await api.dryIceOrders.update(id, { status: newStatus });
      toast.success("Status bijgewerkt");
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Fout bij bijwerken status");
      fetchOrders(); // Revert on error
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

  // Filtering logic (including location)
  const filteredOrders = orders.filter(o => {
    const matchesLocation = location === "all" || o.location === location;
    const matchesCustomer = customerFilter === "all" || o.customer_name === customerFilter;
    const matchesProductType = productTypeFilter === "all" || o.product_type_id === productTypeFilter;
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesLocation && matchesCustomer && matchesProductType && matchesStatus;
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
          {isAdmin && (
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel import
            </Button>
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
                <div className="rounded-md border">
                  <div className="border-b bg-muted/30 p-3">
                    <div className="flex gap-4">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="h-4 w-20 rounded bg-muted animate-pulse" />
                      ))}
                    </div>
                  </div>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4 p-3 border-b last:border-0">
                      {Array.from({ length: 6 }).map((_, j) => (
                        <div key={j} className="h-4 w-20 rounded bg-muted animate-pulse" />
                      ))}
                    </div>
                  ))}
                </div>
              ) : filteredOrders.length === 0 ? (
                <EmptyState
                  variant={hasActiveFilters ? "search" : "dryice"}
                  title={hasActiveFilters ? "Geen orders gevonden" : "Geen productieorders gepland"}
                  description={hasActiveFilters
                    ? "Pas de filters aan of voeg een nieuwe order toe."
                    : "Voeg een nieuwe productieorder toe om te beginnen."}
                  size="md"
                />
              ) : (
                <>
                  {/* Mobile Card Layout */}
                  <div className="md:hidden space-y-3">
                    {sortedOrders.map((order) => (
                      <MobileOrderCard
                        key={order.id}
                        id={order.id}
                        customerName={order.customer_name}
                        scheduledDate={order.scheduled_date}
                        status={order.status}
                        onStatusChange={isAdmin ? handleStatusChange : undefined}
                        onEdit={() => handleEditOrder(order)}
                        onDelete={() => handleDeleteClick(order)}
                        canEdit={isAdmin}
                        canDelete={isAdmin}
                        isRecurring={order.is_recurring ?? false}
                      >
                        <OrderDetail label="Type" value={getProductTypeLabel(order)} />
                        <OrderDetail label="Hoeveelheid" value={`${formatNumber(order.quantity_kg, 0)} kg`} />
                        <OrderDetail label="Verpakking" value={getPackagingLabel(order)} />
                        {order.box_count && (
                          <OrderDetail label="Dozen" value={order.box_count} />
                        )}
                      </MobileOrderCard>
                    ))}
                  </div>

                  {/* Desktop Table Layout */}
                  <div className="hidden md:block">
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
                          {isAdmin && <TableHead className="w-[80px]"></TableHead>}
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
                  </div>
                </>
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
        canEdit={isAdmin}
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
