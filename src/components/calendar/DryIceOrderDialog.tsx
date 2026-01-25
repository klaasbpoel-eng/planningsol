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
  RotateCcw
} from "lucide-react";
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
  onUpdate: () => void;
  isAdmin?: boolean;
  productTypes?: DryIceProductType[];
  packagingOptions?: DryIcePackaging[];
}

export function DryIceOrderDialog({ 
  order, 
  open, 
  onOpenChange, 
  onUpdate,
  isAdmin = false,
  productTypes = [],
  packagingOptions = []
}: DryIceOrderDialogProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Edit state
  const [status, setStatus] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [quantityKg, setQuantityKg] = useState<string>("");
  const [productTypeId, setProductTypeId] = useState<string>("");
  const [packagingId, setPackagingId] = useState<string>("");
  const [containerHasWheels, setContainerHasWheels] = useState(false);
  const [notes, setNotes] = useState<string>("");

  useEffect(() => {
    if (order && isEditing) {
      setStatus(order.status);
      setScheduledDate(parseISO(order.scheduled_date));
      setQuantityKg(order.quantity_kg.toString());
      setProductTypeId(order.product_type_id || "");
      setPackagingId(order.packaging_id || "");
      setContainerHasWheels(order.container_has_wheels || false);
      setNotes(order.notes || "");
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

    setSaving(true);

    try {
      const { error } = await supabase
        .from("dry_ice_orders")
        .update({
          status: status as "pending" | "in_progress" | "completed" | "cancelled",
          scheduled_date: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : order.scheduled_date,
          quantity_kg: quantity,
          product_type_id: productTypeId || null,
          packaging_id: packagingId || null,
          container_has_wheels: containerHasWheels,
          notes: notes || null,
        })
        .eq("id", order.id);

      if (error) throw error;
      toast.success("Droogijs order bijgewerkt");

      setIsEditing(false);
      onUpdate();
    } catch (error) {
      console.error("Error updating order:", error);
      toast.error("Fout bij opslaan", {
        description: "Probeer het opnieuw",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!order) return;
    setDeleting(true);

    try {
      const { error } = await supabase
        .from("dry_ice_orders")
        .delete()
        .eq("id", order.id);

      if (error) throw error;
      
      toast.success("Droogijs order verwijderd");

      setShowDeleteConfirm(false);
      onOpenChange(false);
      onUpdate();
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
    onOpenChange(false);
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
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <Snowflake className="h-5 w-5 text-cyan-500" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-lg">
                  {isEditing ? "Order bewerken" : "Droogijs order"}
                </DialogTitle>
                <DialogDescription>
                  {isEditing ? "Bewerk de ordergegevens hieronder" : order.order_number}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {isEditing ? (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={status} onValueChange={setStatus}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
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
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !scheduledDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarDays className="mr-2 h-4 w-4" />
                          {scheduledDate ? format(scheduledDate, "d MMM yyyy", { locale: nl }) : "Selecteer datum"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                        <Calendar
                          mode="single"
                          selected={scheduledDate}
                          onSelect={setScheduledDate}
                          locale={nl}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Gewicht (kg)</Label>
                    <Input
                      type="number"
                      value={quantityKg}
                      onChange={(e) => setQuantityKg(e.target.value)}
                      className="bg-background"
                      min="0"
                      step="0.1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Producttype</Label>
                    <Select value={productTypeId} onValueChange={setProductTypeId}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecteer type" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        {productTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
                            {type.name}
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
                      <SelectValue placeholder="Selecteer verpakking" />
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

                <div className="flex items-center gap-2">
                  <Checkbox
                    id="containerHasWheels"
                    checked={containerHasWheels}
                    onCheckedChange={(checked) => setContainerHasWheels(checked as boolean)}
                  />
                  <Label htmlFor="containerHasWheels" className="cursor-pointer">
                    Container met wielen
                  </Label>
                </div>

                <div className="space-y-2">
                  <Label>Opmerkingen</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="bg-background min-h-[80px]"
                    placeholder="Optionele opmerkingen..."
                  />
                </div>
              </>
            ) : (
              <>
                {/* View Mode */}
                <div className="flex items-center gap-2 mb-4">
                  <Badge className={cn("text-sm", getStatusColor(order.status))}>
                    {getStatusLabel(order.status)}
                  </Badge>
                  {order.is_recurring && (
                    <Badge variant="outline" className="text-sm flex items-center gap-1">
                      <RotateCcw className="h-3 w-3" />
                      Herhalend
                    </Badge>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                    <Building2 className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">Klant</p>
                      <p className="font-medium">{order.customer_name}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <CalendarDays className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Datum</p>
                        <p className="font-medium">
                          {format(parseISO(order.scheduled_date), "EEEE d MMMM yyyy", { locale: nl })}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Scale className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Gewicht</p>
                        <p className="font-medium">{order.quantity_kg} kg</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Snowflake className="h-5 w-5 text-cyan-500" />
                      <div>
                        <p className="text-xs text-muted-foreground">Producttype</p>
                        <p className="font-medium">{order.product_type_info?.name || "-"}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Package className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Verpakking</p>
                        <p className="font-medium">{order.packaging_info?.name || "-"}</p>
                      </div>
                    </div>
                  </div>

                  {order.container_has_wheels && (
                    <Badge variant="outline" className="text-sm">
                      Container met wielen
                    </Badge>
                  )}

                  {order.notes && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Opmerkingen</p>
                        <p className="text-sm">{order.notes}</p>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            {isEditing ? (
              <>
                <Button variant="outline" onClick={cancelEditing} disabled={saving}>
                  <X className="mr-2 h-4 w-4" />
                  Annuleren
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Opslaan..." : "Opslaan"}
                </Button>
              </>
            ) : (
              <>
                {isAdmin && (
                  <>
                    <Button 
                      variant="destructive" 
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Verwijderen
                    </Button>
                    <Button onClick={startEditing}>
                      <Edit2 className="mr-2 h-4 w-4" />
                      Bewerken
                    </Button>
                  </>
                )}
                {!isAdmin && (
                  <Button variant="outline" onClick={handleClose}>
                    Sluiten
                  </Button>
                )}
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
              Weet je zeker dat je order {order.order_number} wilt verwijderen? 
              Deze actie kan niet ongedaan worden gemaakt.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Annuleren</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete} 
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
