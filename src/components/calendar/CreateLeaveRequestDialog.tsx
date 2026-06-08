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
import { format, differenceInDays, addWeeks, addDays, getDay } from "date-fns";
import { nl } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TimeOffTypeRecord = Database["public"]["Tables"]["time_off_types"]["Row"];
type DayPart = "full_day" | "morning" | "afternoon" | "hours";
type RepeatMode = "none" | "weekly" | "biweekly";

const WEEKDAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const toMonIndex = (d: Date) => (getDay(d) + 6) % 7;
const MAX_OCCURRENCES = 60;

interface CreateLeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (requests?: any[]) => void;
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
  const [repeatMode, setRepeatMode] = useState<RepeatMode>("none");
  const [repeatDays, setRepeatDays] = useState<number[]>([]);
  const [seriesEndDate, setSeriesEndDate] = useState<Date | undefined>(undefined);

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
    if (repeatMode !== "none" && startDate) {
      if (repeatDays.length === 0) setRepeatDays([toMonIndex(startDate)]);
      if (!seriesEndDate) setSeriesEndDate(addWeeks(startDate, 4));
      setEndDate(startDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeatMode]);

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
    setRepeatMode("none");
    setRepeatDays([]);
    setSeriesEndDate(undefined);
  };

  const handleClose = () => {
    resetForm();
    onOpenChange(false);
  };

  const computeOccurrences = (): Date[] => {
    if (!startDate) return [];
    if (repeatMode === "none") return [startDate];
    if (!seriesEndDate || seriesEndDate < startDate || repeatDays.length === 0) return [];
    const step = repeatMode === "weekly" ? 1 : 2;
    const occ: Date[] = [];
    const startMon = addDays(startDate, -toMonIndex(startDate));
    let weekStart = startMon;
    while (weekStart <= seriesEndDate && occ.length <= MAX_OCCURRENCES) {
      for (const d of [...repeatDays].sort((a, b) => a - b)) {
        const candidate = addDays(weekStart, d);
        if (candidate >= startDate && candidate <= seriesEndDate) {
          occ.push(candidate);
        }
      }
      weekStart = addWeeks(weekStart, step);
    }
    return occ;
  };

  const occurrences = computeOccurrences();

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

    if (repeatMode !== "none") {
      if (repeatDays.length === 0) {
        toast.error("Selecteer minstens één weekdag voor de herhaling");
        return;
      }
      if (!seriesEndDate) {
        toast.error("Kies een einddatum voor de reeks");
        return;
      }
      if (occurrences.length === 0) {
        toast.error("Geen geldige datums in deze reeks");
        return;
      }
      if (occurrences.length > MAX_OCCURRENCES) {
        toast.error(`Reeks te groot (max ${MAX_OCCURRENCES} aanvragen)`);
        return;
      }
    }

    setSaving(true);

    try {
      // Use profile_id and type_id for the new schema
      // Admin-created requests are automatically approved
      const dayPartValue =
        dayPart === "full_day" ? "full_day" :
        dayPart === "hours" ? null :
        dayPart;

      // Prepend time range to reason when hours are specified
      const reasonValue = dayPart === "hours"
        ? `[${startTime}-${endTime}]${reason.trim() ? ` ${reason.trim()}` : ""}`
        : reason.trim() || null;

      const employeeName = isAdmin
        ? profiles.find(p => p.id === profileId)?.full_name || "Medewerker"
        : "Je";

      if (repeatMode === "none") {
        const createdRequest = await api.timeOffRequests.create({
          profile_id: profileId,
          type_id: typeId,
          start_date: format(startDate, "yyyy-MM-dd"),
          end_date: format(endDate, "yyyy-MM-dd"),
          reason: reasonValue,
          status: isAdmin ? 'approved' : 'pending',
          day_part: dayPartValue,
        });

        toast.success("Verlofaanvraag ingediend", {
          description: `${employeeName} verlof van ${format(startDate, "d MMM", { locale: nl })} t/m ${format(endDate, "d MMM", { locale: nl })}`,
        });

        resetForm();
        onCreate([createdRequest]);
        onOpenChange(false);
      } else {
        const seriesId = crypto.randomUUID();
        const rows = occurrences.map((d) => ({
          profile_id: profileId,
          type_id: typeId,
          start_date: format(d, "yyyy-MM-dd"),
          end_date: format(d, "yyyy-MM-dd"),
          reason: reasonValue,
          status: (isAdmin ? "approved" : "pending") as "approved" | "pending",
          day_part: dayPartValue,
          series_id: seriesId,
        }));

        const { data, error } = await supabase
          .from("time_off_requests")
          .insert(rows)
          .select();

        if (error) throw error;

        toast.success(`${rows.length} verlofaanvragen ingediend (reeks)`, {
          description: `${employeeName} — ${repeatMode === "weekly" ? "wekelijks" : "2-wekelijks"} t/m ${format(seriesEndDate!, "d MMM yyyy", { locale: nl })}`,
        });

        resetForm();
        onCreate(data || []);
        onOpenChange(false);
      }
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

  const isTimeInvalid = dayPart === "hours" && (() => {
    const [sh, sm] = startTime.split(":").map(Number);
    const [eh, em] = endTime.split(":").map(Number);
    return eh * 60 + em <= sh * 60 + sm;
  })();

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

          {/* Recurrence selector */}
          <div className="space-y-2">
            <Label>Herhaling</Label>
            <div className="flex rounded-lg border overflow-hidden divide-x text-sm">
              {(
                [
                  { value: "none", label: "Geen" },
                  { value: "weekly", label: "Wekelijks" },
                  { value: "biweekly", label: "2-wekelijks" },
                ] as { value: RepeatMode; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setRepeatMode(opt.value)}
                  className={cn(
                    "flex-1 py-2 font-medium transition-colors",
                    repeatMode === opt.value
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-muted text-muted-foreground"
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {repeatMode !== "none" && (
              <div className="space-y-3 pt-2">
                <div>
                  <Label className="text-xs text-muted-foreground">Dagen van de week</Label>
                  <div className="flex gap-1 mt-1">
                    {WEEKDAY_LABELS.map((lbl, idx) => {
                      const active = repeatDays.includes(idx);
                      return (
                        <button
                          key={lbl}
                          type="button"
                          onClick={() => {
                            setRepeatDays((prev) =>
                              prev.includes(idx)
                                ? prev.filter((d) => d !== idx)
                                : [...prev, idx]
                            );
                          }}
                          className={cn(
                            "flex-1 py-1.5 rounded-md border text-xs font-medium transition-colors",
                            active
                              ? "bg-primary text-primary-foreground border-primary"
                              : "border-border hover:bg-muted text-muted-foreground"
                          )}
                        >
                          {lbl}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-xs text-muted-foreground">Herhalen t/m</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full mt-1 justify-start text-left font-normal",
                          !seriesEndDate && "text-muted-foreground"
                        )}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {seriesEndDate
                          ? format(seriesEndDate, "d MMM yyyy", { locale: nl })
                          : "Selecteer einddatum reeks"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0 bg-background border shadow-lg z-50" align="start">
                      <Calendar
                        mode="single"
                        selected={seriesEndDate}
                        onSelect={setSeriesEndDate}
                        disabled={(date) => (startDate ? date < startDate : false)}
                        locale={nl}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {occurrences.length > 0 && (
                  <div className="text-xs p-2 rounded-md bg-muted/50 text-muted-foreground">
                    <span className="font-medium text-foreground">
                      Genereert {occurrences.length} {occurrences.length === 1 ? "aanvraag" : "aanvragen"}:
                    </span>{" "}
                    {occurrences.slice(0, 3).map((d) => format(d, "EEE d MMM", { locale: nl })).join(", ")}
                    {occurrences.length > 3 && ` … +${occurrences.length - 3} meer`}
                  </div>
                )}
                {occurrences.length > MAX_OCCURRENCES && (
                  <p className="text-xs text-destructive">Reeks te groot (max {MAX_OCCURRENCES})</p>
                )}
              </div>
            )}
          </div>

          {/* Day part selector - only for single day, not when repeating multi-day */}
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
                <div className="space-y-3 pt-1">
                  {/* Quick presets */}
                  <div className="flex gap-2">
                    {[
                      { label: "Ochtend", from: "08:00", to: "12:00" },
                      { label: "Middag", from: "12:00", to: "17:00" },
                      { label: "Volledig", from: "08:00", to: "17:00" },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => { setStartTime(preset.from); setEndTime(preset.to); }}
                        className={cn(
                          "flex-1 py-1.5 rounded-md border text-xs transition-colors",
                          startTime === preset.from && endTime === preset.to
                            ? "bg-primary/10 border-primary text-primary font-semibold"
                            : "border-border hover:bg-muted text-muted-foreground"
                        )}
                      >
                        {preset.label}
                        <span className="block opacity-60">{preset.from}–{preset.to}</span>
                      </button>
                    ))}
                  </div>

                  {/* Van → Tot inputs */}
                  <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Van</Label>
                      <div className={cn(
                        "flex items-center gap-2 border rounded-md px-3 py-2 bg-background transition-colors",
                        isTimeInvalid && "border-destructive"
                      )}>
                        <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                        <input
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          className="flex-1 bg-transparent text-sm outline-none"
                        />
                      </div>
                    </div>
                    <span className="text-muted-foreground pb-2.5 text-lg">→</span>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Tot</Label>
                      <div className={cn(
                        "flex items-center gap-2 border rounded-md px-3 py-2 bg-background transition-colors",
                        isTimeInvalid && "border-destructive"
                      )}>
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

                  {isTimeInvalid && (
                    <p className="text-xs text-destructive">Eindtijd moet na begintijd liggen</p>
                  )}
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
            disabled={
              saving ||
              !startDate ||
              !endDate ||
              !typeId ||
              (isAdmin && !selectedProfileId) ||
              isTimeInvalid ||
              (repeatMode !== "none" && (occurrences.length === 0 || occurrences.length > MAX_OCCURRENCES))
            }
          >
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Indienen..." : "Aanvraag indienen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}