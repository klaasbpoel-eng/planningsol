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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { CalendarDays, Ambulance, Plus, X, Repeat } from "lucide-react";
import { format, addDays, addWeeks, addYears } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CustomerRow {
  customer_number: string;
  customer_name: string;
}

interface CreateAmbulanceTripDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
  initialDate?: Date;
}

export function CreateAmbulanceTripDialog({
  open,
  onOpenChange,
  onCreate,
  initialDate,
}: CreateAmbulanceTripDialogProps) {
  const [saving, setSaving] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(initialDate || new Date());
  const [cylinders2l, setCylinders2l] = useState("");
  const [cylinders2l200, setCylinders2l200] = useState("");
  const [cylinders1lPindex, setCylinders1lPindex] = useState("");
  const [cylinders5l, setCylinders5l] = useState("");
  const [model5l, setModel5l] = useState<"any" | "high" | "low">("any");
  const [cylinders10l, setCylinders10l] = useState("");
  const [cylinders5lAir, setCylinders5lAir] = useState("");
  const [cylinders2lAir, setCylinders2lAir] = useState("");
  const [customers, setCustomers] = useState<CustomerRow[]>([{ customer_number: "", customer_name: "" }]);
  const [notes, setNotes] = useState("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceInterval, setRecurrenceInterval] = useState<"weekly" | "biweekly">("weekly");
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>();
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      fetchProfile();
    }
  }, [open]);

  useEffect(() => {
    if (initialDate) {
      setScheduledDate(initialDate);
    }
  }, [initialDate]);

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) setCurrentProfileId(profile.id);
    }
  };

  const resetForm = () => {
    setCylinders2l("");
    setCylinders2l200("");
    setCylinders1lPindex("");
    setCylinders5l("");
    setModel5l("any");
    setCylinders10l("");
    setCylinders5lAir("");
    setCylinders2lAir("");
    setCustomers([{ customer_number: "", customer_name: "" }]);
    setScheduledDate(initialDate || new Date());
    setNotes("");
    setIsRecurring(false);
    setRecurrenceInterval("weekly");
    setRecurrenceEndDate(undefined);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const addCustomerRow = () => {
    setCustomers(prev => [...prev, { customer_number: "", customer_name: "" }]);
  };

  const removeCustomerRow = (index: number) => {
    setCustomers(prev => prev.filter((_, i) => i !== index));
  };

  const updateCustomer = (index: number, field: keyof CustomerRow, value: string) => {
    setCustomers(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleCreate = async () => {
    if (!currentProfileId) {
      toast.error("Kon je gebruikersprofiel niet vinden.");
      return;
    }
    if (!scheduledDate) {
      toast.error("Selecteer een datum");
      return;
    }

    const qty2l = parseInt(cylinders2l) || 0;
    const qty2l200 = parseInt(cylinders2l200) || 0;
    const qty1lPindex = parseInt(cylinders1lPindex) || 0;
    const qty5l = parseInt(cylinders5l) || 0;
    const qty10l = parseInt(cylinders10l) || 0;
    const qty5lAir = parseInt(cylinders5lAir) || 0;
    const qty2lAir = parseInt(cylinders2lAir) || 0;

    if (qty2l === 0 && qty2l200 === 0 && qty1lPindex === 0 && qty5l === 0 && qty10l === 0 && qty5lAir === 0 && qty2lAir === 0) {
      toast.error("Vul minstens één cilindertype in");
      return;
    }

    setSaving(true);
    try {
      // Generate dates (single or recurring)
      const dates: Date[] = [scheduledDate];
      if (isRecurring) {
        const endDate = recurrenceEndDate || addYears(scheduledDate, 1);
        const step = recurrenceInterval === "weekly" ? 1 : 2;
        let next = addWeeks(scheduledDate, step);
        while (next <= endDate) {
          dates.push(next);
          next = addWeeks(next, step);
        }
      }

      const validCustomers = customers.filter(c => c.customer_number.trim() || c.customer_name.trim());

      for (const date of dates) {
        const { data: trip, error: tripError } = await supabase
          .from("ambulance_trips" as any)
          .insert({
            scheduled_date: format(date, "yyyy-MM-dd"),
            cylinders_2l_300_o2: qty2l,
            cylinders_2l_200_o2: qty2l200,
            cylinders_1l_pindex_o2: qty1lPindex,
            cylinders_5l_o2_integrated: qty5l,
            model_5l: model5l,
            cylinders_10l_o2_integrated: qty10l,
            cylinders_5l_air_integrated: qty5lAir,
            cylinders_2l_air_integrated: qty2lAir,
            created_by: currentProfileId,
            notes: notes.trim() || null,
          })
          .select()
          .single();

        if (tripError) throw tripError;

        if (validCustomers.length > 0 && trip) {
          const { error: custError } = await supabase
            .from("ambulance_trip_customers" as any)
            .insert(
              validCustomers.map(c => ({
                trip_id: (trip as any).id,
                customer_number: c.customer_number.trim(),
                customer_name: c.customer_name.trim(),
              }))
            );
          if (custError) throw custError;
        }
      }

      toast.success(dates.length > 1 ? `${dates.length} ambulance ritten ingepland` : "Ambulance rit ingepland");
      resetForm();
      onCreate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating ambulance trip:", error);
      toast.error("Fout bij aanmaken ambulance rit");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Ambulance className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">Nieuwe ambulance rit</DialogTitle>
              <DialogDescription>
                Plan een ambulance rit in met cilinders en klanten
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Date */}
          <div className="space-y-2">
            <Label>Geplande datum <span className="text-destructive">*</span></Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn("w-full justify-start text-left font-normal", !scheduledDate && "text-muted-foreground")}
                >
                  <CalendarDays className="mr-2 h-4 w-4" />
                  {scheduledDate ? format(scheduledDate, "d MMM yyyy", { locale: nl }) : "Selecteer datum"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} locale={nl} initialFocus className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          </div>

          {/* Cylinder counts */}
          <div className="space-y-3">
            <Label className="text-sm font-semibold">Zuurstof (O2)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cyl2l" className="text-xs text-muted-foreground">2L 300 O2</Label>
                <Input id="cyl2l" type="number" min="0" value={cylinders2l} onChange={(e) => setCylinders2l(e.target.value)} placeholder="0" className="bg-background" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cyl2l200" className="text-xs text-muted-foreground">2L 200 O2</Label>
                <Input id="cyl2l200" type="number" min="0" value={cylinders2l200} onChange={(e) => setCylinders2l200(e.target.value)} placeholder="0" className="bg-background" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cyl1l" className="text-xs text-muted-foreground">1L Pindex O2</Label>
                <Input id="cyl1l" type="number" min="0" value={cylinders1lPindex} onChange={(e) => setCylinders1lPindex(e.target.value)} placeholder="0" className="bg-background" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cyl5l" className="text-xs text-muted-foreground">5L O2 Geïntegreerd</Label>
                <Input id="cyl5l" type="number" min="0" value={cylinders5l} onChange={(e) => setCylinders5l(e.target.value)} placeholder="0" className="bg-background" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cyl10l" className="text-xs text-muted-foreground">10L O2 Geïntegreerd</Label>
                <Input id="cyl10l" type="number" min="0" value={cylinders10l} onChange={(e) => setCylinders10l(e.target.value)} placeholder="0" className="bg-background" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">5L model voorkeur</Label>
              <Select value={model5l} onValueChange={(v) => setModel5l(v as "any" | "high" | "low")}>
                <SelectTrigger className="bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Maakt niet uit</SelectItem>
                  <SelectItem value="high">Hoog model</SelectItem>
                  <SelectItem value="low">Laag model</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-semibold">Lucht</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="cyl5lair" className="text-xs text-muted-foreground">5L Geïntegreerd</Label>
                <Input id="cyl5lair" type="number" min="0" value={cylinders5lAir} onChange={(e) => setCylinders5lAir(e.target.value)} placeholder="0" className="bg-background" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cyl2lair" className="text-xs text-muted-foreground">2L Geïntegreerd</Label>
                <Input id="cyl2lair" type="number" min="0" value={cylinders2lAir} onChange={(e) => setCylinders2lAir(e.target.value)} placeholder="0" className="bg-background" />
              </div>
            </div>
          </div>

          {/* Customer list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Klantenlijst (voor scansysteem)</Label>
              <Button type="button" variant="ghost" size="sm" onClick={addCustomerRow} className="h-7 text-xs">
                <Plus className="h-3 w-3 mr-1" />
                Klant toevoegen
              </Button>
            </div>
            <div className="space-y-2">
              {customers.map((customer, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    placeholder="Klantnummer"
                    value={customer.customer_number}
                    onChange={(e) => updateCustomer(index, "customer_number", e.target.value)}
                    className="bg-background flex-1"
                  />
                  <Input
                    placeholder="Klantnaam"
                    value={customer.customer_name}
                    onChange={(e) => updateCustomer(index, "customer_name", e.target.value)}
                    className="bg-background flex-1"
                  />
                  {customers.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomerRow(index)} className="h-8 w-8 shrink-0">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recurrence */}
          <div className="space-y-3 p-3 rounded-lg border bg-muted/20">
            <div className="flex items-center gap-2">
              <Checkbox id="recurring" checked={isRecurring} onCheckedChange={checked => setIsRecurring(checked as boolean)} />
              <label htmlFor="recurring" className="text-sm font-medium cursor-pointer flex items-center gap-1.5">
                <Repeat className="h-3.5 w-3.5" />
                Herhalen
              </label>
            </div>
            {isRecurring && (
              <div className="space-y-3 pl-6">
                <div className="space-y-1">
                  <Label className="text-xs">Interval</Label>
                  <Select value={recurrenceInterval} onValueChange={(v) => setRecurrenceInterval(v as "weekly" | "biweekly")}>
                    <SelectTrigger className="bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="weekly">Wekelijks</SelectItem>
                      <SelectItem value="biweekly">Om de week</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Einddatum (optioneel, anders 1 jaar)</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal text-sm", !recurrenceEndDate && "text-muted-foreground")}>
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {recurrenceEndDate ? format(recurrenceEndDate, "d MMM yyyy", { locale: nl }) : "Geen einddatum (1 jaar)"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                      <Calendar mode="single" selected={recurrenceEndDate} onSelect={setRecurrenceEndDate} locale={nl} initialFocus className="p-3 pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notities</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optionele opmerkingen..."
              rows={2}
              className="bg-background"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>Annuleren</Button>
          <Button onClick={handleCreate} disabled={saving} className="bg-red-600 hover:bg-red-700 text-white">
            {saving ? "Opslaan..." : "Inplannen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
