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
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Minus, Plus, ChevronDown, ChevronUp, Repeat } from "lucide-react";
import { DateQuickPick } from "./DateQuickPick";
import { format, addWeeks, addYears } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CustomerSelect } from "./CustomerSelect";
import { useIsMobile } from "@/hooks/use-mobile";

interface CreateDryIceOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export function CreateDryIceOrderDialog({
  open,
  onOpenChange,
  onCreated,
}: CreateDryIceOrderDialogProps) {
  const isMobile = useIsMobile();
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quantityKg, setQuantityKg] = useState(10);
  const [productTypeId, setProductTypeId] = useState("");
  const [packagingId, setPackagingId] = useState("");
  const [boxCount, setBoxCount] = useState(1);
  const [containerHasWheels, setContainerHasWheels] = useState<boolean | null>(null);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<1 | 2>(1);
  const [isInfiniteRecurrence, setIsInfiniteRecurrence] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [alreadyCompleted, setAlreadyCompleted] = useState(true);
  const [location, setLocation] = useState<"sol_emmen" | "sol_tilburg">("sol_emmen");
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [userProductionLocation, setUserProductionLocation] = useState<"sol_emmen" | "sol_tilburg" | null>(null);
  const [canSelectLocation, setCanSelectLocation] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  const [productTypes, setProductTypes] = useState<{ id: string; name: string }[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<{ id: string; name: string }[]>([]);

  const selectedPackaging = packagingOptions.find(p => p.id === packagingId);
  const isEpsPackaging = selectedPackaging?.name.toLowerCase().includes("eps");
  const isKunststofContainer = selectedPackaging?.name.toLowerCase().includes("kunststof");

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
    fetchProductTypes();
    fetchPackaging();
  }, []);

  const fetchProductTypes = async () => {
    const data = await api.dryIceProductTypes.getAll();
    const defaultSetting = await api.appSettings.getByKey("dry_ice_default_product_type_id");

    if (data && data.length > 0) {
      setProductTypes(data);
      if (defaultSetting?.value && data.find(pt => pt.id === defaultSetting.value)) {
        setProductTypeId(defaultSetting.value);
      } else {
        const defaultType = data.find(pt => pt.name.toLowerCase().includes("9mm"));
        setProductTypeId(defaultType?.id || data[0].id);
      }
    }
  };

  const fetchPackaging = async () => {
    const data = await api.dryIcePackaging.getAll();
    if (data) {
      setPackagingOptions(data);
    }
  };

  const resetForm = async () => {
    setCustomerId("");
    setCustomerName("");
    setQuantityKg(10);

    const defaultSetting = await api.appSettings.getByKey("dry_ice_default_product_type_id");
    if (productTypes.length > 0) {
      if (defaultSetting?.value && productTypes.find(pt => pt.id === defaultSetting.value)) {
        setProductTypeId(defaultSetting.value);
      } else {
        const defaultType = productTypes.find(pt => pt.name.toLowerCase().includes("9mm"));
        setProductTypeId(defaultType?.id || productTypes[0].id);
      }
    }
    setPackagingId("");
    setBoxCount(1);
    setContainerHasWheels(null);
    setScheduledDate(new Date());
    setIsRecurring(false);
    setRecurrenceInterval(1);
    setIsInfiniteRecurrence(false);
    setRecurrenceEndDate(undefined);
    setNotes("");
    setAlreadyCompleted(true);
    setShowDetails(false);
    if (userProductionLocation) {
      setLocation(userProductionLocation);
    }
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const generateOrderNumber = () => {
    const date = format(new Date(), "yyyyMMdd");
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, "0");
    return `DI-${date}-${random}`;
  };

  const handleCreate = async () => {
    if (!currentProfileId) {
      toast.error("Kon je gebruikersprofiel niet vinden. Probeer opnieuw in te loggen.");
      return;
    }
    if (!customerName.trim()) {
      toast.error("Selecteer een klant");
      return;
    }
    if (!quantityKg || quantityKg <= 0) {
      toast.error("Vul een geldige hoeveelheid in");
      return;
    }
    if (!scheduledDate) {
      toast.error("Selecteer een datum");
      return;
    }
    if (!productTypeId) {
      toast.error("Selecteer een producttype");
      return;
    }
    if (isRecurring && !isInfiniteRecurrence && !recurrenceEndDate) {
      toast.error("Selecteer een einddatum voor de herhaling");
      return;
    }

    setSaving(true);

    try {
      const orderDates: Date[] = [scheduledDate];

      if (isRecurring) {
        const endDate = isInfiniteRecurrence
          ? addYears(scheduledDate, 1)
          : recurrenceEndDate;

        if (endDate) {
          let nextDate = addWeeks(scheduledDate, recurrenceInterval);
          while (nextDate <= endDate) {
            orderDates.push(nextDate);
            nextDate = addWeeks(nextDate, recurrenceInterval);
          }
        }
      }

      const baseOrderData = {
        customer_name: customerName.trim(),
        customer_id: customerId || null,
        quantity_kg: quantityKg,
        product_type: "blocks" as "blocks" | "pellets" | "sticks",
        product_type_id: productTypeId,
        packaging_id: packagingId || null,
        box_count: isEpsPackaging ? boxCount : null,
        container_has_wheels: isKunststofContainer ? containerHasWheels : null,
        notes: notes.trim() || null,
        created_by: currentProfileId,
        is_recurring: isRecurring,
        recurrence_end_date: isRecurring && !isInfiniteRecurrence && recurrenceEndDate
          ? format(recurrenceEndDate, "yyyy-MM-dd")
          : null,
        status: alreadyCompleted ? "completed" as const : "pending" as const,
        location: location,
      };

      const parentDate = orderDates[0];
      const parentOrderNumber = generateOrderNumber();

      const parentOrderData = {
        ...baseOrderData,
        order_number: parentOrderNumber,
        scheduled_date: format(parentDate, "yyyy-MM-dd"),
        parent_order_id: null
      };

      const parentOrder = await api.dryIceOrders.create(parentOrderData);
      if (!parentOrder) throw new Error("Failed to create parent order");

      if (orderDates.length > 1) {
        const childOrders = orderDates.slice(1).map((date, index) => ({
          ...baseOrderData,
          order_number: `${parentOrderNumber}-${index + 1}`,
          scheduled_date: format(date, "yyyy-MM-dd"),
          parent_order_id: parentOrder.id
        }));

        for (const child of childOrders) {
          await api.dryIceOrders.create(child);
        }
      }

      const orderCount = orderDates.length;
      toast.success(
        orderCount > 1
          ? `${orderCount} productieorders aangemaakt`
          : "Productieorder aangemaakt"
      );
      resetForm();
      onCreated();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating order:", error);
      toast.error("Fout bij aanmaken order");
    } finally {
      setSaving(false);
    }
  };

  const quickQuantities = [5, 10, 15, 20, 25, 30, 50, 100];
  const selectedProductType = productTypes.find(pt => pt.id === productTypeId);

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent className="sm:max-w-[520px]">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="text-lg font-semibold">Nieuwe droogijs order</ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="sr-only">
            Maak een nieuwe productieorder voor droogijs
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
              location={location}
            />
          </div>

          {/* === HOEVEELHEID — stepper + quick select === */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Hoeveelheid (kg)</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full"
                onClick={() => { haptic("light"); setQuantityKg(Math.max(1, quantityKg - 5)); }}
                disabled={quantityKg <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <div className="relative flex-1">
                <Input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={quantityKg}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val) && val > 0) setQuantityKg(val);
                  }}
                  className="h-11 text-center text-lg font-semibold bg-background pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-medium">kg</span>
              </div>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-11 w-11 shrink-0 rounded-full"
                onClick={() => { haptic("light"); setQuantityKg(quantityKg + 5); }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex flex-wrap gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
              {quickQuantities.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => { haptic("light"); setQuantityKg(n); }}
                  className={cn(
                    "h-8 min-w-[2.75rem] rounded-md px-2 text-sm font-medium transition-all shrink-0",
                    "border focus:outline-none active:scale-95",
                    quantityKg === n
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          {/* === PRODUCTTYPE — chip selector === */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Producttype</Label>
            <div className="flex flex-wrap gap-1.5">
              {productTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => { haptic("light"); setProductTypeId(type.id); }}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-all",
                    "border focus:outline-none active:scale-95",
                    productTypeId === type.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {type.name}
                </button>
              ))}
            </div>
          </div>

          {/* === VERPAKKING — chip selector === */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Verpakking</Label>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => {
                  haptic("light");
                  setPackagingId("");
                  setBoxCount(1);
                  setContainerHasWheels(null);
                }}
                className={cn(
                  "rounded-md px-3 py-2 text-sm font-medium transition-all",
                  "border focus:outline-none active:scale-95",
                  !packagingId
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background text-foreground border-border hover:bg-accent"
                )}
              >
                Geen
              </button>
              {packagingOptions.map((pkg) => (
                <button
                  key={pkg.id}
                  type="button"
                  onClick={() => {
                    haptic("light");
                    setPackagingId(pkg.id);
                    if (!pkg.name.toLowerCase().includes("eps")) setBoxCount(1);
                    if (!pkg.name.toLowerCase().includes("kunststof")) setContainerHasWheels(null);
                  }}
                  className={cn(
                    "rounded-md px-3 py-2 text-sm font-medium transition-all",
                    "border focus:outline-none active:scale-95",
                    packagingId === pkg.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background text-foreground border-border hover:bg-accent"
                  )}
                >
                  {pkg.name}
                </button>
              ))}
            </div>
          </div>

          {/* === EPS: Aantal dozen === */}
          {isEpsPackaging && (
            <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Aantal dozen</Label>
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full"
                  onClick={() => { haptic("light"); setBoxCount(Math.max(1, boxCount - 1)); }}
                  disabled={boxCount <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min="1"
                  value={boxCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val > 0) setBoxCount(val);
                  }}
                  className="h-11 text-center text-lg font-semibold bg-background [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full"
                  onClick={() => { haptic("light"); setBoxCount(boxCount + 1); }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          {/* === Kunststof: container type === */}
          {isKunststofContainer && (
            <div className="space-y-1.5 animate-in slide-in-from-top-2 duration-200">
              <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Type container</Label>
              <div className="flex rounded-lg border overflow-hidden">
                <button
                  type="button"
                  onClick={() => { haptic("medium"); setContainerHasWheels(true); }}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-colors",
                    containerHasWheels === true
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-accent"
                  )}
                >
                  Met wielen
                </button>
                <button
                  type="button"
                  onClick={() => { haptic("medium"); setContainerHasWheels(false); }}
                  className={cn(
                    "flex-1 py-2.5 text-sm font-medium transition-colors border-l",
                    containerHasWheels === false
                      ? "bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:bg-accent"
                  )}
                >
                  Zonder wielen
                </button>
              </div>
            </div>
          )}

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
            <DateQuickPick value={scheduledDate} onChange={setScheduledDate} />
          </div>

          {/* === UITVOERSTATUS === */}
          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="alreadyCompleted" className="font-medium text-sm">Reeds uitgevoerd</Label>
              <p className="text-xs text-muted-foreground">Direct markeren als voltooid</p>
            </div>
            <Switch
              id="alreadyCompleted"
              checked={alreadyCompleted}
              onCheckedChange={setAlreadyCompleted}
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
            {(notes || isRecurring || (canSelectLocation && location !== (userProductionLocation || "sol_emmen"))) && (
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            )}
          </button>

          {showDetails && (
            <div className="space-y-3 animate-in slide-in-from-top-2 duration-200">
              {/* Recurrence */}
              <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="isRecurring"
                    checked={isRecurring}
                    onCheckedChange={(checked) => {
                      setIsRecurring(checked === true);
                      if (!checked) {
                        setRecurrenceEndDate(undefined);
                        setRecurrenceInterval(1);
                      }
                    }}
                  />
                  <Label htmlFor="isRecurring" className="flex items-center gap-2 cursor-pointer font-normal">
                    <Repeat className="h-4 w-4" />
                    Herhalen op dezelfde dag
                  </Label>
                </div>

                {isRecurring && (
                  <div className="space-y-3 pl-6">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Interval</Label>
                      <div className="flex rounded-lg border overflow-hidden">
                        <button
                          type="button"
                          onClick={() => { haptic("medium"); setRecurrenceInterval(1); }}
                          className={cn(
                            "flex-1 py-2.5 text-sm font-medium transition-colors",
                            recurrenceInterval === 1
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-foreground hover:bg-accent"
                          )}
                        >
                          Wekelijks
                        </button>
                        <button
                          type="button"
                          onClick={() => { haptic("medium"); setRecurrenceInterval(2); }}
                          className={cn(
                            "flex-1 py-2.5 text-sm font-medium transition-colors border-l",
                            recurrenceInterval === 2
                              ? "bg-primary text-primary-foreground"
                              : "bg-background text-foreground hover:bg-accent"
                          )}
                        >
                          2-wekelijks
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="isInfinite"
                        checked={isInfiniteRecurrence}
                        onCheckedChange={(checked) => {
                          setIsInfiniteRecurrence(checked === true);
                          if (checked) setRecurrenceEndDate(undefined);
                        }}
                      />
                      <Label htmlFor="isInfinite" className="cursor-pointer font-normal text-sm">
                        Oneindig (1 jaar vooruit)
                      </Label>
                    </div>

                    {!isInfiniteRecurrence && (
                      <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Herhalen tot</Label>
                        {isMobile ? (
                          <Input
                            type="date"
                            value={recurrenceEndDate ? format(recurrenceEndDate, "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setRecurrenceEndDate(val ? new Date(val + "T00:00:00") : undefined);
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
                                  !recurrenceEndDate && "text-muted-foreground"
                                )}
                              >
                                <CalendarDays className="mr-2 h-4 w-4" />
                                {recurrenceEndDate
                                  ? format(recurrenceEndDate, "d MMMM yyyy", { locale: nl })
                                  : "Selecteer einddatum"}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                              <Calendar
                                mode="single"
                                selected={recurrenceEndDate}
                                onSelect={setRecurrenceEndDate}
                                locale={nl}
                                disabled={(date) => scheduledDate ? date <= scheduledDate : false}
                                initialFocus
                                className="p-3 pointer-events-auto"
                              />
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>
                    )}

                    {scheduledDate && (isInfiniteRecurrence || recurrenceEndDate) && (
                      <p className="text-xs text-muted-foreground">
                        Dit maakt {isInfiniteRecurrence
                          ? "52"
                          : Math.floor((recurrenceEndDate!.getTime() - scheduledDate.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1} orders aan
                      </p>
                    )}
                  </div>
                )}
              </div>

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
            disabled={saving || !customerId || !quantityKg || !scheduledDate || !productTypeId || (isEpsPackaging && !boxCount) || (isKunststofContainer && containerHasWheels === null) || (isRecurring && !isInfiniteRecurrence && !recurrenceEndDate)}
            variant="dryice"
            className="h-12 sm:h-10 flex-[2] sm:flex-none font-semibold"
          >
            {saving ? "Aanmaken..." : `${quantityKg} kg ${selectedProductType?.name || "droogijs"} aanmaken`}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
