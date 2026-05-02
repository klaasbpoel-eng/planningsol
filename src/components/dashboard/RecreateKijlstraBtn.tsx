import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Ambulance } from "lucide-react";
import { addDays, format, getDay, addWeeks } from "date-fns";

export function RecreateKijlstraBtn() {
  const [loading, setLoading] = useState(false);

  const handleRecreate = async () => {
    setLoading(true);
    try {
      // 1. Get current logged in user profile ID
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Niet ingelogd");
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .single();
        
      if (!profile) throw new Error("Geen profiel gevonden");

      // 2. Find next Friday
      const today = new Date();
      // getDay() -> 0 = Sun, 1 = Mon... 5 = Fri
      const daysUntilFriday = (5 + 7 - today.getDay()) % 7;
      let nextFriday = addDays(today, daysUntilFriday === 0 ? 7 : daysUntilFriday);

      // 3. Generate 52 weeks of dates
      const dates = [];
      for (let i = 0; i < 52; i++) {
        dates.push(addWeeks(nextFriday, i));
      }

      const seriesId = crypto.randomUUID();
      let created = 0;

      for (const d of dates) {
        const { data: trip, error: tripError } = await supabase
          .from("ambulance_trips")
          .insert({
            scheduled_date: format(d, "yyyy-MM-dd"),
            cylinders_2l_300_o2: 0,
            cylinders_2l_200_o2: 0,
            cylinders_1l_pindex_o2: 0,
            cylinders_5l_o2_integrated: 0,
            model_5l: "any",
            cylinders_10l_o2_integrated: 0,
            cylinders_5l_air_integrated: 0,
            cylinders_2l_air_integrated: 0,
            created_by: profile.id,
            notes: "Automatisch ingepland (Aantallen nog in te vullen)",
            series_id: seriesId,
          })
          .select()
          .single();

        if (tripError) {
          console.error("Trip insert error:", tripError);
          continue;
        }

        if (trip) {
          const { error: custError } = await supabase
            .from("ambulance_trip_customers")
            .insert({
              trip_id: trip.id,
              customer_number: "KIJLSTRA",
              customer_name: "Kijlstra Ambulancezorg",
            });
            
          if (!custError) {
             created++;
          }
        }
      }

      if (created > 0) {
        toast.success(`${created} ritten voor Kijlstra succesvol ingepland! Klik op Vernieuwen/F5.`);
      } else {
        toast.error("Geen ritten aangemaakt.");
      }
    } catch (err: any) {
      console.error(err);
      toast.error("Fout tijdens aanmaken: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button 
      onClick={handleRecreate} 
      disabled={loading}
      variant="outline"
      className="bg-red-50 text-red-600 border-red-200 hover:bg-red-100 hover:text-red-700"
    >
      <Ambulance className="w-4 h-4 mr-2" />
      {loading ? "Bezig..." : "Herstel Kijlstra Vrijdag Rit (1 jaar)"}
    </Button>
  );
}
