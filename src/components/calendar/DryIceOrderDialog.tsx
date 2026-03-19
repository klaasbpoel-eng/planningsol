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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Snowflake,
  CalendarDays,
  Package,
  Scale,
  Edit2,
  Save,
  X,
  Trash2,
  Building2,
  FileText,
  RotateCcw,
  Repeat,
  Infinity
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format, parseISO } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type DryIceOrder = Database["public"]["Tables"]["dry_ice_orders"]["Row"];
type DryIceProductType = Database["public"]["Tables"]["dry_ice_product_types"]["Row"];
type DryIcePackaging = Database["public"]["Tables"]["dry_ice_packaging"]["Row"];

type DryIceOrderWithDetails = DryIceOrder & {
  product_type_info?: DryIceProductType | null;
  packaging_info?: DryIcePackaging | null;
};

interface DryIceOrderDialogProps {
  order: DryIceOrderWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (deletedId?: string, deletedType?: "dryice" | "gascylinder", updatedItem?: any) => void;
  isAdmin?: boolean;
  canEdit?: boolean;
  productTypes?: DryIceProductType[];
  packagingOptions?: DryIcePackaging[];
}

export function DryIceOrderDialog({
  order,
  open,
  onOpenChange,
  onUpdate,
  isAdmin = false,
  canEdit,
  productTypes = [],
  packagingOptions = []
}: DryIceOrderDialogProps) {
  // Use canEdit if provided, otherwise fall back to isAdmin for backwards compatibility
  const hasEditPermission = canEdit !== undefined ? canEdit : isAdmin;
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteScope, setDeleteScope] = useState<'single' | 'series'>('single');
  const [applyToSeries, setApplyToSeries] = useState(false);

  // Edit state
  const [status, setStatus] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [quantityKg, setQuantityKg] = useState<string>("");
  const [productTypeId, setProductTypeId] = useState<string>("");
  const [packagingId, setPackagingId] = useState<string>("");
  const [containerHasWheels, setContainerHasWheels] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [isRecurring, setIsRecurring] = useState(false);
  const [isInfiniteRecurrence, setIsInfiniteRecurrence] = useState(false);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<Date | undefined>();

  useEffect(() => {
    if (order && isEditing) {
      setStatus(order.status);
      setScheduledDate(parseISO(order.scheduled_date));
      setQuantityKg(order.quantity_kg.toString());
      setProductTypeId(order.product_type_id || "");
      setPackagingId(order.packaging_id || "");
      setContainerHasWheels(order.container_has_wheels || false);
      setNotes(order.notes || "");
      setIsRecurring(order.is_recurring || false);
      setIsInfiniteRecurrence(!order.recurrence_end_date && (order.is_recurring || false));
      setRecurrenceEndDate(order.recurrence_end_date ? parseISO(order.recurrence_end_date) : undefined);
    }
  }, [order, isEditing]);

  const startEditing = () => {
    if (order) {
      setStatus(order.status);
      setScheduledDate(parseISO(order.scheduled_date));
      setQuantityKg(order.quantity_kg.toString());
      setProductTypeId(order.product_type_id || "");
      setPackagingId(order.packaging_id || "");
      setContainerHasWheels(order.container_has_wheels || false);
      setNotes(order.notes || "");
      setIsRecurring(order.is_recurring || false);
      setIsInfiniteRecurrence(!order.recurrence_end_date && (order.is_recurring || false));
      setRecurrenceEndDate(order.recurrence_end_date ? parseISO(order.recurrence_end_date) : undefined);
      setApplyToSeries(!!(order.is_recurring || order.parent_order_id));
    }
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (!order) return;
    const quantity = parseFloat(quantityKg);
    if (isNaN(quantity) || quantity <= 0) {
      toast.error("Vul een geldig gewicht in");
      return;
    }
    await executeSave(applyToSeries ? 'series' : 'single');
  };

  const executeSave = async (scope: 'single' | 'series') => {
    if (!order) return;
    const quantity = parseFloat(quantityKg);
    setSaving(true);
    try {
      const updateFields: Record<string, any> = {
        status: status as "pending" | "in_progress" | "completed" | "cancelled",
        quantity_kg: quantity,
        product_type_id: productTypeId || null,
        packaging_id: packagingId || null,
        container_has_wheels: containerHasWheels,
        notes: notes || null,
        is_recurring: isRecurring,
        recurrence_end_date: isRecurring && !isInfiniteRecurrence && recurrenceEndDate
          ? format(recurrenceEndDate, "yyyy-MM-dd") : null,
      };

      if (scope === 'series') {
        const seriesFields = { ...updateFields };
        delete seriesFields.status;
        const seriesId = order.parent_order_id || order.id;
        await api.dryIceOrders.updateSeriesFields(seriesId, seriesFields);
        const { data } = await supabase.from("dry_ice_orders").update({
          ...updateFields,
          scheduled_date: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : order.scheduled_date,
        }).eq("id", order.id).select().single();
        toast.success("Hele reeks bijgewerkt");

        setIsEditing(false);
        onUpdate(); // full reload for series
        return;
      } else {
        const { data } = await supabase.from("dry_ice_orders").update({
          ...updateFields,
          scheduled_date: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : order.scheduled_date,
        }).eq("id", order.id).select().single();
        toast.success("Droogijs order bijgewerkt");

        setIsEditing(false);
        onUpdate(undefined, "dryice", data);
        return;
      }
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (scope: 'single' | 'series' = 'single') => {
    if (!order || deleting) return;
    const isSeriesDelete = scope === 'series' && !!(order.is_recurring || order.parent_order_id);
    setDeleting(true);

    try {
      if (isSeriesDelete) {
        const seriesId = order.parent_order_id || order.id;
        await api.dryIceOrders.deleteSeries(seriesId);
        toast.success("Volledige reeks verwijderd");

        setShowDeleteConfirm(false);
        onOpenChange(false);
        onUpdate();
      } else {
        await api.dryIceOrders.delete(order.id);
        toast.success("Droogijs order verwijderd");

        setShowDeleteConfirm(false);
        onOpenChange(false);
        onUpdate(order.id, "dryice");
      }
    } catch (error) {
      console.error("Error deleting order:", error);
      toast.error("Fout bij verwijderen", {
        description: "Probeer het opnieuw",
      });
    } finally {
      setDeleting(false);
    }
  };

  const handleClose = () => {
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setDeleteScope('single');
    onOpenChange(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      handleClose();
    }
  };

  if (!order) return null;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "pending": return "Gepland";
      case "in_progress": return "Bezig";
      case "completed": return "Voltooid";
      case "cancelled": return "Geannuleerd";
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending": return "bg-warning text-warning-foreground";
      case "in_progress": return "bg-blue-500 text-white";
      case "completed": return "bg-success text-success-foreground";
      case "cancelled": return "bg-destructive text-destructive-foreground";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[500px] w-[95%] rounded-lg">
...
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Order verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Weet je zeker dat je order {order.order_number} wilt verwijderen?
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
            {(order.is_recurring || order.parent_order_id) && (
              <div className="py-2">
                <RadioGroup value={deleteScope} onValueChange={(v) => setDeleteScope(v as 'single' | 'series')}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="single" />
                    <Label htmlFor="single">Alleen deze order verwijderen</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="series" id="series" />
                    <Label htmlFor="series">Alle orders in de reeks verwijderen</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              onClick={(event) => {
                if (deleting) {
                  event.preventDefault();
                }
              }}
            >
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                void handleDelete(deleteScope);
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Verwijderen..." : "Verwijderen"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
