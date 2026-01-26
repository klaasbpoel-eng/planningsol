import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Cylinder, Calendar, Gauge, AlertTriangle, Loader2, Trash2, Filter, CalendarIcon, X, Edit2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { CreateGasCylinderOrderDialog } from "./CreateGasCylinderOrderDialog";
import { GasCylinderOrderDialog } from "./GasCylinderOrderDialog";
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

interface GasCylinderOrder {
  id: string;
  order_number: string;
  customer_name: string;
  gas_type: string;
  gas_grade: string;
  cylinder_count: number;
  cylinder_size: string;
  scheduled_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  pressure: number;
}

type PressureFilter = "all" | "200" | "300";
type GasTypeFilter = "all" | "co2" | "nitrogen" | "argon" | "acetylene" | "oxygen" | "helium" | "other";
type StatusFilter = "all" | "pending" | "in_progress" | "completed" | "cancelled";

export function GasCylinderPlanning() {
  const [orders, setOrders] = useState<GasCylinderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<GasCylinderOrder | null>(null);
  const [pressureFilter, setPressureFilter] = useState<PressureFilter>("all");
  const [gasTypeFilter, setGasTypeFilter] = useState<GasTypeFilter>("all");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [userId, setUserId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<GasCylinderOrder | null>(null);
  const { isAdmin } = useUserRole(userId);

  const handleEditOrder = (order: GasCylinderOrder) => {
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
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("gas_cylinder_orders")
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

  const handleDeleteClick = (order: GasCylinderOrder) => {
    setOrderToDelete(order);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    
    const { error } = await supabase
      .from("gas_cylinder_orders")
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

  const handleStatusChange = async (id: string, newStatus: string) => {
    // Optimistic update
    setOrders(prev => prev.map(order => 
      order.id === id ? { ...order, status: newStatus } : order
    ));

    const { error } = await supabase
      .from("gas_cylinder_orders")
      .update({ status: newStatus as "pending" | "in_progress" | "completed" | "cancelled" })
      .eq("id", id);

    if (error) {
      toast.error("Fout bij bijwerken status");
      fetchOrders(); // Revert on error
    } else {
      toast.success("Status bijgewerkt");
    }
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

  const gasTypeLabels: Record<string, string> = {
    co2: "CO₂",
    nitrogen: "Stikstof (N₂)",
    argon: "Argon",
    acetylene: "Acetyleen",
    oxygen: "Zuurstof",
    helium: "Helium",
    other: "Overig",
  };

  const getGasTypeLabel = (type: string) => {
    return gasTypeLabels[type] || type;
  };

  const statusLabels: Record<string, string> = {
    pending: "Gepland",
    in_progress: "Bezig",
    completed: "Voltooid",
    cancelled: "Geannuleerd",
  };

  const filteredOrders = orders.filter(o => {
    const matchesPressure = pressureFilter === "all" || o.pressure === parseInt(pressureFilter);
    const matchesGasType = gasTypeFilter === "all" || o.gas_type === gasTypeFilter;
    const matchesDate = !dateFilter || o.scheduled_date === format(dateFilter, "yyyy-MM-dd");
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    return matchesPressure && matchesGasType && matchesDate && matchesStatus;
  });

  const todayCount = filteredOrders
    .filter(o => o.scheduled_date === format(new Date(), "yyyy-MM-dd") && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.cylinder_count, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Cylinder className="h-5 w-5 text-orange-500" />
            Gascilinders Vulling
          </h2>
          <p className="text-sm text-muted-foreground">
            Beheer vulorders voor gascilinders
          </p>
        </div>
        {isAdmin && (
          <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Nieuwe vulorder
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Filling queue */}
        <div className="lg:col-span-2">
          <Card className="glass-card">
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Vulwachtrij
                  </CardTitle>
                  <CardDescription>
                    Geplande vulorders voor gascilinders
                  </CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-[160px] justify-start text-left font-normal bg-background",
                          !dateFilter && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateFilter ? format(dateFilter, "d MMM yyyy", { locale: nl }) : "Alle datums"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                      <CalendarComponent
                        mode="single"
                        selected={dateFilter}
                        onSelect={setDateFilter}
                        initialFocus
                        locale={nl}
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                  {dateFilter && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setDateFilter(undefined)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                  {(dateFilter || pressureFilter !== "all" || gasTypeFilter !== "all" || statusFilter !== "all") && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9"
                      onClick={() => {
                        setDateFilter(undefined);
                        setPressureFilter("all");
                        setGasTypeFilter("all");
                        setStatusFilter("all");
                      }}
                    >
                      <X className="h-4 w-4 mr-1" />
                      Wis filters
                    </Button>
                  )}
                  <Select value={gasTypeFilter} onValueChange={(v) => setGasTypeFilter(v as GasTypeFilter)}>
                    <SelectTrigger className="w-[150px] bg-background">
                      <SelectValue placeholder="Gastype" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="all">Alle gastypes</SelectItem>
                      {Object.entries(gasTypeLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={pressureFilter} onValueChange={(v) => setPressureFilter(v as PressureFilter)}>
                    <SelectTrigger className="w-[140px] bg-background">
                      <SelectValue placeholder="Druk" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="all">Alle drukken</SelectItem>
                      <SelectItem value="200">200 bar</SelectItem>
                      <SelectItem value="300">300 bar</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
                    <SelectTrigger className="w-[140px] bg-background">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent className="bg-background border shadow-lg z-50">
                      <SelectItem value="all">Alle statussen</SelectItem>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                  <Cylinder className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">
                    {dateFilter || pressureFilter !== "all" || gasTypeFilter !== "all" || statusFilter !== "all"
                      ? "Geen orders gevonden met de huidige filters" 
                      : "Geen vulorders gepland"}
                  </p>
                  <p className="text-sm">
                    {dateFilter || pressureFilter !== "all" || gasTypeFilter !== "all" || statusFilter !== "all"
                      ? "Pas de filters aan of voeg een nieuwe order toe" 
                      : "Voeg een nieuwe vulorder toe om te beginnen"}
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Klant</TableHead>
                      <TableHead>Gastype</TableHead>
                      <TableHead>Aantal</TableHead>
                      <TableHead>Druk</TableHead>
                      <TableHead>Datum</TableHead>
                      <TableHead>Status</TableHead>
                      {isAdmin && <TableHead className="w-[80px]"></TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{order.customer_name}</TableCell>
                        <TableCell>{getGasTypeLabel(order.gas_type)}</TableCell>
                        <TableCell>{order.cylinder_count} st.</TableCell>
                        <TableCell>{order.pressure} bar</TableCell>
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
          <Card className="glass-card border-orange-500/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Gauge className="h-4 w-4 text-orange-500" />
                Gastypes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">CO₂</span>
                  <span className="text-xs text-muted-foreground">85%</span>
                </div>
                <Progress value={85} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Stikstof (N₂)</span>
                  <span className="text-xs text-muted-foreground">72%</span>
                </div>
                <Progress value={72} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Argon</span>
                  <span className="text-xs text-muted-foreground">45%</span>
                </div>
                <Progress value={45} className="h-2" />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm">Acetyleen</span>
                  <span className="text-xs text-muted-foreground">30%</span>
                </div>
                <Progress value={30} className="h-2" />
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                Meldingen
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-4 text-muted-foreground">
                <p className="text-sm">Geen actieve meldingen</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Vandaag gepland</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Cilinders te vullen</span>
                  <span className="font-medium">{todayCount}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Orders</span>
                  <span className="font-medium">
                    {filteredOrders.filter(o => o.scheduled_date === format(new Date(), "yyyy-MM-dd")).length}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <CreateGasCylinderOrderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreated={handleOrderCreated}
      />

      <GasCylinderOrderDialog
        order={selectedOrder}
        open={editDialogOpen}
        onOpenChange={handleEditDialogClose}
        onUpdate={handleOrderUpdated}
        isAdmin={isAdmin}
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
    </div>
  );
}
