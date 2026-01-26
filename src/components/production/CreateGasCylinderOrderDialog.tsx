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
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Cylinder, Plus } from "lucide-react";
import { format } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
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
  const [saving, setSaving] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [gasType, setGasType] = useState("");
  const [gasGrade, setGasGrade] = useState<"medical" | "technical">("technical");
  const [cylinderCount, setCylinderCount] = useState("");
  const [cylinderSize, setCylinderSize] = useState("medium");
  const [pressure, setPressure] = useState<200 | 300>(200);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState("");
  const [isCompleted, setIsCompleted] = useState(true);
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [gasTypes, setGasTypes] = useState<Array<{
    id: string;
    name: string;
    color: string;
  }>>([]);
  const [cylinderSizes, setCylinderSizes] = useState<Array<{
    id: string;
    name: string;
    capacity_liters: number | null;
  }>>([]);

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

  useEffect(() => {
    const fetchGasTypes = async () => {
      const { data } = await supabase
        .from("gas_types")
        .select("id, name, color")
        .eq("is_active", true)
        .order("name");
      
      if (data) {
        setGasTypes(data);
        if (data.length > 0 && !gasType) {
          setGasType(data[0].name);
        }
      }
    };

    const fetchCylinderSizes = async () => {
      const { data } = await supabase
        .from("cylinder_sizes")
        .select("id, name, capacity_liters")
        .eq("is_active", true)
        .order("sort_order");
      
      if (data) {
        setCylinderSizes(data);
        if (data.length > 0) {
          setCylinderSize(data[0].name);
        }
      }
    };
    
    if (open) {
      fetchGasTypes();
      fetchCylinderSizes();
    }
  }, [open]);

  const resetForm = () => {
    setCustomerId("");
    setCustomerName("");
    setGasType(gasTypes.length > 0 ? gasTypes[0].name : "");
    setGasGrade("technical");
    setCylinderCount("");
    setCylinderSize(cylinderSizes.length > 0 ? cylinderSizes[0].name : "");
    setPressure(200);
    setScheduledDate(new Date());
    setNotes("");
    setIsCompleted(true);
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

  const handleCreate = async () => {
    if (!customerName.trim() || !cylinderCount || !scheduledDate || !currentProfileId) {
      toast.error("Vul alle verplichte velden in");
      return;
    }

    const count = parseInt(cylinderCount);
    if (isNaN(count) || count <= 0) {
      toast.error("Voer een geldig aantal in");
      return;
    }

    setSaving(true);

    try {
      const insertData = {
        order_number: generateOrderNumber(),
        customer_name: customerName.trim(),
        customer_id: customerId || null,
        gas_type: gasType as "co2" | "nitrogen" | "argon" | "acetylene" | "oxygen" | "helium" | "other",
        gas_grade: gasGrade,
        cylinder_count: count,
        cylinder_size: cylinderSize,
        pressure: pressure,
        scheduled_date: format(scheduledDate, "yyyy-MM-dd"),
        notes: notes.trim() || null,
        created_by: currentProfileId,
        status: isCompleted ? "completed" as const : "pending" as const,
      };
      
      const { error } = await supabase.from("gas_cylinder_orders").insert(insertData);

      toast.success("Vulorder aangemaakt");
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
            <div className="p-2 rounded-lg bg-orange-500/10">
              <Cylinder className="h-5 w-5 text-orange-500" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">Nieuwe gascilinder order</DialogTitle>
              <DialogDescription>
                Maak een nieuwe vulorder voor gascilinders
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
              <Label>Gastype</Label>
              <Select value={gasType} onValueChange={setGasType}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecteer gastype" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {gasTypes.map((type) => (
                    <SelectItem key={type.id} value={type.name}>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-2 h-2 rounded-full flex-shrink-0" 
                          style={{ backgroundColor: type.color }} 
                        />
                        {type.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Kwaliteit</Label>
              <Select value={gasGrade} onValueChange={(v) => setGasGrade(v as "medical" | "technical")}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="technical">Technisch</SelectItem>
                  <SelectItem value="medical">Medisch</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="cylinderCount">
                Aantal cilinders <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cylinderCount"
                type="number"
                min="1"
                value={cylinderCount}
                onChange={(e) => setCylinderCount(e.target.value)}
                placeholder="0"
                className="bg-background"
              />
            </div>

            <div className="space-y-2">
              <Label>Cilindergrootte</Label>
              <Select value={cylinderSize} onValueChange={setCylinderSize}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {cylinderSizes.map((size) => (
                    <SelectItem key={size.id} value={size.name}>
                      {size.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Druk</Label>
              <Select value={pressure.toString()} onValueChange={(v) => setPressure(parseInt(v) as 200 | 300)}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  <SelectItem value="200">200 bar</SelectItem>
                  <SelectItem value="300">300 bar</SelectItem>
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
                    ? format(scheduledDate, "d MMM", { locale: nl })
                    : "Datum"}
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

          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/30">
            <div className="space-y-0.5">
              <Label htmlFor="isCompleted" className="font-medium">Reeds uitgevoerd</Label>
              <p className="text-xs text-muted-foreground">
                Markeer deze order direct als voltooid
              </p>
            </div>
            <Switch
              id="isCompleted"
              checked={isCompleted}
              onCheckedChange={setIsCompleted}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={saving}>
            Annuleren
          </Button>
          <Button
            onClick={handleCreate}
            disabled={saving || !customerId || !cylinderCount || !scheduledDate}
            className="bg-orange-500 hover:bg-orange-600"
          >
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Aanmaken..." : "Order aanmaken"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
