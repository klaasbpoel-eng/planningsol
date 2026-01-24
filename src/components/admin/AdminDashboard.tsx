import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { AdminRequestList } from "@/components/admin/AdminRequestList";
import { TeamCalendar } from "@/components/admin/TeamCalendar";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CalendarCheck, Clock, XCircle, Users, CalendarDays, ListChecks } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface RequestWithProfile extends TimeOffRequest {
  profiles?: Profile | null;
}

interface AdminDashboardProps {
  userEmail?: string;
  onSwitchView: () => void;
}

export function AdminDashboard({ userEmail, onSwitchView }: AdminDashboardProps) {
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      // Fetch requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("time_off_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (requestsError) throw requestsError;

      // Fetch profiles for all unique user IDs
      const userIds = [...new Set((requestsData || []).map(r => r.user_id))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);

      // Map profiles to requests
      const profilesMap = new Map((profilesData || []).map(p => [p.user_id, p]));
      const requestsWithProfiles = (requestsData || []).map(request => ({
        ...request,
        profiles: profilesMap.get(request.user_id) || null,
      }));

      setRequests(requestsWithProfiles);
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
    total: requests.length,
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
      <Header userEmail={userEmail} isAdmin onSwitchView={onSwitchView} />
      
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card className="shadow-md border-0 bg-primary/5">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-primary/10">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                <p className="text-sm text-muted-foreground">Total</p>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-md border-0 bg-warning/5">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{stats.pending}</p>
                <p className="text-sm text-muted-foreground">Pending</p>
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
                <p className="text-sm text-muted-foreground">Approved</p>
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
                <p className="text-sm text-muted-foreground">Rejected</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs for Requests and Calendar */}
        <Tabs defaultValue="requests" className="space-y-6">
          <TabsList className="bg-muted/50">
            <TabsTrigger value="requests" className="gap-2">
              <ListChecks className="h-4 w-4" />
              Requests
            </TabsTrigger>
            <TabsTrigger value="calendar" className="gap-2">
              <CalendarDays className="h-4 w-4" />
              Team Calendar
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="requests">
            <AdminRequestList requests={requests} onUpdate={fetchRequests} />
          </TabsContent>
          
          <TabsContent value="calendar">
            <TeamCalendar requests={requests} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
