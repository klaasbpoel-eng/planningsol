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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Ambulance, Trash2, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
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
  cylinders_5l_o2_integrated: number;
  status: string;
  notes: string | null;
  created_at: string;
  customers: AmbulanceTripCustomer[];
}

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

  useEffect(() => {
    if (trip) setStatus(trip.status);
  }, [trip]);

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

  const handleDelete = async () => {
    try {
      const { error } = await supabase
        .from("ambulance_trips" as any)
        .delete()
        .eq("id", trip.id);
      if (error) throw error;
      toast.success("Ambulance rit verwijderd");
      onOpenChange(false);
      onUpdate();
    } catch (error) {
      console.error("Error deleting trip:", error);
      toast.error("Fout bij verwijderen");
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} handleOnly>
      <ResponsiveDialogContent className="sm:max-w-[500px]">
        <ResponsiveDialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-red-500/10">
              <Ambulance className="h-5 w-5 text-red-500" />
            </div>
            <div className="flex-1">
              <ResponsiveDialogTitle>Ambulance rit</ResponsiveDialogTitle>
              <ResponsiveDialogDescription>
                {format(parseISO(trip.scheduled_date), "EEEE d MMMM yyyy", { locale: nl })}
              </ResponsiveDialogDescription>
            </div>
            <Badge className={getStatusColor(status)}>
              {statusOptions.find(s => s.value === status)?.label || status}
            </Badge>
          </div>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-4">
          {/* Cylinder counts */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-xs text-muted-foreground">2L 300 O2</div>
              <div className="text-2xl font-bold">{trip.cylinders_2l_300_o2}</div>
            </div>
            <div className="p-3 rounded-lg border bg-muted/30">
              <div className="text-xs text-muted-foreground">5L O2 Geïntegreerd</div>
              <div className="text-2xl font-bold">{trip.cylinders_5l_o2_integrated}</div>
            </div>
          </div>

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

        <ResponsiveDialogFooter>
          {isAdmin && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1" />
                  Verwijderen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Ambulance rit verwijderen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Deze actie kan niet ongedaan worden gemaakt.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Verwijderen</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>Sluiten</Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
