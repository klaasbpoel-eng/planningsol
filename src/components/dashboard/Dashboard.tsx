import { useEffect, useState } from "react";
import { Header } from "@/components/layout/Header";
import { TimeOffRequestForm } from "@/components/time-off/TimeOffRequestForm";
import { TimeOffRequestList } from "@/components/time-off/TimeOffRequestList";
import { TimeOffCalendar } from "@/components/time-off/TimeOffCalendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CalendarCheck, Clock, XCircle, Shield, ListTodo, CircleDot, PlayCircle, CheckCircle2 } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Task = Database["public"]["Tables"]["tasks"]["Row"];

interface DashboardProps {
  userEmail?: string;
  isAdmin?: boolean;
  onSwitchToAdmin?: () => void;
}

export function Dashboard({ userEmail, isAdmin, onSwitchToAdmin }: DashboardProps) {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch time off requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("time_off_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (requestsError) throw requestsError;
      setRequests(requestsData || []);

      // Fetch tasks assigned to the user
      const { data: tasksData, error: tasksError } = await supabase
        .from("tasks")
        .select("*")
        .eq("assigned_to", user.id);

      if (tasksError) throw tasksError;
      setTasks(tasksData || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const requestStats = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  };

  const taskStats = {
    total: tasks.length,
    pending: tasks.filter((t) => t.status === "pending").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    completed: tasks.filter((t) => t.status === "completed").length,
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

        {/* Time Off Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <Card className="shadow-md border-0 bg-warning/5">
            <CardContent className="pt-6 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-warning/10">
                <Clock className="h-6 w-6 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{requestStats.pending}</p>
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
                <p className="text-2xl font-bold text-foreground">{requestStats.approved}</p>
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
                <p className="text-2xl font-bold text-foreground">{requestStats.rejected}</p>
                <p className="text-sm text-muted-foreground">Afgewezen</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Task Stats */}
        <Card className="shadow-md border-0 mb-8">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-primary" />
              Mijn Taken
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-primary/10">
                  <ListTodo className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{taskStats.total}</p>
                  <p className="text-xs text-muted-foreground">Totaal</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-warning/10">
                  <CircleDot className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{taskStats.pending}</p>
                  <p className="text-xs text-muted-foreground">Te doen</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <PlayCircle className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{taskStats.in_progress}</p>
                  <p className="text-xs text-muted-foreground">Bezig</p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <div className="p-2 rounded-lg bg-success/10">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-xl font-bold text-foreground">{taskStats.completed}</p>
                  <p className="text-xs text-muted-foreground">Afgerond</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <TimeOffRequestForm onSuccess={fetchData} />
            <TimeOffRequestList requests={requests} onDelete={fetchData} />
          </div>
          <div className="lg:col-span-1">
            <TimeOffCalendar requests={requests.filter((r) => r.status !== "rejected")} />
          </div>
        </div>
      </main>
    </div>
  );
}
