import { useState, useEffect, useCallback, useMemo } from "react";
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
import { DateQuickPick } from "./DateQuickPick";
import { format, isToday } from "date-fns";
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
  const [cylinderCount, setCylinderCount] = useState(16);
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
    category_id: string | null;
    category_name: string | null;
  }>>([]);
  
  const [cylinderSizes, setCylinderSizes] = useState<Array<{
    id: string;
    name: string;
    capacity_liters: number | null;
  }>>([]);
  
  const [showDetails, setShowDetails] = useState(false);
  const [gasSearch, setGasSearch] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const fetchProfileAndPermissions = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const profile = await api.profiles.getByUserId(user.id);
        if (profile) {
          setCurrentProfileId(profile.id);
          const roleData = await api.userRoles.get(user.id);
          const userRole = roleData?.role || "user";
          const adminFlag = userRole === "admin";
          setIsAdmin(adminFlag);

          if (profile.production_location && !adminFlag) {
            setUserProductionLocation(profile.production_location);
            setLocation(profile.production_location);
            setCanSelectLocation(false);
          } else if (profile.production_location) {
            setLocation(profile.production_location);
            setCanSelectLocation(true);
          } else {
            setCanSelectLocation(adminFlag);
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
        const gasTypesData = await api.gasTypes.getAllWithCategory();
        if (gasTypesData) {
          const mapped = gasTypesData.map((t: any) => ({
            ...t,
            category_name: t.gas_type_categories?.name || null,
          }));
          const sortedTypes = [...mapped].sort((a: any, b: any) => a.name.localeCompare(b.name));
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


  const resetForm = () => {
    setCustomerId("");
    setCustomerName("");
    setGasTypeId(gasTypes.length > 0 ? gasTypes[0].id : "");
    setGasGrade("technical");
    setCylinderCount(16);
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
      if (gasSearch) {
        return type.name.toLowerCase().includes(gasSearch.toLowerCase());
      }
      return true;
    });

  // Group filtered gas types by category
  const groupedGasTypes = useMemo(() => {
    const groups: Array<{ categoryName: string; types: typeof filteredGasTypes }> = [];
    const categoryMap = new Map<string, typeof filteredGasTypes>();

    for (const type of filteredGasTypes) {
      const cat = type.category_name || "Overig";
      if (!categoryMap.has(cat)) categoryMap.set(cat, []);
      categoryMap.get(cat)!.push(type);
    }

    for (const [name, types] of categoryMap) {
      groups.push({ categoryName: name, types });
    }

    return groups;
  }, [filteredGasTypes]);

  const selectedGas = gasTypes.find(t => t.id === gasTypeId);

  // Quick count buttons
  const quickCounts = [64, 60, 40, 32, 16, 12, 10];

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose} handleOnly>
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
              location={location}
            />
          </div>

          {/* === GASTYPE — chip selector === */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-center">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Gastype</Label>
            </div>
            <div className="max-h-[180px] overflow-y-auto rounded-md border p-2 bg-muted/20 space-y-2">
              {groupedGasTypes.map((group) => (
                <div key={group.categoryName}>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-0.5">{group.categoryName}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {group.types.map((type) => (
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
                        <span>{type.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
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
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                min="1"
                value={cylinderCount}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  if (raw === '') {
                    setCylinderCount(0);
                    return;
                  }
                  const val = parseInt(raw);
                  if (!isNaN(val) && val > 0) setCylinderCount(val);
                }}
                onBlur={() => { if (cylinderCount < 1) setCylinderCount(1); }}
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
            <div className="flex flex-wrap gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
              {quickCounts.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { haptic("light"); setCylinderCount(n); }}
                  className={cn(
                    "h-8 min-w-[2.25rem] rounded-md px-2 text-sm font-medium transition-all shrink-0",
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


          {/* === DATUM (alleen admin) === */}
          {isAdmin && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Geplande datum</Label>
              <div className="flex items-center gap-2">
                <DateQuickPick value={scheduledDate} onChange={setScheduledDate} />
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9 shrink-0">
                      <CalendarDays className="h-4 w-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="end">
                    <Calendar
                      mode="single"
                      selected={scheduledDate}
                      onSelect={(d) => d && setScheduledDate(d)}
                      locale={nl}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              {scheduledDate && !isToday(scheduledDate) && (
                <p className="text-xs text-muted-foreground">
                  {format(scheduledDate, "EEEE d MMMM yyyy", { locale: nl })}
                </p>
              )}
            </div>
          )}

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
