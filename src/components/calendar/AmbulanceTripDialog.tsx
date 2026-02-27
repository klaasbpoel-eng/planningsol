import { useState, useEffect } from "react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Ambulance, Trash2, Users, Pencil, X, Plus, CalendarDays } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AmbulanceTripCustomer {
  id: string;
  customer_number: string;
  customer_name: string;
}

export interface AmbulanceTripWithCustomers {
  id: string;
  scheduled_date: string;
  cylinders_2l_300_o2: number;
  cylinders_2l_200_o2: number;
  cylinders_1l_pindex_o2: number;
  cylinders_5l_o2_integrated: number;
  cylinders_10l_o2_integrated: number;
  cylinders_5l_air_integrated: number;
  cylinders_2l_air_integrated: number;
  model_5l: string;
  status: string;
  notes: string | null;
  created_at: string;
  series_id: string | null;
  customers: AmbulanceTripCustomer[];
}

const model5lLabels: Record<string, string> = {
  any: "Maakt niet uit",
  high: "Hoog model",
  low: "Laag model",
};

interface AmbulanceTripDialogProps {
  trip: AmbulanceTripWithCustomers | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  isAdmin: boolean;
}

const statusOptions = [
  { value: "pending", label: "Gepland" },
  { value: "completed", label: "Voltooid" },
  { value: "cancelled", label: "Geannuleerd" },
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "completed": return "bg-success/80 text-success-foreground";
    case "pending": return "bg-red-500/80 text-white";
    case "cancelled": return "bg-muted text-muted-foreground";
    default: return "bg-red-500/80 text-white";
  }
};

export function AmbulanceTripDialog({ trip, open, onOpenChange, onUpdate, isAdmin }: AmbulanceTripDialogProps) {
  const [status, setStatus] = useState(trip?.status || "pending");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [applyToSeries, setApplyToSeries] = useState(!!trip?.series_id);

  // Edit state
  const [editDate, setEditDate] = useState<Date | undefined>();
  const [editCyl2l300, setEditCyl2l300] = useState("");
  const [editCyl2l200, setEditCyl2l200] = useState("");
  const [editCyl1lPindex, setEditCyl1lPindex] = useState("");
  const [editCyl5l, setEditCyl5l] = useState("");
  const [editModel5l, setEditModel5l] = useState<"any" | "high" | "low">("any");
  const [editCyl10l, setEditCyl10l] = useState("");
  const [editCyl5lAir, setEditCyl5lAir] = useState("");
  const [editCyl2lAir, setEditCyl2lAir] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editCustomers, setEditCustomers] = useState<{ id?: string; customer_number: string; customer_name: string }[]>([]);

  useEffect(() => {
    if (trip) {
      setStatus(trip.status);
      resetEditState();
    }
  }, [trip]);

  const resetEditState = () => {
    if (!trip) return;
    setEditDate(parseISO(trip.scheduled_date));
    setEditCyl2l300(trip.cylinders_2l_300_o2 ? String(trip.cylinders_2l_300_o2) : "");
    setEditCyl2l200(trip.cylinders_2l_200_o2 ? String(trip.cylinders_2l_200_o2) : "");
    setEditCyl1lPindex(trip.cylinders_1l_pindex_o2 ? String(trip.cylinders_1l_pindex_o2) : "");
    setEditCyl5l(trip.cylinders_5l_o2_integrated ? String(trip.cylinders_5l_o2_integrated) : "");
    setEditModel5l((trip.model_5l as "any" | "high" | "low") || "any");
    setEditCyl10l(trip.cylinders_10l_o2_integrated ? String(trip.cylinders_10l_o2_integrated) : "");
    setEditCyl5lAir(trip.cylinders_5l_air_integrated ? String(trip.cylinders_5l_air_integrated) : "");
    setEditCyl2lAir(trip.cylinders_2l_air_integrated ? String(trip.cylinders_2l_air_integrated) : "");
    setEditNotes(trip.notes || "");
    setEditCustomers(trip.customers.map(c => ({ id: c.id, customer_number: c.customer_number, customer_name: c.customer_name })));
  };

  if (!trip) return null;

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus);
    try {
      const { error } = await supabase
        .from("ambulance_trips" as any)
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", trip.id);
      if (error) throw error;
      toast.success("Status bijgewerkt");
      onUpdate();
    } catch (error) {
      console.error("Error updating status:", error);
      toast.error("Fout bij bijwerken status");
      setStatus(trip.status);
    }
  };

  const handleSave = async () => {
    if (!editDate) {
      toast.error("Selecteer een datum");
      return;
    }
    setSaving(true);
    try {
      const updateData = {
        cylinders_2l_300_o2: parseInt(editCyl2l300) || 0,
        cylinders_2l_200_o2: parseInt(editCyl2l200) || 0,
        cylinders_1l_pindex_o2: parseInt(editCyl1lPindex) || 0,
        cylinders_5l_o2_integrated: parseInt(editCyl5l) || 0,
        model_5l: editModel5l,
        cylinders_10l_o2_integrated: parseInt(editCyl10l) || 0,
        cylinders_5l_air_integrated: parseInt(editCyl5lAir) || 0,
        cylinders_2l_air_integrated: parseInt(editCyl2lAir) || 0,
        notes: editNotes.trim() || null,
        updated_at: new Date().toISOString(),
      };

      if (applyToSeries && trip.series_id) {
        // Update all trips in the series (keep their own dates)
        const { error: tripError } = await supabase
          .from("ambulance_trips" as any)
          .update(updateData)
          .eq("series_id", trip.series_id);
        if (tripError) throw tripError;

        // Update customers for all trips in the series
        // First get all trip IDs in the series
        const { data: seriesTrips } = await supabase
          .from("ambulance_trips" as any)
          .select("id")
          .eq("series_id", trip.series_id);

        if (seriesTrips) {
          const validCustomers = editCustomers.filter(c => c.customer_number.trim() || c.customer_name.trim());
          for (const seriesTrip of seriesTrips) {
            await supabase.from("ambulance_trip_customers" as any).delete().eq("trip_id", (seriesTrip as any).id);
            if (validCustomers.length > 0) {
              await supabase
                .from("ambulance_trip_customers" as any)
                .insert(validCustomers.map(c => ({
                  trip_id: (seriesTrip as any).id,
                  customer_number: c.customer_number.trim(),
                  customer_name: c.customer_name.trim(),
                })));
            }
          }
        }

        toast.success("Gehele reeks bijgewerkt");
      } else {
        // Update only this trip (including date)
        const { error: tripError } = await supabase
          .from("ambulance_trips" as any)
          .update({ ...updateData, scheduled_date: format(editDate, "yyyy-MM-dd") })
          .eq("id", trip.id);
        if (tripError) throw tripError;

        // Update customers for this trip only
        await supabase.from("ambulance_trip_customers" as any).delete().eq("trip_id", trip.id);
        const validCustomers = editCustomers.filter(c => c.customer_number.trim() || c.customer_name.trim());
        if (validCustomers.length > 0) {
          const { error: custError } = await supabase
            .from("ambulance_trip_customers" as any)
            .insert(validCustomers.map(c => ({
              trip_id: trip.id,
              customer_number: c.customer_number.trim(),
              customer_name: c.customer_name.trim(),
            })));
          if (custError) throw custError;
        }

        toast.success("Ambulance rit bijgewerkt");
      }

      setEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating trip:", error);
      toast.error("Fout bij bijwerken");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      if (trip.series_id) {
        // Delete all trips in the series
        const { error } = await supabase
          .from("ambulance_trips" as any)
          .delete()
          .eq("series_id", trip.series_id);
        if (error) throw error;
        toast.success("Gehele reeks verwijderd");
      } else {
        const { error } = await supabase
          .from("ambulance_trips" as any)
          .delete()
          .eq("id", trip.id);
        if (error) throw error;
        toast.success("Ambulance rit verwijderd");
      }
      onOpenChange(false);
      onUpdate();
    } catch (error) {
      console.error("Error deleting trip:", error);
      toast.error("Fout bij verwijderen");
    }
  };

  const addCustomerRow = () => {
    setEditCustomers(prev => [...prev, { customer_number: "", customer_name: "" }]);
  };

  const removeCustomerRow = (index: number) => {
    setEditCustomers(prev => prev.filter((_, i) => i !== index));
  };

  const updateCustomer = (index: number, field: "customer_number" | "customer_name", value: string) => {
    setEditCustomers(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleCancelEdit = () => {
    resetEditState();
    setEditing(false);
  };

  // View mode
  const renderViewMode = () => (
    <div className="space-y-4 py-4">
      {/* Cylinder counts - O2 */}
      <div className="space-y-2">
        <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Zuurstof (O2)</div>
        <div className="grid grid-cols-2 gap-3">
          {trip.cylinders_2l_300_o2 > 0 && (
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-xs text-muted-foreground">2L 300 O2</div>
              <div className="text-2xl font-bold">{trip.cylinders_2l_300_o2}</div>
            </div>
          )}
          {trip.cylinders_2l_200_o2 > 0 && (
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-xs text-muted-foreground">2L 200 O2</div>
              <div className="text-2xl font-bold">{trip.cylinders_2l_200_o2}</div>
            </div>
          )}
          {trip.cylinders_1l_pindex_o2 > 0 && (
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-xs text-muted-foreground">1L Pindex O2</div>
              <div className="text-2xl font-bold">{trip.cylinders_1l_pindex_o2}</div>
            </div>
          )}
          {trip.cylinders_5l_o2_integrated > 0 && (
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-xs text-muted-foreground">5L O2 Geïntegreerd</div>
              <div className="text-2xl font-bold">{trip.cylinders_5l_o2_integrated}</div>
              <div className="text-xs text-muted-foreground mt-1">{model5lLabels[trip.model_5l] || trip.model_5l}</div>
            </div>
          )}
          {trip.cylinders_10l_o2_integrated > 0 && (
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-xs text-muted-foreground">10L O2 Geïntegreerd</div>
              <div className="text-2xl font-bold">{trip.cylinders_10l_o2_integrated}</div>
            </div>
          )}
        </div>
      </div>

      {/* Cylinder counts - Lucht */}
      {(trip.cylinders_5l_air_integrated > 0 || trip.cylinders_2l_air_integrated > 0) && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Lucht</div>
          <div className="grid grid-cols-2 gap-3">
            {trip.cylinders_5l_air_integrated > 0 && (
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="text-xs text-muted-foreground">5L Geïntegreerd</div>
                <div className="text-2xl font-bold">{trip.cylinders_5l_air_integrated}</div>
              </div>
            )}
            {trip.cylinders_2l_air_integrated > 0 && (
              <div className="p-3 rounded-lg border bg-muted/30">
                <div className="text-xs text-muted-foreground">2L Geïntegreerd</div>
                <div className="text-2xl font-bold">{trip.cylinders_2l_air_integrated}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Customer list */}
      {trip.customers.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" />
            Klantenlijst ({trip.customers.length})
          </div>
          <div className="border rounded-lg divide-y">
            {trip.customers.map((c) => (
              <div key={c.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="font-mono text-muted-foreground">{c.customer_number}</span>
                <span className="flex-1">{c.customer_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {trip.notes && (
        <div className="space-y-1">
          <div className="text-sm font-medium">Notities</div>
          <p className="text-sm text-muted-foreground">{trip.notes}</p>
        </div>
      )}

      {/* Status change */}
      {isAdmin && (
        <div className="space-y-2">
          <div className="text-sm font-medium">Status wijzigen</div>
          <Select value={status} onValueChange={handleStatusChange}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );

  // Edit mode
  const renderEditMode = () => (
    <div className="space-y-4 py-4">
      {/* Date */}
      <div className="space-y-2">
        <Label>Geplande datum</Label>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !editDate && "text-muted-foreground")}>
              <CalendarDays className="mr-2 h-4 w-4" />
              {editDate ? format(editDate, "d MMM yyyy", { locale: nl }) : "Selecteer datum"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
            <Calendar mode="single" selected={editDate} onSelect={setEditDate} locale={nl} initialFocus className="p-3 pointer-events-auto" />
          </PopoverContent>
        </Popover>
      </div>

      {/* O2 cylinders */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Zuurstof (O2)</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">2L 300 O2</Label>
            <Input type="number" min="0" value={editCyl2l300} onChange={e => setEditCyl2l300(e.target.value)} placeholder="0" className="bg-background" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">2L 200 O2</Label>
            <Input type="number" min="0" value={editCyl2l200} onChange={e => setEditCyl2l200(e.target.value)} placeholder="0" className="bg-background" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">1L Pindex O2</Label>
            <Input type="number" min="0" value={editCyl1lPindex} onChange={e => setEditCyl1lPindex(e.target.value)} placeholder="0" className="bg-background" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">5L O2 Geïntegreerd</Label>
            <Input type="number" min="0" value={editCyl5l} onChange={e => setEditCyl5l(e.target.value)} placeholder="0" className="bg-background" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">10L O2 Geïntegreerd</Label>
            <Input type="number" min="0" value={editCyl10l} onChange={e => setEditCyl10l(e.target.value)} placeholder="0" className="bg-background" />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">5L model voorkeur</Label>
          <Select value={editModel5l} onValueChange={v => setEditModel5l(v as "any" | "high" | "low")}>
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

      {/* Air cylinders */}
      <div className="space-y-3">
        <Label className="text-sm font-semibold">Lucht</Label>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">5L Geïntegreerd</Label>
            <Input type="number" min="0" value={editCyl5lAir} onChange={e => setEditCyl5lAir(e.target.value)} placeholder="0" className="bg-background" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">2L Geïntegreerd</Label>
            <Input type="number" min="0" value={editCyl2lAir} onChange={e => setEditCyl2lAir(e.target.value)} placeholder="0" className="bg-background" />
          </div>
        </div>
      </div>

      {/* Customer list */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Klantenlijst</Label>
          <Button type="button" variant="ghost" size="sm" onClick={addCustomerRow} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Klant toevoegen
          </Button>
        </div>
        <div className="space-y-2">
          {editCustomers.map((customer, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input placeholder="Klantnummer" value={customer.customer_number} onChange={e => updateCustomer(index, "customer_number", e.target.value)} className="bg-background flex-1" />
              <Input placeholder="Klantnaam" value={customer.customer_name} onChange={e => updateCustomer(index, "customer_name", e.target.value)} className="bg-background flex-1" />
              {editCustomers.length > 1 && (
                <Button type="button" variant="ghost" size="icon" onClick={() => removeCustomerRow(index)} className="h-8 w-8 shrink-0">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
          {editCustomers.length === 0 && (
            <Button type="button" variant="outline" size="sm" onClick={addCustomerRow} className="w-full">
              <Plus className="h-3 w-3 mr-1" /> Klant toevoegen
            </Button>
          )}
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label>Notities</Label>
        <Textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} placeholder="Optionele opmerkingen..." rows={2} className="bg-background" />
      </div>

      {/* Apply to series checkbox */}
      {trip.series_id && (
        <div className="flex items-center space-x-2 p-3 rounded-lg border bg-muted/30">
          <Checkbox
            id="apply-to-series"
            checked={applyToSeries}
            onCheckedChange={(checked) => setApplyToSeries(!!checked)}
          />
          <Label htmlFor="apply-to-series" className="text-sm cursor-pointer">
            Wijzigingen doorvoeren voor de gehele reeks
          </Label>
        </div>
      )}
    </div>
  );

  return (
    <ResponsiveDialog open={open} onOpenChange={(o) => { if (!o) { setEditing(false); } onOpenChange(o); }} handleOnly>
      <ResponsiveDialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Ambulance className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1">
              <ResponsiveDialogTitle>Ambulance rit</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {format(parseISO(trip.scheduled_date), "EEEE d MMMM yyyy", { locale: nl })}
                {trip.series_id && <span className="ml-2 text-xs">(reeks)</span>}
              </ResponsiveDialogDescription>
            </div>
            {!editing && (
              <Badge className={getStatusColor(status)}>
                {statusOptions.find(s => s.value === status)?.label || status}
              </Badge>
            )}
          </div>
        </ResponsiveDialogHeader>

        {editing ? renderEditMode() : renderViewMode()}

        <ResponsiveDialogFooter>
          {editing ? (
            <>
              <Button variant="outline" onClick={handleCancelEdit}>Annuleren</Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? "Opslaan..." : "Opslaan"}
              </Button>
            </>
          ) : (
            <>
              {isAdmin && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="h-4 w-4 mr-1" />
                      {trip.series_id ? "Reeks verwijderen" : "Verwijderen"}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>
                        {trip.series_id ? "Gehele reeks verwijderen?" : "Ambulance rit verwijderen?"}
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        {trip.series_id
                          ? "Alle ambulance ritten in deze reeks worden permanent verwijderd. Deze actie kan niet ongedaan worden gemaakt."
                          : "Deze actie kan niet ongedaan worden gemaakt."}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annuleren</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDelete}>Verwijderen</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {isAdmin && (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4 mr-1" />
                  Bewerken
                </Button>
              )}
              <Button variant="outline" onClick={() => onOpenChange(false)}>Sluiten</Button>
            </>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
