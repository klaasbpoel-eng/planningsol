import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarIcon, Loader2, PlusCircle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type TimeOffTypeRecord = Database["public"]["Tables"]["time_off_types"]["Row"];

interface TimeOffRequestFormProps {
  onSuccess: () => void;
}

export function TimeOffRequestForm({ onSuccess }: TimeOffRequestFormProps) {
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [typeId, setTypeId] = useState<string>("");
  const [dayPart, setDayPart] = useState<"morning" | "afternoon" | "full_day">("full_day");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState<TimeOffTypeRecord[]>([]);

  useEffect(() => {
    fetchLeaveTypes();
  }, []);

  const fetchLeaveTypes = async () => {
    const { data, error } = await supabase
      .from("time_off_types")
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (!error && data) {
      setLeaveTypes(data);
      if (data.length > 0 && !typeId) {
        setTypeId(data[0].id);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!startDate || !endDate) {
      toast.error("Selecteer zowel begin- als einddatum");
      return;
    }

    if (!typeId) {
      toast.error("Selecteer een verloftype");
      return;
    }

    if (endDate < startDate) {
      toast.error("Einddatum moet na begindatum liggen");
      return;
    }

    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      // Get the profile for the current user
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
      
      if (profileError || !profile) throw new Error("Profiel niet gevonden");

      const { error } = await supabase.from("time_off_requests").insert({
        profile_id: profile.id,
        start_date: format(startDate, "yyyy-MM-dd"),
        end_date: format(endDate, "yyyy-MM-dd"),
        type_id: typeId,
        day_part: dayPart,
        reason: reason.trim() || null,
      } as any);

      if (error) throw error;

      toast.success("Verlofaanvraag ingediend!");
      setStartDate(undefined);
      setEndDate(undefined);
      setTypeId(leaveTypes.length > 0 ? leaveTypes[0].id : "");
      setDayPart("full_day");
      setReason("");
      onSuccess();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const dayPartOptions = [
    { value: "full_day", label: "Hele dag" },
    { value: "morning", label: "Ochtend (tot 12:00)" },
    { value: "afternoon", label: "Middag (vanaf 12:00)" },
  ];

  return (
    <Card className="shadow-lg border-0">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <PlusCircle className="h-5 w-5 text-accent" />
          Verlof Aanvragen
        </CardTitle>
        <CardDescription>Dien een nieuwe verlofaanvraag in</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Begindatum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "PPP") : "Selecteer datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    disabled={(date) => date < new Date()}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Einddatum</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal h-11",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Selecteer datum"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    disabled={(date) => date < (startDate || new Date())}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Type verlof</Label>
            <Select value={typeId} onValueChange={setTypeId}>
              <SelectTrigger className="h-11">
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

          <div className="space-y-2">
            <Label>Dagdeel</Label>
            <Select value={dayPart} onValueChange={(v) => setDayPart(v as "morning" | "afternoon" | "full_day")}>
              <SelectTrigger className="h-11">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dayPartOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Reden (optioneel)</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Voeg eventuele notities of details toe..."
              rows={3}
              className="resize-none"
            />
          </div>

          <Button
            type="submit"
            className="w-full h-11 bg-accent hover:bg-accent/90 text-accent-foreground"
            disabled={loading || !typeId}
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Aanvraag Indienen
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
