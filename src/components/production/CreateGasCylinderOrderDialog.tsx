import { useState, useEffect, useCallback } from "react";
import { haptic } from "@/lib/haptic";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Minus, Plus, ChevronDown, ChevronUp, Search } from "lucide-react";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CustomerSelect } from "./CustomerSelect";

interface CreateGasCylinderOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateGasCylinderOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateGasCylinderOrderDialogProps) {
  const isMobile = useIsMobile();
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [gasTypeId, setGasTypeId] = useState("");
  const [gasGrade, setGasGrade] = useState<"medical" | "technical">("technical");
  const [cylinderCount, setCylinderCount] = useState(1);
  const [cylinderSize, setCylinderSize] = useState("medium");
  const [pressure, setPressure] = useState<200 | 300>(200);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState("");
  const [isCompleted, setIsCompleted] = useState(true);
  const [location, setLocation] = useState<"sol_emmen" | "sol_tilburg">("sol_emmen");
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [userProductionLocation, setUserProductionLocation] = useState<"sol_emmen" | "sol_tilburg" | null>(null);
  const [canSelectLocation, setCanSelectLocation] = useState(true);
  const [gasTypes, setGasTypes] = useState<Array<{
    id: string;
    name: string;
    color: string;
  }>>([]);
  const [showAllGases, setShowAllGases] = useState(false);
  const [cylinderSizes, setCylinderSizes] = useState<Array<{
    id: string;
    name: string;
    capacity_liters: number | null;
  }>>([]);
  const [locationGasIds, setLocationGasIds] = useState<Set<string>>(new Set());
  const [showDetails, setShowDetails] = useState(false);
  const [gasSearch, setGasSearch] = useState("");

  useEffect(() => {
    const fetchProfileAndPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const profile = await api.profiles.getByUserId(user.id);
        if (profile) {
          setCurrentProfileId(profile.id);
          const roleData = await api.userRoles.get(user.id);
          const userRole = roleData?.role || "user";
          const isAdmin = userRole === "admin";

          if (profile.production_location && !isAdmin) {
            setUserProductionLocation(profile.production_location);
            setLocation(profile.production_location);
            setCanSelectLocation(false);
          } else if (profile.production_location) {
            setLocation(profile.production_location);
            setCanSelectLocation(true);
          } else {
            setCanSelectLocation(isAdmin);
          }
        }
      }
    };
    fetchProfileAndPermissions();
  }, []);

  useEffect(() => {
    const fetchCylinderSizes = async () => {
      const data = await api.cylinderSizes.getAll();
      if (data) {
        setCylinderSizes(data);
        if (data.length > 0) {
          setCylinderSize(data[0].name);
        }
      }
    };

    if (open) {
      const loadData = async () => {
        const gasTypesData = await api.gasTypes.getAll();
        if (gasTypesData) {
          const sortedTypes = [...gasTypesData].sort((a, b) => a.name.localeCompare(b.name));
          setGasTypes(sortedTypes);
          if (sortedTypes.length > 0 && !gasTypeId) {
            setGasTypeId(sortedTypes[0].id);
          }
        }
      };
      loadData();
      fetchCylinderSizes();
    }
  }, [open]);

  // Auto-select medical quality when "Zuurstof Medicinaal" is selected
  useEffect(() => {
    const selectedGas = gasTypes.find(t => t.id === gasTypeId);
    if (selectedGas) {
      const name = selectedGas.name.toLowerCase();
      if (name.includes("zuurstof medicinaal") || name.includes("medisch")) {
        setGasGrade("medical");
      } else {
        setGasGrade("technical");
      }
      if (name.includes("300bar")) {
        setPressure(300);
      } else {
        setPressure(200);
      }
    }
  }, [gasTypeId, gasTypes]);

  // Fetch location-specific gas types
  useEffect(() => {
    const fetchLocationGasTypes = async () => {
      if (!location) return;
      const locationGasTypes = await api.gasTypes.getByLocation(location);
      if (locationGasTypes && locationGasTypes.length > 0) {
        const uniqueIds = new Set(locationGasTypes.map((row: { gas_type_id: string }) => row.gas_type_id).filter(Boolean)) as Set<string>;
        setLocationGasIds(uniqueIds);
      } else {
        setLocationGasIds(new Set(gasTypes.map(t => t.id)));
      }
    };
    if (open && gasTypes.length > 0) {
      fetchLocationGasTypes();
    }
  }, [location, open, gasTypes]);

  const resetForm = () => {
    setCustomerId("");
    setCustomerName("");
    setGasTypeId(gasTypes.length > 0 ? gasTypes[0].id : "");
    setGasGrade("technical");
    setCylinderCount(1);
    setCylinderSize(cylinderSizes.length > 0 ? cylinderSizes[0].name : "");
    setPressure(200);
    setScheduledDate(new Date());
    setNotes("");
    setIsCompleted(true);
    setShowDetails(false);
    setGasSearch("");
    if (userProductionLocation) {
      setLocation(userProductionLocation);
    } else {
      setLocation("sol_emmen");
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const generateOrderNumber = () => {
    const date = format(new Date(), "yyyyMMdd");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `GC-${date}-${random}`;
  };

  const getSelectedGasType = () => {
    return gasTypes.find(t => t.id === gasTypeId);
  };

  const mapGasTypeToEnum = (typeName: string): "co2" | "nitrogen" | "argon" | "acetylene" | "oxygen" | "helium" | "other" => {
    const mapping: Record<string, "co2" | "nitrogen" | "argon" | "acetylene" | "oxygen" | "helium" | "other"> = {
      "CO2": "co2", "co2": "co2",
      "Stikstof": "nitrogen", "stikstof": "nitrogen", "nitrogen": "nitrogen",
      "Argon": "argon", "argon": "argon",
      "Acetyleen": "acetylene", "acetyleen": "acetylene", "acetylene": "acetylene",
      "Zuurstof": "oxygen", "zuurstof": "oxygen", "oxygen": "oxygen",
      "Helium": "helium", "helium": "helium",
    };
    return mapping[typeName] || "other";
  };

  const handleCreate = async () => {
    if (!customerName.trim() || !cylinderCount || !scheduledDate || !currentProfileId) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    if (cylinderCount <= 0) {
      toast.error("Voer een geldig aantal in");
      return;
    }

    setSaving(true);

    try {
      const selectedGasType = getSelectedGasType();
      const mappedGasType = selectedGasType ? mapGasTypeToEnum(selectedGasType.name) : "other";

      let finalNotes = notes.trim();
      if (!finalNotes && cylinderSize) {
        const match = cylinderSize.match(/^(\d+)L$/i);
        if (match) {
          finalNotes = `${match[1]} liter cilinder`;
        } else {
          finalNotes = cylinderSize;
        }
      }

      const insertData = {
        order_number: generateOrderNumber(),
        customer_name: customerName.trim(),
        customer_id: customerId || null,
        gas_type: mappedGasType,
        gas_type_id: gasTypeId || null,
        gas_grade: gasGrade,
        cylinder_count: cylinderCount,
        cylinder_size: cylinderSize,
        pressure: pressure,
        scheduled_date: format(scheduledDate, "yyyy-MM-dd"),
        notes: finalNotes || null,
        created_by: currentProfileId,
        status: isCompleted ? "completed" as const : "pending" as const,
        location: location,
      };

      await api.gasCylinderOrders.create(insertData);

      toast.success("Vulorder aangemaakt");
      resetForm();
      onCreated();
      onOpenChange(false);
    } catch (error: any) {
      console.error("Error creating order:", error);
      toast.error("Fout bij aanmaken order: " + (error.message || "Onbekende fout"));
    } finally {
      setSaving(false);
    }
  };

  const filteredGasTypes = gasTypes
    .filter(type => {
      if (!showAllGases && !locationGasIds.has(type.id)) return false;
      if (gasSearch) {
        return type.name.toLowerCase().includes(gasSearch.toLowerCase());
      }
      return true;
    });

  const selectedGas = gasTypes.find(t => t.id === gasTypeId);

  // Quick count buttons
  const quickCounts = [1, 2, 3, 4, 5, 6, 10, 12];

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent className="sm:max-w-[520px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-lg font-semibold">Nieuwe vulorder</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            Maak een nieuwe vulorder voor gascilinders
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-2 px-4 sm:px-0">
          {/* === KLANT === */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Klant</Label>
            <CustomerSelect
              value={customerId}
              onValueChange={(id, name) => {
                setCustomerId(id);
                setCustomerName(name);
              }}
              defaultCustomerName="SOL"
            />
          </div>

          {/* === GASTYPE — chip selector === */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gastype</Label>
              <button
                onClick={() => setShowAllGases(!showAllGases)}
                className="text-xs text-primary hover:underline focus:outline-none"
                type="button"
              >
                {showAllGases ? "Locatie filter" : "Toon alles"}
              </button>
            </div>
            {/* Search for gas types */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={gasSearch}
                onChange={(e) => setGasSearch(e.target.value)}
                placeholder="Zoek gastype..."
                className="h-9 pl-8 text-sm bg-background"
              />
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-[140px] overflow-y-auto rounded-md border p-2 bg-muted/20">
              {filteredGasTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    haptic("light");
                    setGasTypeId(type.id);
                    setGasSearch("");
                  }}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
                    "border focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1",
                    "active:scale-95",
                    gasTypeId === type.id
                      ? "bg-foreground text-background border-foreground shadow-sm"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: type.color }}
                  />
                  <span className="truncate max-w-[120px]">{type.name}</span>
                </button>
              ))}
              {filteredGasTypes.length === 0 && (
                <p className="text-xs text-muted-foreground py-2 px-1">Geen gastypes gevonden</p>
              )}
            </div>
          </div>

          {/* === AANTAL — stepper + quick select === */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Aantal cilinders</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full"
                onClick={() => { haptic("light"); setCylinderCount(Math.max(1, cylinderCount - 1)); }}
                disabled={cylinderCount <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                min="1"
                value={cylinderCount}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val > 0) setCylinderCount(val);
                }}
                className="h-11 text-center text-lg font-semibold bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full"
                onClick={() => { haptic("light"); setCylinderCount(cylinderCount + 1); }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {/* Quick count chips */}
            <div className="flex flex-wrap gap-1.5">
              {quickCounts.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { haptic("light"); setCylinderCount(n); }}
                  className={cn(
                    "h-8 min-w-[2.25rem] rounded-md px-2 text-sm font-medium transition-all",
                    "border focus:outline-none active:scale-95",
                    cylinderCount === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* === CILINDERGROOTTE — pill selector === */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Cilindergrootte</Label>
            <div className="flex flex-wrap gap-1.5">
              {cylinderSizes.map((size) => (
                <button
                  key={size.id}
                  type="button"
                  onClick={() => { haptic("light"); setCylinderSize(size.name); }}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-all",
                    "border focus:outline-none active:scale-95",
                    cylinderSize === size.name
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {size.name}
                </button>
              ))}
            </div>
          </div>

          {/* === DRUK & KWALITEIT — inline toggles === */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Druk</Label>
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  onClick={() => { haptic("medium"); setPressure(200); }}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-colors",
                    pressure === 200
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-accent"
                  )}
                >
                  200 bar
                </button>
                <button
                  type="button"
                  onClick={() => { haptic("medium"); setPressure(300); }}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-colors border-l",
                    pressure === 300
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-accent"
                  )}
                >
                  300 bar
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Kwaliteit</Label>
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  onClick={() => { haptic("medium"); setGasGrade("technical"); }}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-colors",
                    gasGrade === "technical"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-accent"
                  )}
                >
                  Tech
                </button>
                <button
                  type="button"
                  onClick={() => { haptic("medium"); setGasGrade("medical"); }}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-colors border-l",
                    gasGrade === "medical"
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-accent"
                  )}
                >
                  Med
                </button>
              </div>
            </div>
          </div>

          {/* === DATUM === */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Datum</Label>
            {isMobile ? (
              <Input
                type="date"
                value={scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setScheduledDate(val ? new Date(val + "T00:00:00") : undefined);
                }}
                className="bg-background h-11"
              />
            ) : (
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      !scheduledDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {scheduledDate
                      ? format(scheduledDate, "d MMMM yyyy", { locale: nl })
                      : "Selecteer datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                  <Calendar
                    mode="single"
                    selected={scheduledDate}
                    onSelect={setScheduledDate}
                    locale={nl}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            )}
          </div>

          {/* === UITVOERSTATUS === */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="isCompleted" className="font-medium text-sm">Reeds uitgevoerd</Label>
              <p className="text-xs text-muted-foreground">Direct markeren als voltooid</p>
            </div>
            <Switch
              id="isCompleted"
              checked={isCompleted}
              onCheckedChange={setIsCompleted}
            />
          </div>

          {/* === MEER OPTIES (collapsible) === */}
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
          >
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            <span>Meer opties</span>
            {(notes || (canSelectLocation && location !== (userProductionLocation || "sol_emmen"))) && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </button>

          {showDetails && (
            <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
              {/* Location */}
              {canSelectLocation && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Locatie</Label>
                  <div className="flex rounded-lg border overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setLocation("sol_emmen")}
                      className={cn(
                        "flex-1 py-2.5 text-sm font-medium transition-colors",
                        location === "sol_emmen"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground hover:bg-accent"
                      )}
                    >
                      SOL Emmen
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocation("sol_tilburg")}
                      className={cn(
                        "flex-1 py-2.5 text-sm font-medium transition-colors border-l",
                        location === "sol_tilburg"
                          ? "bg-primary text-primary-foreground"
                          : "bg-background text-foreground hover:bg-accent"
                      )}
                    >
                      SOL Tilburg
                    </button>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notities</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optionele notities..."
                  className="bg-background resize-none min-h-[60px]"
                  rows={2}
                />
              </div>
            </div>
          )}
        </div>

        {/* === FOOTER === */}
        <div className="flex gap-2 pt-3 px-4 sm:px-0 pb-4">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={saving}
            className="h-12 sm:h-10 flex-1 sm:flex-none"
          >
            Annuleren
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !customerId || !cylinderCount || !scheduledDate}
            variant="accent"
            className="h-12 sm:h-10 flex-[2] sm:flex-none font-semibold"
          >
            {saving ? "Aanmaken..." : `${cylinderCount}× ${selectedGas?.name || "cilinder"} aanmaken`}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
