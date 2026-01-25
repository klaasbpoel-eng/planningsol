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
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];
type TimeOffType = Database["public"]["Enums"]["time_off_type"];
type TimeOffTypeRecord = Database["public"]["Tables"]["time_off_types"]["Row"];

interface CreateLeaveRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: () => void;
  initialDate?: Date;
  profiles: Profile[];
  currentUserId?: string;
  isAdmin: boolean;
}

// Fallback types if no dynamic types exist in the database
const defaultTimeOffTypes: { value: TimeOffType; label: string; color: string }[] = [
  { value: "vacation", label: "Vakantie", color: "hsl(var(--primary))" },
  { value: "sick", label: "Ziekteverlof", color: "hsl(var(--destructive))" },
  { value: "personal", label: "Persoonlijk", color: "hsl(var(--accent))" },
  { value: "other", label: "Overig", color: "hsl(var(--muted-foreground))" },
];

export function CreateLeaveRequestDialog({
  open,
  onOpenChange,
  onCreate,
  initialDate,
  profiles,
  currentUserId,
  isAdmin,
}: CreateLeaveRequestDialogProps) {
  const [saving, setSaving] = useState(false);
  const [startDate, setStartDate] = useState<Date | undefined>(initialDate);
  const [endDate, setEndDate] = useState<Date | undefined>(initialDate);
  const [type, setType] = useState<TimeOffType>("vacation");
  const [reason, setReason] = useState("");
  const [selectedUserId, setSelectedUserId] = useState(currentUserId || "");
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
    if (currentUserId && !selectedUserId) {
      setSelectedUserId(currentUserId);
    }
  }, [currentUserId, selectedUserId]);

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

  // Map dynamic leave types to the expected format, or use defaults
  const availableTypes = leaveTypes.length > 0
    ? leaveTypes.map((lt) => ({
        value: lt.name.toLowerCase() as TimeOffType,
        label: lt.name,
        color: lt.color,
        dbName: lt.name,
      }))
    : defaultTimeOffTypes.map((t) => ({ ...t, dbName: t.label }));

  const resetForm = () => {
    setStartDate(initialDate);
    setEndDate(initialDate);
    setType("vacation");
    setReason("");
    setSelectedUserId(currentUserId || "");
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

    const userId = isAdmin ? selectedUserId : currentUserId;
    if (!userId) {
      toast.error("Geen gebruiker geselecteerd");
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.from("time_off_requests").insert({
        user_id: userId,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        type,
        reason: reason.trim() || null,
      });

      if (error) throw error;

      const employeeName = isAdmin 
        ? profiles.find(p => p.user_id === userId)?.full_name || "Medewerker"
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
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Selecteer medewerker" />
                </SelectTrigger>
                <SelectContent className="bg-background border shadow-lg z-50">
                  {profiles
                    .filter((profile) => profile.user_id)
                    .map((profile) => (
                      <SelectItem
                        key={profile.user_id}
                        value={profile.user_id!}
                      >
                        {profile.full_name || profile.email?.split("@")[0]}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Type selector with dynamic leave types */}
          <div className="space-y-2">
            <Label>Type verlof</Label>
            <Select value={type} onValueChange={(v) => setType(v as TimeOffType)}>
              <SelectTrigger className="bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {availableTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    <div className="flex items-center gap-2">
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: t.color }}
                      />
                      {t.label}
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
            disabled={saving || !startDate || !endDate || (isAdmin && !selectedUserId)}
          >
            <Plus className="h-4 w-4 mr-2" />
            {saving ? "Indienen..." : "Aanvraag indienen"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}