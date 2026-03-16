import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Cylinder, Calendar, Filter, CalendarIcon, X, ArrowUp, ArrowDown, ArrowUpDown, MapPin } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
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
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { toast } from "sonner";
import { getGasColor } from "@/constants/gasColors";

interface ProductieRow {
  id: string;
  Jaar: number;
  Datum: string;
  Locatie: string;
  Product: string;
  Capaciteit: number;
  Aantal: number;
  Klant: string;
}

interface CylinderFilling {
  id: string;
  customer_name: string;
  gas_type: string;
  cylinder_count: number;
  cylinder_size: number;
  scheduled_date: string; // YYYY-MM-DD
  location: "sol_emmen" | "sol_tilburg";
}

type LocationTab = "sol_emmen" | "sol_tilburg";
type SortColumn = "customer_name" | "gas_type" | "cylinder_count" | "cylinder_size" | "scheduled_date";
type SortDirection = "asc" | "desc";
type ProductionLocation = "sol_emmen" | "sol_tilburg" | "all";

interface GasCylinderPlanningProps {
  onDataChanged?: () => void;
  location?: ProductionLocation;
}

function mapLocatie(locatie: string): "sol_emmen" | "sol_tilburg" {
  return locatie.toLowerCase().includes("emmen") ? "sol_emmen" : "sol_tilburg";
}

// Convert datum to "YYYY-MM-DD"
// Handles both ISO "2020-01-02T00:00:00.000Z" (new) and "DD-MM-YYYY" (legacy)
function mapDatum(datum: string): string {
  if (!datum) return "";
  if (datum.includes("T")) return datum.substring(0, 10);
  const parts = datum.split("-");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return datum;
}

export function GasCylinderPlanning({ location = "all" }: GasCylinderPlanningProps) {
  const getInitialTab = (): LocationTab => {
    if (location === "sol_emmen" || location === "sol_tilburg") return location;
    return "sol_emmen";
  };

  const [orders, setOrders] = useState<CylinderFilling[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [productFilter, setProductFilter] = useState<string>("");
  const [sortColumn, setSortColumn] = useState<SortColumn>("scheduled_date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [yearFilter, setYearFilter] = useState<number>(new Date().getFullYear());
  const [monthFilter, setMonthFilter] = useState<number>(0);
  const [locationTab, setLocationTab] = useState<LocationTab>(getInitialTab());

  useEffect(() => {
    if (location === "sol_emmen" || location === "sol_tilburg") {
      setLocationTab(location);
    }
  }, [location]);

  const showLocationTabs = location === "all";

  const monthNames = [
    "Januari", "Februari", "Maart", "April", "Mei", "Juni",
    "Juli", "Augustus", "September", "Oktober", "November", "December",
  ];

  const uniqueCustomers = [...new Set(orders.map((o) => o.customer_name))].sort();

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const SortIcon = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
    return sortDirection === "asc"
      ? <ArrowUp className="h-4 w-4 ml-1" />
      : <ArrowDown className="h-4 w-4 ml-1" />;
  };

  useEffect(() => {
    fetchOrders();
  }, [yearFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const PAGE = 1000;
      const allData: ProductieRow[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await (supabase.from("Productie" as never) as any)
          .select("id,Jaar,Datum,Locatie,Product,Capaciteit,Aantal,Klant")
          .eq("Jaar", yearFilter)
          .range(from, from + PAGE - 1);
        if (error) {
          console.error("Error fetching Productie:", error);
          toast.error(`Fout bij ophalen productiedata: ${error.message}`);
          setOrders([]);
          setLoading(false);
          return;
        }
        if (!data || data.length === 0) break;
        allData.push(...data);
        if (data.length < PAGE) break;
        from += PAGE;
      }
      setOrders(allData.map((row) => ({
        id: row.id,
        customer_name: row.Klant || "",
        gas_type: row.Product || "",
        cylinder_count: row.Aantal || 0,
        cylinder_size: row.Capaciteit || 0,
        scheduled_date: mapDatum(row.Datum),
        location: mapLocatie(row.Locatie || ""),
      })));
    } catch (err) {
      console.error("Fetch error:", err);
      toast.error("Fout bij ophalen productiedata");
      setOrders([]);
    }
    setLoading(false);
  };

  // Available years: 2020 to current year
  const availableYears = Array.from(
    { length: new Date().getFullYear() - 2019 + 1 },
    (_, i) => 2020 + i
  );

  const filteredOrders = orders.filter((o) => {
    if (o.location !== locationTab) return false;
    if (monthFilter !== 0) {
      const month = parseInt(o.scheduled_date.split("-")[1], 10);
      if (month !== monthFilter) return false;
    }
    if (dateFilter && o.scheduled_date !== format(dateFilter, "yyyy-MM-dd")) return false;
    if (customerFilter !== "all" && o.customer_name !== customerFilter) return false;
    if (productFilter && !o.gas_type.toLowerCase().includes(productFilter.toLowerCase())) return false;
    return true;
  });

  const sortedOrders = [...filteredOrders].sort((a, b) => {
    let comparison = 0;
    switch (sortColumn) {
      case "customer_name":
      case "gas_type":
        comparison = (a[sortColumn] || "").localeCompare(b[sortColumn] || "");
        break;
      case "cylinder_count":
      case "cylinder_size":
        comparison = a[sortColumn] - b[sortColumn];
        break;
      case "scheduled_date":
        comparison = a.scheduled_date.localeCompare(b.scheduled_date);
        break;
    }
    return sortDirection === "asc" ? comparison : -comparison;
  });

  const countForLocation = (loc: LocationTab) =>
    orders.filter((o) => {
      if (o.location !== loc) return false;
      if (monthFilter !== 0) {
        const month = parseInt(o.scheduled_date.split("-")[1], 10);
        return month === monthFilter;
      }
      return true;
    }).length;

  const emmenCount = countForLocation("sol_emmen");
  const tilburgCount = countForLocation("sol_tilburg");
  const totalCylinderCount = filteredOrders.reduce((sum, o) => sum + o.cylinder_count, 0);

  const periodLabel =
    monthFilter === 0 ? `${yearFilter}` : `${monthNames[monthFilter - 1]} ${yearFilter}`;

  const hasActiveFilters =
    dateFilter !== undefined ||
    customerFilter !== "all" ||
    productFilter !== "" ||
    yearFilter !== new Date().getFullYear() ||
    monthFilter !== new Date().getMonth() + 1;

  const clearFilters = () => {
    setDateFilter(undefined);
    setCustomerFilter("all");
    setProductFilter("");
    setYearFilter(new Date().getFullYear());
    setMonthFilter(new Date().getMonth() + 1);
  };

  const renderOrderContent = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2">
        <Card className="glass-card">
          <CardHeader>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Vulwachtrij – {locationTab === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg"}
                </CardTitle>
                <CardDescription>Productiedata gascilinders</CardDescription>
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
                      {dateFilter ? format(dateFilter, "dd-MM-yyyy") : "Datum"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                    <CalendarComponent
                      mode="single"
                      selected={dateFilter}
                      onSelect={setDateFilter}
                      locale={nl}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
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
                <Select value={monthFilter.toString()} onValueChange={(v) => setMonthFilter(parseInt(v))}>
                  <SelectTrigger className="w-[130px] bg-background">
                    <SelectValue placeholder="Maand" />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="0">Hele jaar</SelectItem>
                    {monthNames.map((name, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {hasActiveFilters && (
                  <Button variant="outline" size="sm" className="h-9" onClick={clearFilters}>
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
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="h-4 w-20 rounded bg-muted animate-pulse" />
                    ))}
                  </div>
                </div>
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 p-3 border-b last:border-0">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div key={j} className="h-4 w-20 rounded bg-muted animate-pulse" />
                    ))}
                  </div>
                ))}
              </div>
            ) : filteredOrders.length === 0 ? (
              <EmptyState
                variant={hasActiveFilters ? "search" : "gascylinder"}
                title="Geen vulorders gevonden"
                description={
                  hasActiveFilters
                    ? "Pas de filters aan."
                    : "Geen productiedata voor deze periode."
                }
                size="md"
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>
                      <div className="space-y-1">
                        <div
                          className="flex items-center cursor-pointer select-none"
                          onClick={() => handleSort("customer_name")}
                        >
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
                        <div
                          className="flex items-center cursor-pointer select-none"
                          onClick={() => handleSort("gas_type")}
                        >
                          Product<SortIcon column="gas_type" />
                        </div>
                        <Input
                          placeholder="Filter..."
                          value={productFilter}
                          onChange={(e) => setProductFilter(e.target.value)}
                          className="h-7 text-xs bg-background w-full"
                        />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("cylinder_count")}
                    >
                      <div className="flex items-center">
                        Aantal<SortIcon column="cylinder_count" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("cylinder_size")}
                    >
                      <div className="flex items-center">
                        Capaciteit<SortIcon column="cylinder_size" />
                      </div>
                    </TableHead>
                    <TableHead
                      className="cursor-pointer hover:bg-muted/50 select-none"
                      onClick={() => handleSort("scheduled_date")}
                    >
                      <div className="flex items-center">
                        Datum<SortIcon column="scheduled_date" />
                      </div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedOrders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.customer_name}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: getGasColor(order.gas_type, "#6b7280") }}
                          />
                          {order.gas_type}
                        </div>
                      </TableCell>
                      <TableCell>{order.cylinder_count}</TableCell>
                      <TableCell>
                        {order.cylinder_size > 0 ? `${order.cylinder_size} L` : "–"}
                      </TableCell>
                      <TableCell>
                        {format(new Date(order.scheduled_date), "dd-MM-yyyy")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats sidebar */}
      <div className="space-y-6">
        <Card className="glass-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Cylinder className="h-5 w-5" />
              Samenvatting
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <span className="text-muted-foreground text-xs">Regels</span>
                <p className="font-medium text-lg">{filteredOrders.length}</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <span className="text-muted-foreground text-xs">Cilinders</span>
                <p className="font-medium text-lg">{formatNumber(totalCylinderCount)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Cylinder className="h-5 w-5 text-orange-500" />
            Gascilinders Vulling
          </h2>
          <div className="flex flex-wrap items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground">{periodLabel}</p>
            <Badge variant="secondary" className="text-xs">
              {formatNumber(filteredOrders.length)} regels
            </Badge>
            <Badge variant="outline" className="text-xs">
              {formatNumber(totalCylinderCount)} cilinders
            </Badge>
          </div>
        </div>
      </div>

      {showLocationTabs ? (
        <Tabs
          value={locationTab}
          onValueChange={(v) => setLocationTab(v as LocationTab)}
          className="w-full"
        >
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
            {renderOrderContent()}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="mt-6">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              {locationTab === "sol_emmen" ? "SOL Emmen" : "SOL Tilburg"}
            </span>
            <Badge variant="secondary" className="text-xs">
              {filteredOrders.length} regels
            </Badge>
          </div>
          {renderOrderContent()}
        </div>
      )}
    </div>
  );
}
