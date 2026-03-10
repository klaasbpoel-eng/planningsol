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
import { CalendarDays, Clock, Palmtree, Plus } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TimeOffTypeRecord = Database["public"]["Tables"]["time_off_types"]["Row"];
type DayPart = "full_day" | "morning" | "afternoon" | "hours";

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
  const [dayPart, setDayPart] = useState<DayPart>("full_day");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");

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

  // Reset to full day when a multi-day period is selected
  useEffect(() => {
    if (startDate && endDate && differenceInDays(endDate, startDate) > 0) {
      setDayPart("full_day");
    }
  }, [startDate, endDate]);

  const resetForm = () => {
    setStartDate(initialDate);
    setEndDate(initialDate);
    setTypeId(leaveTypes.length > 0 ? leaveTypes[0].id : "");
    setReason("");
    setSelectedProfileId(currentProfileId || "");
    setDayPart("full_day");
    setStartTime("09:00");
    setEndTime("17:00");
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
      const dayPartValue =
        dayPart === "full_day" ? "full_day" :
        dayPart === "hours" ? `${startTime}-${endTime}` :
        dayPart;

      await api.timeOffRequests.create({
        profile_id: profileId,
        type_id: typeId,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        reason: reason.trim() || null,
        status: isAdmin ? 'approved' : 'pending',
        day_part: dayPartValue,
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

  const isSingleDay = startDate && endDate && differenceInDays(endDate, startDate) === 0;

  const getDurationDisplay = () => {
    if (!startDate || !endDate) return null;
    if (dayPart === "morning" || dayPart === "afternoon") return "0,5 dag";
    if (dayPart === "full_day" || !dayPart) {
      const days = differenceInDays(endDate, startDate) + 1;
      return `${days} ${days === 1 ? "dag" : "dagen"}`;
    }
    if (dayPart === "hours") {
      const [sh, sm] = startTime.split(":").map(Number);
      const [eh, em] = endTime.split(":").map(Number);
      const totalMinutes = eh * 60 + em - (sh * 60 + sm);
      if (totalMinutes <= 0) return null;
      const h = Math.floor(totalMinutes / 60);
      const m = totalMinutes % 60;
      return m > 0 ? `${h} uur ${m} min` : `${h} uur`;
    }
    return null;
  };

  const durationDisplay = getDurationDisplay();

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

          {/* Day part selector - only for single day */}
          {isSingleDay && (
            <div className="space-y-2">
              <Label>Dagdeel</Label>
              <div className="flex rounded-lg border overflow-hidden divide-x text-sm">
                {(
                  [
                    { value: "full_day", label: "Hele dag" },
                    { value: "morning", label: "Eerste helft" },
                    { value: "afternoon", label: "Laatste helft" },
                    { value: "hours", label: "Uren" },
                  ] as { value: DayPart; label: string }[]
                ).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setDayPart(opt.value)}
                    className={cn(
                      "flex-1 py-2 font-medium transition-colors",
                      dayPart === opt.value
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Time inputs for custom hours */}
              {dayPart === "hours" && (
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Van</Label>
                    <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <input
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Tot</Label>
                    <div className="flex items-center gap-2 border rounded-md px-3 py-2 bg-background">
                      <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                      <input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="flex-1 bg-transparent text-sm outline-none"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Duration display */}
          {durationDisplay && (
            <div className="p-3 rounded-lg bg-muted/50 text-center">
              <span className="text-sm text-muted-foreground">Duur: </span>
              <span className="font-semibold text-foreground">{durationDisplay}</span>
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