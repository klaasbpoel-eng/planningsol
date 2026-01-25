import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Loader2, Plus, Edit } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TimeOffType = Database["public"]["Enums"]["time_off_type"];
type RequestStatus = Database["public"]["Enums"]["request_status"];

interface RequestWithProfile extends TimeOffRequest {
  profiles?: Profile | null;
}

interface RequestFormDialogProps {
  request: RequestWithProfile | null;
  employees: Profile[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: () => void;
  mode: "create" | "edit";
}

const initialFormData = {
  profile_id: "",
  type: "vacation" as TimeOffType,
  start_date: undefined as Date | undefined,
  end_date: undefined as Date | undefined,
  reason: "",
  status: "pending" as RequestStatus,
};

export function RequestFormDialog({
  request,
  employees,
  open,
  onOpenChange,
  onUpdate,
  mode,
}: RequestFormDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState(initialFormData);

  const isCreateMode = mode === "create";

  useEffect(() => {
    if (open) {
      if (isCreateMode) {
        setFormData(initialFormData);
      } else if (request) {
        // Use profile_id for new schema, fall back to finding profile by user_id for old data
        const profileId = (request as any).profile_id || 
          employees.find(e => e.user_id === request.user_id)?.id || "";
        setFormData({
          profile_id: profileId,
          type: request.type,
          start_date: new Date(request.start_date),
          end_date: new Date(request.end_date),
          reason: request.reason || "",
          status: request.status,
        });
      }
    }
  }, [request, open, isCreateMode, employees]);

  const handleSave = async () => {
    if (!formData.start_date || !formData.end_date) {
      toast.error("Selecteer begin- en einddatum");
      return;
    }

    if (isCreateMode && !formData.profile_id) {
      toast.error("Selecteer een medewerker");
      return;
    }

    if (formData.end_date < formData.start_date) {
      toast.error("Einddatum moet na begindatum liggen");
      return;
    }

    setSaving(true);
    try {
      if (isCreateMode) {
        const { error } = await supabase.from("time_off_requests").insert({
          profile_id: formData.profile_id,
          type: formData.type,
          start_date: format(formData.start_date, "yyyy-MM-dd"),
          end_date: format(formData.end_date, "yyyy-MM-dd"),
          reason: formData.reason || null,
          status: formData.status,
        } as any);

        if (error) throw error;
        toast.success("Aanvraag succesvol aangemaakt");
      } else {
        if (!request) return;

        const { error } = await supabase
          .from("time_off_requests")
          .update({
            type: formData.type,
            start_date: format(formData.start_date, "yyyy-MM-dd"),
            end_date: format(formData.end_date, "yyyy-MM-dd"),
            reason: formData.reason || null,
            status: formData.status,
          })
          .eq("id", request.id);

        if (error) throw error;
        toast.success("Aanvraag succesvol bijgewerkt");
      }

      onUpdate();
      onOpenChange(false);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSaving(false);
    }
  };

  const days =
    formData.start_date && formData.end_date
      ? differenceInDays(formData.end_date, formData.start_date) + 1
      : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isCreateMode ? (
              <>
                <Plus className="h-5 w-5" />
                Verlofaanvraag Maken
              </>
            ) : (
              <>
                <Edit className="h-5 w-5" />
                Verlofaanvraag Bewerken
              </>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Employee selector (only for create mode) */}
          {isCreateMode && (
            <div className="space-y-2">
              <Label>
                Medewerker <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.profile_id}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, profile_id: value }))
                }
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecteer medewerker" />
                </SelectTrigger>
                <SelectContent className="bg-popover z-50">
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {emp.full_name || emp.email || "Onbekend"}
                      {!emp.user_id && (
                        <span className="ml-2 text-xs text-muted-foreground">(geen account)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Show employee name in edit mode */}
          {!isCreateMode && request?.profiles && (
            <div className="space-y-2">
              <Label>Medewerker</Label>
              <div className="p-2 bg-muted rounded-md text-sm">
                {request.profiles.full_name || request.profiles.email || "Onbekend"}
              </div>
            </div>
          )}

          {/* Type selector */}
          <div className="space-y-2">
            <Label>Verloftype</Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, type: value as TimeOffType }))
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="vacation">Vakantie</SelectItem>
                <SelectItem value="sick">Ziekteverlof</SelectItem>
                <SelectItem value="personal">Persoonlijk</SelectItem>
                <SelectItem value="other">Overig</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Date pickers */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>
                Begindatum <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.start_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.start_date
                      ? format(formData.start_date, "d MMM yyyy")
                      : "Selecteer datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.start_date}
                    onSelect={(date) =>
                      setFormData((prev) => ({
                        ...prev,
                        start_date: date,
                        end_date:
                          prev.end_date && date && prev.end_date < date
                            ? date
                            : prev.end_date,
                      }))
                    }
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>
                Einddatum <span className="text-destructive">*</span>
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.end_date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.end_date
                      ? format(formData.end_date, "d MMM yyyy")
                      : "Selecteer datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 z-50 bg-popover" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.end_date}
                    onSelect={(date) =>
                      setFormData((prev) => ({ ...prev, end_date: date }))
                    }
                    disabled={(date) =>
                      formData.start_date ? date < formData.start_date : false
                    }
                    initialFocus
                    className="pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {days > 0 && (
            <div className="text-sm text-muted-foreground">
              Duur: {days} dag{days !== 1 ? "en" : ""}
            </div>
          )}

          {/* Status selector */}
          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) =>
                setFormData((prev) => ({ ...prev, status: value as RequestStatus }))
              }
            >
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-popover z-50">
                <SelectItem value="pending">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-warning" />
                    In behandeling
                  </div>
                </SelectItem>
                <SelectItem value="approved">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-success" />
                    Goedgekeurd
                  </div>
                </SelectItem>
                <SelectItem value="rejected">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-destructive" />
                    Afgewezen
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <Label>Reden (optioneel)</Label>
            <Textarea
              value={formData.reason}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, reason: e.target.value }))
              }
              placeholder="Voer reden voor verlof in..."
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuleren
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isCreateMode ? "Aanvraag Maken" : "Wijzigingen Opslaan"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
