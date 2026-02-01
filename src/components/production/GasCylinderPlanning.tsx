import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Cylinder, Calendar, Gauge, AlertTriangle, Loader2, Trash2, Filter, CalendarIcon, X, Edit2, ArrowUp, ArrowDown, ArrowUpDown, FileSpreadsheet, MapPin } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { cn, formatNumber } from "@/lib/utils";
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
import { GasTypeMultiSelect } from "./GasTypeMultiSelect";
import { ExcelImportDialog } from "./ExcelImportDialog";
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

interface GasCylinderOrder {
  id: string;
  order_number: string;
  customer_name: string;
  gas_type: string;
  gas_type_id: string | null;
  gas_grade: string;
  cylinder_count: number;
  cylinder_size: string;
  scheduled_date: string;
  status: string;
  notes: string | null;
  created_at: string;
  pressure: number;
  location: "sol_emmen" | "sol_tilburg";
  gas_type_ref?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

type LocationTab = "sol_emmen" | "sol_tilburg";

type PressureFilter = "all" | "200" | "300";
type StatusFilter = "all" | "pending" | "in_progress" | "completed" | "cancelled";
type GradeFilter = "all" | "medical" | "technical";
type SortColumn = "order_number" | "customer_name" | "gas_type" | "cylinder_count" | "pressure" | "scheduled_date" | "status";
type SortDirection = "asc" | "desc";

interface GasType {
  id: string;
  name: string;
  color: string;
}

interface GasCylinderPlanningProps {
  onDataChanged?: () => void;
}

export function GasCylinderPlanning({ onDataChanged }: GasCylinderPlanningProps) {
  const [orders, setOrders] = useState<GasCylinderOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<GasCylinderOrder | null>(null);
  const [pressureFilter, setPressureFilter] = useState<PressureFilter>("all");
  const [gasTypeFilter, setGasTypeFilter] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [userId, setUserId] = useState<string | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<GasCylinderOrder | null>(null);
  const [gasTypes, setGasTypes] = useState<GasType[]>([]);
  const [sortColumn, setSortColumn] = useState<SortColumn>("scheduled_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState<number>(new Date().getMonth() + 1);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [locationTab, setLocationTab] = useState<LocationTab>("sol_emmen");

  // Dutch month names for dropdown
  const monthNames = [
    "Januari", "Februari", "Maart", "April", "Mei", "Juni",
    "Juli", "Augustus", "September", "Oktober", "November", "December"
  ];
  
  // Unique customers from orders for filtering
  const uniqueCustomers = [...new Set(orders.map(o => o.customer_name))].sort();
  const { permissions, isAdmin } = useUserPermissions(userId);

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
    fetchGasTypes();
  }, [yearFilter, monthFilter]);

  const fetchGasTypes = async () => {
    const { data } = await supabase
      .from("gas_types")
      .select("id, name, color")
      .eq("is_active", true)
      .order("name");
    
    if (data) {
      setGasTypes(data);
    }
  };

  // Fetch data for a single week (to bypass Supabase 1000-row default limit)
  const fetchWeekData = async (startDate: string, endDate: string) => {
    const { data, error } = await supabase
      .from("gas_cylinder_orders")
      .select(`
        *,
        gas_type_ref:gas_types(id, name, color)
      `)
      .gte("scheduled_date", startDate)
      .lte("scheduled_date", endDate)
      .order("scheduled_date", { ascending: true })
      .limit(5000);
    
    if (error) {
      console.error(`Error fetching orders for ${startDate} - ${endDate}:`, error);
      return [];
    }
    return (data as GasCylinderOrder[]) || [];
  };

  // Get all weeks for a given month
  const getWeeksInMonth = (year: number, month: number) => {
    const weeks: { startDate: string; endDate: string }[] = [];
    const monthStr = String(month).padStart(2, '0');
    const lastDay = new Date(year, month, 0).getDate();
    
    let currentDay = 1;
    while (currentDay <= lastDay) {
      const endDay = Math.min(currentDay + 6, lastDay);
      weeks.push({
        startDate: `${year}-${monthStr}-${String(currentDay).padStart(2, '0')}`,
        endDate: `${year}-${monthStr}-${String(endDay).padStart(2, '0')}`
      });
      currentDay = endDay + 1;
    }
    return weeks;
  };

  const fetchMonthData = async (year: number, month: number) => {
    // Split month into weeks to bypass 1000-row limit
    const weeks = getWeeksInMonth(year, month);
    const weekPromises = weeks.map(({ startDate, endDate }) => 
      fetchWeekData(startDate, endDate)
    );
    const weekResults = await Promise.all(weekPromises);
    
    // Combine and deduplicate (in case of edge cases)
    const allOrders = weekResults.flat();
    const uniqueOrders = Array.from(
      new Map(allOrders.map(o => [o.id, o])).values()
    );
    return uniqueOrders.sort((a, b) => 
      a.scheduled_date.localeCompare(b.scheduled_date)
    );
  };

  const fetchOrders = async () => {
    setLoading(true);
    
    try {
      if (monthFilter === 0) {
        // Hele jaar: laad alle 12 maanden parallel
        const monthPromises = Array.from({ length: 12 }, (_, i) => 
          fetchMonthData(yearFilter, i + 1)
        );
        const allMonthData = await Promise.all(monthPromises);
        const combinedOrders = allMonthData.flat().sort((a, b) => 
          a.scheduled_date.localeCompare(b.scheduled_date)
        );
        // Deduplicate across months (shouldn't happen but safety first)
        const uniqueOrders = Array.from(
          new Map(combinedOrders.map(o => [o.id, o])).values()
        );
        setOrders(uniqueOrders);
      } else {
        // Specifieke maand
        const data = await fetchMonthData(yearFilter, monthFilter);
        setOrders(data);
      }
    } catch (error) {
      console.error("Error fetching orders:", error);
      toast.error("Fout bij ophalen orders");
    }
    
    setLoading(false);
  };

  // Generate available years (2022 to current year + 1)
  const availableYears = Array.from(
    { length: new Date().getFullYear() - 2021 + 1 },
    (_, i) => 2022 + i
  );

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
      onDataChanged?.();
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

  const getGasTypeLabel = (order: GasCylinderOrder) => {
    // First priority: use gas_type_ref from the joined gas_types table
    if (order.gas_type_ref?.name) {
      return order.gas_type_ref.name;
    }
    
    // Fallback: Try to find matching gas type from loaded gas types using gas_type_id
    if (order.gas_type_id) {
      const matchingGasType = gasTypes.find(gt => gt.id === order.gas_type_id);
      if (matchingGasType) {
        return matchingGasType.name;
      }
    }
    
    // Legacy fallback: check notes for "Gastype: Name" format (for old imported data)
    if (order.notes) {
      const gasTypeMatch = order.notes.match(/^Gastype:\s*(.+?)(?:\n|$)/i);
      if (gasTypeMatch) {
        return gasTypeMatch[1].trim();
      }
    }
    
    // Final fallback: use enum labels
    const gasTypeLabels: Record<string, string> = {
      co2: "CO₂",
      nitrogen: "Stikstof (N₂)",
      argon: "Argon",
      acetylene: "Acetyleen",
      oxygen: "Zuurstof",
      helium: "Helium",
      other: "Overig",
    };
    return gasTypeLabels[order.gas_type] || order.gas_type;
  };

  const getGasTypeColor = (order: GasCylinderOrder): string => {
    // First priority: use gas_type_ref from the joined gas_types table
    if (order.gas_type_ref?.color) {
      return order.gas_type_ref.color;
    }
    
    // Fallback: Try to find matching gas type from loaded gas types using gas_type_id
    if (order.gas_type_id) {
      const matchingGasType = gasTypes.find(gt => gt.id === order.gas_type_id);
      if (matchingGasType) {
        return matchingGasType.color;
      }
    }
    
    return "#6b7280"; // default gray
  };

  const statusLabels: Record<string, string> = {
    pending: "Gepland",
    in_progress: "Bezig",
    completed: "Voltooid",
    cancelled: "Geannuleerd",
  };

  const filteredOrders = orders.filter(o => {
    const matchesLocation = o.location === locationTab;
    const matchesPressure = pressureFilter === "all" || o.pressure === parseInt(pressureFilter);
    // Match gas type filter - empty array means all, otherwise check if the order's gas_type_id is in the selected list
    const matchesGasType = gasTypeFilter.length === 0 || (o.gas_type_id && gasTypeFilter.includes(o.gas_type_id));
    const matchesDate = !dateFilter || o.scheduled_date === format(dateFilter, "yyyy-MM-dd");
    const matchesStatus = statusFilter === "all" || o.status === statusFilter;
    const matchesGrade = gradeFilter === "all" || o.gas_grade === gradeFilter;
    const matchesCustomer = customerFilter === "all" || o.customer_name === customerFilter;
    return matchesLocation && matchesPressure && matchesGasType && matchesDate && matchesStatus && matchesGrade && matchesCustomer;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let comparison = 0;
    switch (sortColumn) {
      case "order_number":
      case "customer_name":
      case "gas_type":
      case "status":
        comparison = (a[sortColumn] || "").localeCompare(b[sortColumn] || "");
        break;
      case "cylinder_count":
      case "pressure":
        comparison = a[sortColumn] - b[sortColumn];
        break;
      case "scheduled_date":
        comparison = new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const todayCount = filteredOrders
    .filter(o => o.scheduled_date === format(new Date(), "yyyy-MM-dd") && o.status !== "cancelled")
    .reduce((sum, o) => sum + o.cylinder_count, 0);

  // Location-specific counts for tab badges
  const emmenCount = orders.filter(o => o.location === "sol_emmen").length;
  const tilburgCount = orders.filter(o => o.location === "sol_tilburg").length;

  // Total counts for the selected period (all orders, not filtered by location)
  const totalOrderCount = orders.length;
  const totalCylinderCount = orders.reduce((sum, o) => sum + o.cylinder_count, 0);
  
  // Filtered counts for current view
  const filteredOrderCount = filteredOrders.length;
  const filteredCylinderCount = filteredOrders.reduce((sum, o) => sum + o.cylinder_count, 0);

  // Period label for display
  const periodLabel = monthFilter === 0 
    ? `${yearFilter}` 
    : `${monthNames[monthFilter - 1]} ${yearFilter}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Cylinder className="h-5 w-5 text-orange-500" />
            Gascilinders Vulling
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground">
              {periodLabel}
            </p>
            <Badge variant="secondary" className="text-xs">
              {formatNumber(totalOrderCount)} orders
            </Badge>
            <Badge variant="outline" className="text-xs">
              {formatNumber(totalCylinderCount)} cilinders
            </Badge>
            {(filteredOrderCount !== totalOrderCount) && (
              <span className="text-xs text-muted-foreground">
                (gefilterd: {formatNumber(filteredOrderCount)} orders, {formatNumber(filteredCylinderCount)} cilinders)
              </span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button variant="outline" onClick={() => setImportDialogOpen(true)}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel import
            </Button>
          )}
          {permissions?.canCreateOrders && (
            <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nieuwe vulorder
            </Button>
          )}
        </div>
      </div>

      {/* Location Tabs */}
      <Tabs value={locationTab} onValueChange={(v) => setLocationTab(v as LocationTab)} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="sol_emmen" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            SOL Emmen
            <Badge variant="secondary" className="ml-1 text-xs">{emmenCount}</Badge>
          </TabsTrigger>
          <TabsTrigger value="sol_tilburg" className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            SOL Tilburg
            <Badge variant="secondary" className="ml-1 text-xs">{tilburgCount}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={locationTab} className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Filling queue */}
            <div className="lg:col-span-2">
              <Card className="glass-card">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Vulwachtrij - {locationTab === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg"}
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
                      {(dateFilter || pressureFilter !== "all" || gasTypeFilter.length > 0 || statusFilter !== "all" || gradeFilter !== "all" || customerFilter !== "all" || yearFilter !== new Date().getFullYear() || monthFilter !== new Date().getMonth() + 1) && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9"
                          onClick={() => {
                            setDateFilter(undefined);
                            setPressureFilter("all");
                            setGasTypeFilter([]);
                            setStatusFilter("all");
                            setGradeFilter("all");
                            setCustomerFilter("all");
                            setYearFilter(new Date().getFullYear());
                            setMonthFilter(new Date().getMonth() + 1);
                          }}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Wis filters
                        </Button>
                      )}
                      <Select value={monthFilter.toString()} onValueChange={(v) => setMonthFilter(parseInt(v))}>
                        <SelectTrigger className="w-[130px] bg-background">
                          <SelectValue placeholder="Maand" />
                        </SelectTrigger>
                        <SelectContent className="bg-background border shadow-lg z-50">
                          <SelectItem value="0">Hele jaar</SelectItem>
                          {monthNames.map((month, idx) => (
                            <SelectItem key={idx + 1} value={(idx + 1).toString()}>{month}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                      <GasTypeMultiSelect
                        gasTypes={gasTypes}
                        selectedGasTypes={gasTypeFilter}
                        onSelectionChange={setGasTypeFilter}
                        placeholder="Alle gastypes"
                        className="w-[180px]"
                      />
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
                        {dateFilter || pressureFilter !== "all" || gasTypeFilter.length > 0 || statusFilter !== "all"
                          ? "Geen orders gevonden met de huidige filters" 
                          : "Geen vulorders gepland"}
                      </p>
                      <p className="text-sm">
                        {dateFilter || pressureFilter !== "all" || gasTypeFilter.length > 0 || statusFilter !== "all"
                          ? "Pas de filters aan of voeg een nieuwe order toe" 
                          : "Voeg een nieuwe vulorder toe om te beginnen"}
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
                              <div className="flex items-center cursor-pointer select-none" onClick={() => handleSort("gas_type")}>
                                Gastype<SortIcon column="gas_type" />
                              </div>
                              <GasTypeMultiSelect
                                gasTypes={gasTypes}
                                selectedGasTypes={gasTypeFilter}
                                onSelectionChange={setGasTypeFilter}
                                placeholder="Alle"
                                className="h-7 text-xs w-full"
                              />
                            </div>
                          </TableHead>
                          <TableHead>
                            <div className="space-y-1">
                              <span className="text-xs text-muted-foreground">M/T</span>
                              <Select value={gradeFilter} onValueChange={(v) => setGradeFilter(v as GradeFilter)}>
                                <SelectTrigger className="h-7 text-xs bg-background w-full">
                                  <SelectValue placeholder="Alle" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border shadow-lg z-50">
                                  <SelectItem value="all">Alle</SelectItem>
                                  <SelectItem value="medical">M</SelectItem>
                                  <SelectItem value="technical">T</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </TableHead>
                          <TableHead className="cursor-pointer hover:bg-muted/50 select-none" onClick={() => handleSort("cylinder_count")}>
                            <div className="flex items-center">Aantal<SortIcon column="cylinder_count" /></div>
                          </TableHead>
                          <TableHead>
                            <div className="space-y-1">
                              <div className="flex items-center cursor-pointer select-none" onClick={() => handleSort("pressure")}>
                                Druk<SortIcon column="pressure" />
                              </div>
                              <Select value={pressureFilter} onValueChange={(v) => setPressureFilter(v as PressureFilter)}>
                                <SelectTrigger className="h-7 text-xs bg-background w-full">
                                  <SelectValue placeholder="Alle" />
                                </SelectTrigger>
                                <SelectContent className="bg-background border shadow-lg z-50">
                                  <SelectItem value="all">Alle</SelectItem>
                                  <SelectItem value="200">200</SelectItem>
                                  <SelectItem value="300">300</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
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
                            <TableCell>{order.customer_name}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-2 h-2 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: getGasTypeColor(order) }} 
                                />
                                {getGasTypeLabel(order)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {order.gas_grade === "medical" ? "M" : "T"}
                              </Badge>
                            </TableCell>
                            <TableCell>{formatNumber(order.cylinder_count, 0)} st.</TableCell>
                            <TableCell>{formatNumber(order.pressure, 0)} bar</TableCell>
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
              <Card className="glass-card border-orange-500/20">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Gauge className="h-4 w-4 text-orange-500" />
                    Gastypes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {gasTypes.length > 0 ? (
                    (() => {
                      // Calculate total cylinders across all orders
                      const allCylinders = orders.reduce((sum, order) => sum + order.cylinder_count, 0);
                      
                      // Calculate cylinder count per gas type and sort
                      const gasTypeStats = gasTypes.map((type) => {
                        const typeOrders = orders.filter(order => 
                          order.gas_type_id === type.id || order.gas_type_ref?.id === type.id
                        );
                        const totalCylinders = typeOrders.reduce((sum, order) => sum + order.cylinder_count, 0);
                        return { ...type, totalCylinders };
                      })
                      .sort((a, b) => b.totalCylinders - a.totalCylinders)
                      .slice(0, 6);

                      return gasTypeStats.map((type) => {
                        const percentage = allCylinders > 0 
                          ? Math.round((type.totalCylinders / allCylinders) * 100) 
                          : 0;
                        
                        return (
                          <div key={type.id} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div 
                                  className="w-2 h-2 rounded-full flex-shrink-0" 
                                  style={{ backgroundColor: type.color }} 
                                />
                                <span className="text-sm">{type.name}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {type.totalCylinders} cilinders
                              </span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      });
                    })()
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-2">
                      Geen gastypes beschikbaar
                    </p>
                  )}
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
        </TabsContent>
      </Tabs>

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
        canEdit={permissions?.canEditOrders}
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

      <ExcelImportDialog
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
