import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { TimeOffRequestForm } from "@/components/time-off/TimeOffRequestForm";
import { TimeOffRequestList } from "@/components/time-off/TimeOffRequestList";
import { TimeOffCalendar } from "@/components/time-off/TimeOffCalendar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CalendarCheck, Clock, XCircle, Shield } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];

interface DashboardProps {
  userEmail?: string;
  isAdmin?: boolean;
  onSwitchToAdmin?: () => void;
}

export function Dashboard({ userEmail, isAdmin, onSwitchToAdmin }: DashboardProps) {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("time_off_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  const stats = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header userEmail={userEmail} />
      
      <main className="container mx-auto px-4 py-8">
        {/* Admin Switch Button */}
        {isAdmin && onSwitchToAdmin && (
          <div className="mb-6">
            <Button
              onClick={onSwitchToAdmin}
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
            >
              <Shield className="h-4 w-4 mr-2" />
              Naar Beheerderspaneel
            </Button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card className="shadow-md border-0 bg-warning/5">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">In behandeling</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md border-0 bg-success/5">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-success/10">
                <CalendarCheck className="h-6 w-6 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.approved}</p>
                <p className="text-sm text-muted-foreground">Goedgekeurd</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md border-0 bg-destructive/5">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-destructive/10">
                <XCircle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.rejected}</p>
                <p className="text-sm text-muted-foreground">Afgewezen</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <TimeOffRequestForm onSuccess={fetchRequests} />
            <TimeOffRequestList requests={requests} onDelete={fetchRequests} />
          </div>
          <div className="lg:col-span-1">
            <TimeOffCalendar requests={requests.filter((r) => r.status !== "rejected")} />
          </div>
        </div>
      </main>
    </div>
  );
}
