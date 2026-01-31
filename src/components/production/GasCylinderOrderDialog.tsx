import { useState, useEffect } from "react";
import { formatNumber } from "@/lib/utils";
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
import { 
  Cylinder, 
  CalendarDays, 
  Edit2, 
  Save, 
  X,
  Trash2,
  Building2,
  FileText,
  Gauge,
  Hash
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

interface GasCylinderOrder {
  id: string;
  order_number: string;
  customer_name: string;
  gas_type: string;
  gas_type_id: string | null;
  gas_grade: string;
  cylinder_count: number;
  cylinder_size: string;
  scheduled_date: string;
  status: string;
  notes: string | null;
  pressure: number;
  gas_type_ref?: {
    id: string;
    name: string;
    color: string;
  } | null;
}

interface GasType {
  id: string;
  name: string;
  color: string;
}

interface GasCylinderOrderDialogProps {
  order: GasCylinderOrder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  isAdmin?: boolean;
  canEdit?: boolean;
}

export function GasCylinderOrderDialog({ 
  order, 
  open, 
  onOpenChange, 
  onUpdate,
  isAdmin = false,
  canEdit,
}: GasCylinderOrderDialogProps) {
  // Use canEdit if provided, otherwise fall back to isAdmin for backwards compatibility
  const hasEditPermission = canEdit !== undefined ? canEdit : isAdmin;
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Edit state
  const [status, setStatus] = useState<string>("");
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>();
  const [cylinderCount, setCylinderCount] = useState<string>("");
  const [gasTypeId, setGasTypeId] = useState<string>("");
  const [gasGrade, setGasGrade] = useState<string>("");
  const [cylinderSize, setCylinderSize] = useState<string>("");
  const [pressure, setPressure] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [gasTypes, setGasTypes] = useState<GasType[]>([]);
  const [cylinderSizes, setCylinderSizes] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const fetchGasTypes = async () => {
      const { data } = await supabase
        .from("gas_types")
        .select("id, name, color")
        .eq("is_active", true)
        .order("name");
      if (data) setGasTypes(data);
    };
    
    const fetchCylinderSizes = async () => {
      const { data } = await supabase
        .from("cylinder_sizes")
        .select("id, name")
        .eq("is_active", true)
        .order("capacity_liters", { ascending: true });
      if (data) setCylinderSizes(data);
    };
    
    if (open) {
      fetchGasTypes();
      fetchCylinderSizes();
    }
  }, [open]);

  useEffect(() => {
    if (order && isEditing) {
      setStatus(order.status);
      setScheduledDate(parseISO(order.scheduled_date));
      setCylinderCount(order.cylinder_count.toString());
      setGasTypeId(order.gas_type_id || "");
      setGasGrade(order.gas_grade);
      setCylinderSize(order.cylinder_size);
      setPressure(order.pressure.toString());
      setNotes(order.notes || "");
    }
  }, [order, isEditing]);

  const startEditing = () => {
    if (order) {
      setStatus(order.status);
      setScheduledDate(parseISO(order.scheduled_date));
      setCylinderCount(order.cylinder_count.toString());
      setGasTypeId(order.gas_type_id || "");
      setGasGrade(order.gas_grade);
      setCylinderSize(order.cylinder_size);
      setPressure(order.pressure.toString());
      setNotes(order.notes || "");
    }
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setIsEditing(false);
  };

  // Map gas type name to enum value
  const mapGasTypeToEnum = (typeName: string): "co2" | "nitrogen" | "argon" | "acetylene" | "oxygen" | "helium" | "other" => {
    const mapping: Record<string, "co2" | "nitrogen" | "argon" | "acetylene" | "oxygen" | "helium" | "other"> = {
      "CO2": "co2",
      "co2": "co2",
      "Stikstof": "nitrogen",
      "stikstof": "nitrogen",
      "nitrogen": "nitrogen",
      "Argon": "argon",
      "argon": "argon",
      "Acetyleen": "acetylene",
      "acetyleen": "acetylene",
      "acetylene": "acetylene",
      "Zuurstof": "oxygen",
      "zuurstof": "oxygen",
      "oxygen": "oxygen",
      "Helium": "helium",
      "helium": "helium",
    };
    return mapping[typeName] || "other";
  };

  const handleSave = async () => {
    if (!order) return;

    const count = parseInt(cylinderCount);
    if (isNaN(count) || count <= 0) {
      toast.error("Vul een geldig aantal in");
      return;
    }

    const pressureValue = parseInt(pressure);
    if (isNaN(pressureValue) || (pressureValue !== 200 && pressureValue !== 300)) {
      toast.error("Druk moet 200 of 300 bar zijn");
      return;
    }

    setSaving(true);

    try {
      // Get the selected gas type to map to enum
      const selectedGasType = gasTypes.find(t => t.id === gasTypeId);
      const mappedGasType = selectedGasType ? mapGasTypeToEnum(selectedGasType.name) : order.gas_type;
      
      const { error } = await supabase
        .from("gas_cylinder_orders")
        .update({
          status: status as "pending" | "in_progress" | "completed" | "cancelled",
          scheduled_date: scheduledDate ? format(scheduledDate, "yyyy-MM-dd") : order.scheduled_date,
          cylinder_count: count,
          gas_type: mappedGasType as "co2" | "nitrogen" | "argon" | "acetylene" | "oxygen" | "helium" | "other",
          gas_type_id: gasTypeId || null,
          gas_grade: gasGrade as "medical" | "technical",
          cylinder_size: cylinderSize,
          pressure: pressureValue,
          notes: notes || null,
        })
        .eq("id", order.id);

      if (error) throw error;
      toast.success("Gascilinder order bijgewerkt");

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
        .from("gas_cylinder_orders")
        .delete()
        .eq("id", order.id);

      if (error) throw error;
      
      toast.success("Gascilinder order verwijderd");

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

  const gasTypeLabels: Record<string, string> = {
    co2: "CO₂",
    nitrogen: "Stikstof (N₂)",
    argon: "Argon",
    acetylene: "Acetyleen",
    oxygen: "Zuurstof",
    helium: "Helium",
    other: "Overig",
  };

  const getDisplayGasType = (orderData: GasCylinderOrder) => {
    // First priority: use gas_type_ref from joined data
    if (orderData.gas_type_ref?.name) {
      return orderData.gas_type_ref.name;
    }
    
    // Fallback: find matching gas type from loaded types
    if (orderData.gas_type_id) {
      const matchingType = gasTypes.find(gt => gt.id === orderData.gas_type_id);
      if (matchingType) {
        return matchingType.name;
      }
    }
    
    // Legacy fallback: check notes for "Gastype: Name" format
    if (orderData.notes) {
      const gasTypeMatch = orderData.notes.match(/^Gastype:\s*(.+?)(?:\n|$)/i);
      if (gasTypeMatch) {
        return gasTypeMatch[1].trim();
      }
    }
    
    // Final fallback to enum labels
    return gasTypeLabels[orderData.gas_type] || orderData.gas_type;
  };

  const getGasTypeColor = (orderData: GasCylinderOrder): string => {
    if (orderData.gas_type_ref?.color) {
      return orderData.gas_type_ref.color;
    }
    if (orderData.gas_type_id) {
      const matchingType = gasTypes.find(gt => gt.id === orderData.gas_type_id);
      if (matchingType) {
        return matchingType.color;
      }
    }
    return "#6b7280";
  };

  const gasGradeLabels: Record<string, string> = {
    medical: "Medisch",
    technical: "Technisch",
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Cylinder className="h-5 w-5 text-orange-500" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-lg">
                  {isEditing ? "Order bewerken" : "Gascilinder order"}
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
                    <Label>Gastype</Label>
                    <Select value={gasTypeId} onValueChange={setGasTypeId}>
                      <SelectTrigger className="bg-background">
                        <SelectValue placeholder="Selecteer gastype" />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        {gasTypes.map((type) => (
                          <SelectItem key={type.id} value={type.id}>
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
                    <Select value={gasGrade} onValueChange={setGasGrade}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="medical">Medisch</SelectItem>
                        <SelectItem value="technical">Technisch</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Aantal</Label>
                    <Input
                      type="number"
                      value={cylinderCount}
                      onChange={(e) => setCylinderCount(e.target.value)}
                      className="bg-background"
                      min="1"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Druk (bar)</Label>
                    <Select value={pressure} onValueChange={setPressure}>
                      <SelectTrigger className="bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-background border shadow-lg z-50">
                        <SelectItem value="200">200 bar</SelectItem>
                        <SelectItem value="300">300 bar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Grootte</Label>
                    <Input
                      value={cylinderSize}
                      onChange={(e) => setCylinderSize(e.target.value)}
                      className="bg-background"
                    />
                  </div>
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
                  <Badge variant="outline" className="text-sm">
                    {gasGradeLabels[order.gas_grade] || order.gas_grade}
                  </Badge>
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
                      <Hash className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Aantal</p>
                        <p className="font-medium">{formatNumber(order.cylinder_count, 0)} stuks</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <div 
                        className="w-3 h-3 rounded-full flex-shrink-0" 
                        style={{ backgroundColor: getGasTypeColor(order) }} 
                      />
                      <div>
                        <p className="text-xs text-muted-foreground">Gastype</p>
                        <p className="font-medium">{getDisplayGasType(order)}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                      <Gauge className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-xs text-muted-foreground">Druk</p>
                        <p className="font-medium">{order.pressure} bar</p>
                      </div>
                    </div>
                  </div>

                  {order.notes && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-xs text-muted-foreground">Opmerkingen</p>
                        <p className="text-sm whitespace-pre-wrap">{order.notes.replace(/^Gastype:\s*.+?\n?/i, '').trim() || order.notes}</p>
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
                {hasEditPermission && (
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
                {!hasEditPermission && (
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
