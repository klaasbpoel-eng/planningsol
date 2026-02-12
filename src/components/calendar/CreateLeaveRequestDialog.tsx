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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarDays, Palmtree, Plus } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TimeOffTypeRecord = Database["public"]["Tables"]["time_off_types"]["Row"];

interface CreateLeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
  initialDate?: Date;
  profiles: Profile[];
  currentUserId?: string;
  currentProfileId?: string;
  isAdmin: boolean;
}

export function CreateLeaveRequestDialog({
  open,
  onOpenChange,
  onCreate,
  initialDate,
  profiles,
  currentUserId,
  currentProfileId,
  isAdmin,
}: CreateLeaveRequestDialogProps) {
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(initialDate);
  const [endDate, setEndDate] = useState<Date | undefined>(initialDate);
  const [typeId, setTypeId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [selectedProfileId, setSelectedProfileId] = useState(currentProfileId || "");
  const [leaveTypes, setLeaveTypes] = useState<TimeOffTypeRecord[]>([]);

  useEffect(() => {
    if (open) {
      fetchLeaveTypes();
    }
  }, [open]);

  useEffect(() => {
    if (initialDate) {
      setStartDate(initialDate);
      setEndDate(initialDate);
    }
  }, [initialDate]);

  useEffect(() => {
    if (currentProfileId && !selectedProfileId) {
      setSelectedProfileId(currentProfileId);
    }
  }, [currentProfileId, selectedProfileId]);

  const fetchLeaveTypes = async () => {
    const { data, error } = await supabase
      .from("time_off_types")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setLeaveTypes(data);
    }
  };

  // Set default type when leave types are loaded
  useEffect(() => {
    if (leaveTypes.length > 0 && !typeId) {
      setTypeId(leaveTypes[0].id);
    }
  }, [leaveTypes, typeId]);

  const resetForm = () => {
    setStartDate(initialDate);
    setEndDate(initialDate);
    setTypeId(leaveTypes.length > 0 ? leaveTypes[0].id : "");
    setReason("");
    setSelectedProfileId(currentProfileId || "");
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleCreate = async () => {
    if (!startDate || !endDate) {
      toast.error("Selecteer zowel begin- als einddatum");
      return;
    }

    if (endDate < startDate) {
      toast.error("Einddatum moet na begindatum liggen");
      return;
    }

    const profileId = isAdmin ? selectedProfileId : currentProfileId;
    if (!profileId) {
      toast.error("Geen medewerker geselecteerd");
      return;
    }

    setSaving(true);

    try {
      // Use profile_id and type_id for the new schema
      // Admin-created requests are automatically approved
      await api.timeOffRequests.create({
        profile_id: profileId,
        type_id: typeId,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        reason: reason.trim() || null,
        status: isAdmin ? 'approved' : 'pending',
      });

      const employeeName = isAdmin
        ? profiles.find(p => p.id === profileId)?.full_name || "Medewerker"
        : "Je";

      toast.success("Verlofaanvraag ingediend", {
        description: `${employeeName} verlof van ${format(startDate, "d MMM", { locale: nl })} t/m ${format(endDate, "d MMM", { locale: nl })}`,
      });

      resetForm();
      onCreate();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating leave request:", error);
      toast.error("Fout bij indienen aanvraag", {
        description: "Probeer het opnieuw",
      });
    } finally {
      setSaving(false);
    }
  };

  const duration = startDate && endDate
    ? differenceInDays(endDate, startDate) + 1
    : 0;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Palmtree className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-lg">Nieuwe verlofaanvraag</DialogTitle>
              <DialogDescription>
                {isAdmin
                  ? "Maak een verlofaanvraag aan voor een medewerker"
                  : "Dien een nieuwe verlofaanvraag in"
                }
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Employee selector - only for admins */}
          {isAdmin && (
            <div className="space-y-2">
              <Label>
                Medewerker <span className="text-destructive">*</span>
              </Label>
              <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecteer medewerker" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {profiles.map((profile) => (
                    <SelectItem
                      key={profile.id}
                      value={profile.id}
                    >
                      {profile.full_name || profile.email?.split("@")[0]}
                      {!profile.user_id && (
                        <span className="ml-2 text-xs text-muted-foreground">(geen account)</span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Type selector with dynamic leave types */}
          <div className="space-y-2">
            <Label>Type verlof</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger className="bg-background">
                <SelectValue placeholder="Selecteer type" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {leaveTypes.map((lt) => (
                  <SelectItem key={lt.id} value={lt.id}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: lt.color }}
                      />
                      {lt.name}
                    </div>
                  </SelectItem>
                ))}
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
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {startDate
                      ? format(startDate, "d MMM yyyy", { locale: nl })
                      : "Selecteer datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 bg-background border shadow-lg z-50"
                  align="start"
                >
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(date) => {
                      setStartDate(date);
                      // Auto-adjust end date if it's before start date
                      if (date && endDate && endDate < date) {
                        setEndDate(date);
                      }
                    }}
                    locale={nl}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
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
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarDays className="mr-2 h-4 w-4" />
                    {endDate
                      ? format(endDate, "d MMM yyyy", { locale: nl })
                      : "Selecteer datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-auto p-0 bg-background border shadow-lg z-50"
                  align="start"
                >
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => startDate ? date < startDate : false}
                    locale={nl}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Duration display */}
          {duration > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <span className="text-sm text-muted-foreground">Duur: </span>
              <span className="font-semibold text-foreground">
                {duration} {duration === 1 ? "dag" : "dagen"}
              </span>
            </div>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">Reden (optioneel)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Voeg eventuele notities of details toe..."
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
            disabled={saving || !startDate || !endDate || !typeId || (isAdmin && !selectedProfileId)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Indienen..." : "Aanvraag indienen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}