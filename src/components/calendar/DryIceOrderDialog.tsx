import { useEffect, useState } from "react";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarDays, Edit2, FileText, Package, Repeat, Save, Scale, Snowflake, Trash2, X } from "lucide-react";
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
  packagingOptions = [],
}: DryIceOrderDialogProps) {
  const hasEditPermission = canEdit !== undefined ? canEdit : isAdmin;

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteScope, setDeleteScope] = useState<"single" | "series">("single");
  const [applyToSeries, setApplyToSeries] = useState(false);

  const [status, setStatus] = useState<DryIceOrder["status"]>("pending");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [quantityKg, setQuantityKg] = useState("");
  const [productTypeId, setProductTypeId] = useState<string>("");
  const [packagingId, setPackagingId] = useState<string>("");
  const [containerHasWheels, setContainerHasWheels] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) {
      setIsEditing(false);
      setShowDeleteConfirm(false);
      setDeleteScope("single");
      setApplyToSeries(false);
      return;
    }

    if (order) {
      setStatus(order.status);
      setScheduledDate(parseISO(order.scheduled_date));
      setQuantityKg(order.quantity_kg.toString());
      setProductTypeId(order.product_type_id || "");
      setPackagingId(order.packaging_id || "");
      setContainerHasWheels(!!order.container_has_wheels);
      setNotes(order.notes || "");
      setApplyToSeries(!!(order.is_recurring || order.parent_order_id));
    }
  }, [open, order]);

  const isRecurringOrder = !!(order?.is_recurring || order?.parent_order_id);

  const handleClose = () => {
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setDeleteScope("single");
    setApplyToSeries(false);
    onOpenChange(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) handleClose();
  };

  const startEditing = () => {
    if (!order) return;
    setStatus(order.status);
    setScheduledDate(parseISO(order.scheduled_date));
    setQuantityKg(order.quantity_kg.toString());
    setProductTypeId(order.product_type_id || "");
    setPackagingId(order.packaging_id || "");
    setContainerHasWheels(!!order.container_has_wheels);
    setNotes(order.notes || "");
    setApplyToSeries(!!(order.is_recurring || order.parent_order_id));
    setIsEditing(true);
  };

  const handleSave = async () => {
    if (!order) return;

    const parsedQuantity = Number(quantityKg);
    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
      toast.error("Vul een geldig gewicht in");
      return;
    }

    setSaving(true);

    try {
      const updateFields: Partial<DryIceOrder> = {
        status,
        quantity_kg: parsedQuantity,
        scheduled_date: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : order.scheduled_date,
        product_type_id: productTypeId || null,
        packaging_id: packagingId || null,
        container_has_wheels: containerHasWheels,
        notes: notes || null,
      };

      if (applyToSeries && isRecurringOrder) {
        const seriesId = order.parent_order_id || order.id;
        const seriesFields: Record<string, any> = {
          quantity_kg: updateFields.quantity_kg,
          product_type_id: updateFields.product_type_id,
          packaging_id: updateFields.packaging_id,
          container_has_wheels: updateFields.container_has_wheels,
          notes: updateFields.notes,
        };

        await api.dryIceOrders.updateSeriesFields(seriesId, seriesFields);

        await supabase
          .from("dry_ice_orders")
          .update({
            status: updateFields.status,
            scheduled_date: updateFields.scheduled_date,
          })
          .eq("id", order.id);

        toast.success("Hele reeks bijgewerkt");
        setIsEditing(false);
        onUpdate();
        return;
      }

      const { data, error } = await supabase
        .from("dry_ice_orders")
        .update(updateFields)
        .eq("id", order.id)
        .select()
        .single();

      if (error) throw error;

      toast.success("Droogijs order bijgewerkt");
      setIsEditing(false);
      onUpdate(undefined, "dryice", data);
    } catch (error) {
      console.error("Error updating dry ice order:", error);
      toast.error("Fout bij opslaan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (scope: "single" | "series") => {
    if (!order || deleting) return;
    setDeleting(true);

    try {
      const isSeriesDelete = scope === "series" && isRecurringOrder;

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
      console.error("Error deleting dry ice order:", error);
      toast.error("Fout bij verwijderen", { description: "Probeer het opnieuw" });
    } finally {
      setDeleting(false);
    }
  };

  if (!order) return null;

  const statusLabel: Record<string, string> = {
    pending: "Gepland",
    in_progress: "Bezig",
    completed: "Voltooid",
    cancelled: "Geannuleerd",
  };

  const statusStyle: Record<string, string> = {
    pending: "bg-warning text-warning-foreground",
    in_progress: "bg-info text-info-foreground",
    completed: "bg-success text-success-foreground",
    cancelled: "bg-destructive text-destructive-foreground",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="sm:max-w-[540px] w-[95%] rounded-lg">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-muted">
                <Snowflake className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-lg">
                  {isEditing ? "Order bewerken" : "Droogijs order"}
                </DialogTitle>
                <DialogDescription>
                  {isEditing ? "Werk de ordergegevens bij" : order.order_number}
                </DialogDescription>
              </div>
              {!isEditing && (
                <Badge className={cn(statusStyle[order.status] || statusStyle.pending)}>
                  {statusLabel[order.status] || order.status}
                </Badge>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isEditing ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={(value) => setStatus(value as DryIceOrder["status"])}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Gepland</SelectItem>
                        <SelectItem value="in_progress">Bezig</SelectItem>
                        <SelectItem value="completed">Voltooid</SelectItem>
                        <SelectItem value="cancelled">Geannuleerd</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Datum</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !scheduledDate && "text-muted-foreground")}>
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {scheduledDate ? format(scheduledDate, "d MMM yyyy", { locale: nl }) : "Selecteer datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} locale={nl} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Hoeveelheid (kg)</Label>
                    <Input value={quantityKg} onChange={(event) => setQuantityKg(event.target.value)} inputMode="decimal" />
                  </div>

                  <div className="space-y-2">
                    <Label>Producttype</Label>
                    <Select value={productTypeId || "none"} onValueChange={(value) => setProductTypeId(value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Geen</SelectItem>
                        {productTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Verpakking</Label>
                    <Select value={packagingId || "none"} onValueChange={(value) => setPackagingId(value === "none" ? "" : value)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecteer verpakking" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Geen</SelectItem>
                        {packagingOptions.map((packaging) => (
                          <SelectItem key={packaging.id} value={packaging.id}>{packaging.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2 pt-7">
                    <Label className="flex items-center gap-2 cursor-pointer">
                      <Checkbox checked={containerHasWheels} onCheckedChange={(checked) => setContainerHasWheels(!!checked)} />
                      Container heeft wielen
                    </Label>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Notities</Label>
                  <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={3} />
                </div>

                {isRecurringOrder && (
                  <div className="flex items-center space-x-2 rounded-md border p-3 bg-muted/30">
                    <Checkbox id="apply-series-dryice" checked={applyToSeries} onCheckedChange={(checked) => setApplyToSeries(!!checked)} />
                    <Label htmlFor="apply-series-dryice" className="cursor-pointer text-sm">
                      Wijzigingen doorvoeren voor hele reeks
                    </Label>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Klant:</span>
                  <span className="font-medium">{order.customer_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Scale className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Hoeveelheid:</span>
                  <span className="font-medium">{order.quantity_kg} kg</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <CalendarDays className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Datum:</span>
                  <span className="font-medium">{format(parseISO(order.scheduled_date), "d MMM yyyy", { locale: nl })}</span>
                </div>
                {isRecurringOrder && (
                  <div className="flex items-center gap-2 text-sm">
                    <Repeat className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Onderdeel van een reeks</span>
                  </div>
                )}
                {order.notes && (
                  <div className="flex items-start gap-2 text-sm pt-1">
                    <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p>{order.notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving} className="w-full sm:w-auto">
                  <X className="mr-2 h-4 w-4" />
                  Annuleren
                </Button>
                <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Opslaan..." : "Opslaan"}
                </Button>
              </>
            ) : (
              <>
                {hasEditPermission ? (
                  <>
                    <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)} className="w-full sm:w-auto">
                      <Trash2 className="mr-2 h-4 w-4" />
                      Verwijderen
                    </Button>
                    <Button onClick={startEditing} className="w-full sm:w-auto">
                      <Edit2 className="mr-2 h-4 w-4" />
                      Bewerken
                    </Button>
                  </>
                ) : null}
                <Button variant="outline" onClick={handleClose} className="w-full sm:w-auto">
                  Sluiten
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Order verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              {isRecurringOrder
                ? "Wil je alleen deze order verwijderen of de hele reeks?"
                : `Weet je zeker dat je order ${order.order_number} wilt verwijderen? Deze actie kan niet ongedaan worden gemaakt.`}
            </AlertDialogDescription>
            {isRecurringOrder && (
              <div className="py-2">
                <RadioGroup value={deleteScope} onValueChange={(value) => setDeleteScope(value as "single" | "series")}>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="single" id="dryice-delete-single" />
                    <Label htmlFor="dryice-delete-single">Alleen deze order verwijderen</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="series" id="dryice-delete-series" />
                    <Label htmlFor="dryice-delete-series">Alle orders in de reeks verwijderen</Label>
                  </div>
                </RadioGroup>
              </div>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={deleting}
              onClick={(event) => {
                if (deleting) event.preventDefault();
              }}
            >
              Annuleren
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete(deleteScope);
              }}
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
