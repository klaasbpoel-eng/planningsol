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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Snowflake, Plus } from "lucide-react";
import { format } from "date-fns";
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
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState("");
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  
  const [productTypes, setProductTypes] = useState<{ id: string; name: string }[]>([]);
  const [packagingOptions, setPackagingOptions] = useState<{ id: string; name: string }[]>([]);

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
    setScheduledDate(new Date());
    setNotes("");
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
    if (!customerName.trim() || !quantityKg || !scheduledDate || !currentProfileId || !productTypeId) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    const quantity = parseFloat(quantityKg);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Voer een geldige hoeveelheid in");
      return;
    }

    setSaving(true);

    try {
      const insertData = {
        order_number: generateOrderNumber(),
        customer_name: customerName.trim(),
        customer_id: customerId || null,
        quantity_kg: quantity,
        product_type: "blocks" as "blocks" | "pellets" | "sticks", // Keep for backwards compat
        product_type_id: productTypeId,
        packaging_id: packagingId || null,
        scheduled_date: format(scheduledDate, "yyyy-MM-dd"),
        notes: notes.trim() || null,
        created_by: currentProfileId,
      };
      
      const { error } = await supabase.from("dry_ice_orders").insert(insertData);

      toast.success("Productieorder aangemaakt");
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

          <div className="space-y-2">
            <Label>Verpakking</Label>
            <Select value={packagingId} onValueChange={setPackagingId}>
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
            disabled={saving || !customerId || !quantityKg || !scheduledDate || !productTypeId}
            className="bg-cyan-500 hover:bg-cyan-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Aanmaken..." : "Order aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
