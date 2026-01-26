import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Snowflake, Plus, Repeat, CheckCircle2 } from "lucide-react";
import { format, addWeeks, addYears } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CustomerSelect } from "./CustomerSelect";

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
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [productTypeId, setProductTypeId] = useState("");
  const [packagingId, setPackagingId] = useState("");
  const [boxCount, setBoxCount] = useState("");
  const [containerHasWheels, setContainerHasWheels] = useState<boolean | null>(null);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
  const [isRecurring, setIsRecurring] = useState(false);
  const [isInfiniteRecurrence, setIsInfiniteRecurrence] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>(undefined);
  const [notes, setNotes] = useState("");
  const [alreadyCompleted, setAlreadyCompleted] = useState(true);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  
  const [productTypes, setProductTypes] = useState<{ id: string; name: string }[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<{ id: string; name: string }[]>([]);
  
  // Check if selected packaging is EPS type or Kunststof container
  const selectedPackaging = packagingOptions.find(p => p.id === packagingId);
  const isEpsPackaging = selectedPackaging?.name.toLowerCase().includes("eps");
  const isKunststofContainer = selectedPackaging?.name.toLowerCase().includes("kunststof");

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        
        if (profile) {
          setCurrentProfileId(profile.id);
        }
      }
    };
    fetchProfile();
    fetchProductTypes();
    fetchPackaging();
  }, []);

  const fetchProductTypes = async () => {
    const { data } = await supabase
      .from("dry_ice_product_types")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order");
    if (data && data.length > 0) {
      setProductTypes(data);
      setProductTypeId(data[0].id);
    }
  };

  const fetchPackaging = async () => {
    const { data } = await supabase
      .from("dry_ice_packaging")
      .select("id, name")
      .eq("is_active", true)
      .order("sort_order");
    if (data) {
      setPackagingOptions(data);
    }
  };

  const resetForm = () => {
    setCustomerId("");
    setCustomerName("");
    setQuantityKg("");
    if (productTypes.length > 0) {
      setProductTypeId(productTypes[0].id);
    }
    setPackagingId("");
    setBoxCount("");
    setContainerHasWheels(null);
    setScheduledDate(new Date());
    setIsRecurring(false);
    setIsInfiniteRecurrence(false);
    setRecurrenceEndDate(undefined);
    setNotes("");
    setAlreadyCompleted(true);
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
    
    if (!quantityKg) {
      toast.error("Vul de hoeveelheid in");
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

    const quantity = parseFloat(quantityKg);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Voer een geldige hoeveelheid in");
      return;
    }

    setSaving(true);

    try {
      // Generate dates for recurring orders
      const orderDates: Date[] = [scheduledDate];
      
      if (isRecurring) {
        // For infinite recurrence, create orders for 1 year ahead
        const endDate = isInfiniteRecurrence 
          ? addYears(scheduledDate, 1)
          : recurrenceEndDate;
        
        if (endDate) {
          let nextDate = addWeeks(scheduledDate, 1);
          while (nextDate <= endDate) {
            orderDates.push(nextDate);
            nextDate = addWeeks(nextDate, 1);
          }
        }
      }

      // Create the first order
      const baseOrderData = {
        customer_name: customerName.trim(),
        customer_id: customerId || null,
        quantity_kg: quantity,
        product_type: "blocks" as "blocks" | "pellets" | "sticks",
        product_type_id: productTypeId,
        packaging_id: packagingId || null,
        box_count: isEpsPackaging && boxCount ? parseInt(boxCount, 10) : null,
        container_has_wheels: isKunststofContainer ? containerHasWheels : null,
        notes: notes.trim() || null,
        created_by: currentProfileId,
        is_recurring: isRecurring,
        recurrence_end_date: isRecurring && !isInfiniteRecurrence && recurrenceEndDate 
          ? format(recurrenceEndDate, "yyyy-MM-dd") 
          : null,
        status: alreadyCompleted ? "completed" as const : "pending" as const,
      };

      // Insert all orders
      const ordersToInsert = orderDates.map((date, index) => ({
        ...baseOrderData,
        order_number: generateOrderNumber() + (index > 0 ? `-${index}` : ""),
        scheduled_date: format(date, "yyyy-MM-dd"),
      }));

      const { error } = await supabase.from("dry_ice_orders").insert(ordersToInsert);

      if (error) throw error;

      const orderCount = ordersToInsert.length;
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <Snowflake className="h-5 w-5 text-cyan-500" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">Nieuwe droogijs order</DialogTitle>
              <DialogDescription>
                Maak een nieuwe productieorder voor droogijs
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>
              Klant <span className="text-destructive">*</span>
            </Label>
            <CustomerSelect
              value={customerId}
              onValueChange={(id, name) => {
                setCustomerId(id);
                setCustomerName(name);
              }}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="quantityKg">
                Hoeveelheid (kg) <span className="text-destructive">*</span>
              </Label>
              <Input
                id="quantityKg"
                type="number"
                min="0"
                step="0.1"
                value={quantityKg}
                onChange={(e) => setQuantityKg(e.target.value)}
                placeholder="0"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label>Producttype <span className="text-destructive">*</span></Label>
              <Select value={productTypeId} onValueChange={setProductTypeId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecteer type" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {productTypes.map((pt) => (
                    <SelectItem key={pt.id} value={pt.id}>
                      {pt.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Verpakking</Label>
              <Select value={packagingId} onValueChange={(value) => {
                setPackagingId(value);
                const newPackaging = packagingOptions.find(p => p.id === value);
                // Reset box count when changing packaging
                if (!newPackaging?.name.toLowerCase().includes("eps")) {
                  setBoxCount("");
                }
                // Reset wheels option when not kunststof
                if (!newPackaging?.name.toLowerCase().includes("kunststof")) {
                  setContainerHasWheels(null);
                }
              }}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecteer verpakking (optioneel)" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {packagingOptions.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      {pkg.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isEpsPackaging && (
              <div className="space-y-2">
                <Label htmlFor="boxCount">
                  Aantal dozen <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="boxCount"
                  type="number"
                  min="1"
                  step="1"
                  value={boxCount}
                  onChange={(e) => setBoxCount(e.target.value)}
                  placeholder="0"
                  className="bg-background"
                />
              </div>
            )}
          </div>

          {isKunststofContainer && (
            <div className="space-y-2">
              <Label>
                Type container <span className="text-destructive">*</span>
              </Label>
              <RadioGroup
                value={containerHasWheels === null ? "" : containerHasWheels ? "with-wheels" : "without-wheels"}
                onValueChange={(value) => setContainerHasWheels(value === "with-wheels")}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="with-wheels" id="with-wheels" />
                  <Label htmlFor="with-wheels" className="font-normal cursor-pointer">Met wielen</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="without-wheels" id="without-wheels" />
                  <Label htmlFor="without-wheels" className="font-normal cursor-pointer">Zonder wielen</Label>
                </div>
              </RadioGroup>
            </div>
          )}

          <div className="space-y-2">
            <Label>
              Geplande datum <span className="text-destructive">*</span>
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !scheduledDate && "text-muted-foreground"
                  )}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {scheduledDate
                    ? format(scheduledDate, "d MMM yyyy", { locale: nl })
                    : "Selecteer datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-auto p-0 bg-background border shadow-lg z-50"
                align="start"
              >
                <Calendar
                  mode="single"
                  selected={scheduledDate}
                  onSelect={setScheduledDate}
                  locale={nl}
                  initialFocus
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Weekly recurrence option */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="isRecurring" 
                checked={isRecurring}
                onCheckedChange={(checked) => {
                  setIsRecurring(checked === true);
                  if (!checked) {
                    setRecurrenceEndDate(undefined);
                  }
                }}
              />
              <Label htmlFor="isRecurring" className="flex items-center gap-2 cursor-pointer font-normal">
                <Repeat className="h-4 w-4" />
                Wekelijks herhalen op dezelfde dag
              </Label>
            </div>
            
            {isRecurring && (
              <div className="space-y-3 pl-6">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="isInfinite" 
                    checked={isInfiniteRecurrence}
                    onCheckedChange={(checked) => {
                      setIsInfiniteRecurrence(checked === true);
                      if (checked) {
                        setRecurrenceEndDate(undefined);
                      }
                    }}
                  />
                  <Label htmlFor="isInfinite" className="cursor-pointer font-normal text-sm">
                    Oneindig herhalen (1 jaar vooruit aanmaken)
                  </Label>
                </div>
                
                {!isInfiniteRecurrence && (
                  <div className="space-y-2">
                    <Label>
                      Herhalen tot <span className="text-destructive">*</span>
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !recurrenceEndDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {recurrenceEndDate
                            ? format(recurrenceEndDate, "d MMM yyyy", { locale: nl })
                            : "Selecteer einddatum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-auto p-0 bg-background border shadow-lg z-50"
                        align="start"
                      >
                        <Calendar
                          mode="single"
                          selected={recurrenceEndDate}
                          onSelect={setRecurrenceEndDate}
                          locale={nl}
                          disabled={(date) => scheduledDate ? date <= scheduledDate : false}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
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

          {/* Already completed checkbox */}
          <div className="flex items-center space-x-2 p-3 rounded-lg border bg-muted/30">
            <Checkbox 
              id="alreadyCompleted" 
              checked={alreadyCompleted}
              onCheckedChange={(checked) => setAlreadyCompleted(checked === true)}
            />
            <Label htmlFor="alreadyCompleted" className="flex items-center gap-2 cursor-pointer font-normal">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              Reeds uitgevoerd
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notities</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionele notities..."
              className="bg-background resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Annuleren
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !customerId || !quantityKg || !scheduledDate || !productTypeId || (isEpsPackaging && !boxCount) || (isKunststofContainer && containerHasWheels === null) || (isRecurring && !isInfiniteRecurrence && !recurrenceEndDate)}
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Aanmaken..." : isRecurring ? "Orders aanmaken" : "Order aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
