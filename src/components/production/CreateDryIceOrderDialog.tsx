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
  const [customerName, setCustomerName] = useState("");
  const [quantityKg, setQuantityKg] = useState("");
  const [productType, setProductType] = useState("blocks");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState("");
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("user_id", user.id)
          .single();
        
        if (profile) {
          setCurrentProfileId(profile.id);
        }
      }
    };
    fetchProfile();
  }, []);

  const resetForm = () => {
    setCustomerName("");
    setQuantityKg("");
    setProductType("blocks");
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
    if (!customerName.trim() || !quantityKg || !scheduledDate || !currentProfileId) {
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
        quantity_kg: quantity,
        product_type: productType as "blocks" | "pellets" | "sticks",
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
            <Label htmlFor="customerName">
              Klantnaam <span className="text-destructive">*</span>
            </Label>
            <Input
              id="customerName"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Voer klantnaam in"
              className="bg-background"
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
              <Label>Producttype</Label>
              <Select value={productType} onValueChange={setProductType}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="blocks">Blokken (10kg)</SelectItem>
                  <SelectItem value="pellets">Pellets (3mm)</SelectItem>
                  <SelectItem value="sticks">Sticks (16mm)</SelectItem>
                </SelectContent>
              </Select>
            </div>
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
            disabled={saving || !customerName.trim() || !quantityKg || !scheduledDate}
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
