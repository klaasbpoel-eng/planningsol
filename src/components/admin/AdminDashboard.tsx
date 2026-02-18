import { useEffect, useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { AdminRequestList } from "@/components/admin/AdminRequestList";
import { TeamCalendar } from "@/components/admin/TeamCalendar";
import { EmployeeList } from "@/components/admin/EmployeeList";
import { TaskList } from "@/components/admin/TaskList";
import { AdminFilters, FilterState } from "@/components/admin/AdminFilters";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { ToolboxLogbook } from "@/components/admin/ToolboxLogbook";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CalendarCheck, Clock, XCircle, Users, CalendarDays, ListChecks, UserCog, ClipboardList, Settings, BookOpen } from "lucide-react";
import { parseISO, isWithinInterval, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import type { RolePermissions, AppRole } from "@/hooks/useUserPermissions";
import { useIsMobile } from "@/hooks/use-mobile";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

interface RequestWithProfile extends TimeOffRequest {
  profiles?: Profile | null;
}

interface AdminDashboardProps {
  userEmail?: string;
  onSwitchView: () => void;
  permissions?: RolePermissions;
  role?: AppRole;
}

export function AdminDashboard({ userEmail, onSwitchView, permissions, role }: AdminDashboardProps) {
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("requests");
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<FilterState>({
    employeeId: null,
    status: "all",
    startDate: undefined,
    endDate: undefined,
  });

  const fetchRequests = async () => {
    try {
      // Fetch requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("time_off_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (requestsError) throw requestsError;

      // Fetch profiles - use profile_id for new schema, fall back to user_id
      const requestsAny = requestsData as any[];
      const profileIds = [...new Set(requestsAny.filter(r => r.profile_id).map(r => r.profile_id))];
      const userIds = [...new Set((requestsData || []).filter(r => r.user_id).map(r => r.user_id))];

      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*");

      // Map profiles to requests - try profile_id first, then user_id
      const profilesById = new Map((profilesData || []).map(p => [p.id, p]));
      const profilesByUserId = new Map((profilesData || []).map(p => [p.user_id, p]));

      const requestsWithProfiles = (requestsData || []).map(request => {
        const requestAny = request as any;
        const profile = requestAny.profile_id
          ? profilesById.get(requestAny.profile_id)
          : profilesByUserId.get(request.user_id) || null;
        return {
          ...request,
          profiles: profile || null,
        };
      });

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

  // Get unique employees from requests
  const employees = useMemo(() => {
    const uniqueProfiles = new Map<string, Profile>();
    requests.forEach(r => {
      if (r.profiles && !uniqueProfiles.has(r.profiles.id)) {
        uniqueProfiles.set(r.profiles.id, r.profiles);
      }
    });
    return Array.from(uniqueProfiles.values());
  }, [requests]);

  // Filter requests
  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      // Filter by employee (using profile_id)
      const requestAny = request as any;
      const profileId = requestAny.profile_id || request.profiles?.id;
      if (filters.employeeId && profileId !== filters.employeeId) {
        return false;
      }

      // Filter by status
      if (filters.status !== "all" && request.status !== filters.status) {
        return false;
      }

      // Filter by date range
      const requestStart = parseISO(request.start_date);
      const requestEnd = parseISO(request.end_date);

      if (filters.startDate) {
        // Request end date must be on or after filter start date
        if (isBefore(requestEnd, startOfDay(filters.startDate))) {
          return false;
        }
      }

      if (filters.endDate) {
        // Request start date must be on or before filter end date
        if (isAfter(requestStart, endOfDay(filters.endDate))) {
          return false;
        }
      }

      return true;
    });
  }, [requests, filters]);

  const stats = {
    pending: filteredRequests.filter((r) => r.status === "pending").length,
    approved: filteredRequests.filter((r) => r.status === "approved").length,
    rejected: filteredRequests.filter((r) => r.status === "rejected").length,
    total: filteredRequests.length,
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
      <Header userEmail={userEmail} isAdmin onSwitchView={onSwitchView} role={role} />

      <main className="w-full px-[1%] md:px-[10%] py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Beheerpaneel</h1>
          <p className="text-muted-foreground">Beheer goedkeuringen, personeel en instellingen.</p>
        </div>

        {/* Filters and Stats - Hide when in Settings */}
        {activeTab !== 'settings' && (
          <>
            {/* Filters */}
            <AdminFilters
              employees={employees}
              filters={filters}
              onFiltersChange={setFilters}
            />

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              <Card className="shadow-md border-0 bg-primary/5">
                <CardContent className="pt-6 flex items-center gap-4">
                  <div className="p-3 rounded-xl bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                    <p className="text-sm text-muted-foreground">Totaal</p>
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
          </>
        )}

        {/* Tabs for Requests and Calendar */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          {/* Mobile: Use dropdown for tab selection */}
          {isMobile ? (
            <Select value={activeTab} onValueChange={setActiveTab}>
              <SelectTrigger className="w-full bg-muted/50 h-11">
                <SelectValue placeholder="Selecteer weergave" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="requests">
                  <div className="flex items-center gap-2">
                    <ListChecks className="h-4 w-4" />
                    Aanvragen
                  </div>
                </SelectItem>
                <SelectItem value="tasks">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-4 w-4" />
                    Taken
                  </div>
                </SelectItem>
                <SelectItem value="calendar">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4" />
                    Teamkalender
                  </div>
                </SelectItem>
                <SelectItem value="logbook">
                  <div className="flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    Toolbox Logboek
                  </div>
                </SelectItem>
                <SelectItem value="employees">
                  <div className="flex items-center gap-2">
                    <UserCog className="h-4 w-4" />
                    Medewerkers
                  </div>
                </SelectItem>
                <SelectItem value="settings">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4" />
                    Instellingen
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <TabsList className="bg-muted/50">
              <TabsTrigger value="requests" className="gap-2">
                <ListChecks className="h-4 w-4" />
                Aanvragen
              </TabsTrigger>
              <TabsTrigger value="tasks" className="gap-2">
                <ClipboardList className="h-4 w-4" />
                Taken
              </TabsTrigger>
              <TabsTrigger value="calendar" className="gap-2">
                <CalendarDays className="h-4 w-4" />
                Teamkalender
              </TabsTrigger>
              <TabsTrigger value="logbook" className="gap-2">
                <BookOpen className="h-4 w-4" />
                Toolbox Logboek
              </TabsTrigger>
              <TabsTrigger value="employees" className="gap-2">
                <UserCog className="h-4 w-4" />
                Medewerkers
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-2">
                <Settings className="h-4 w-4" />
                Instellingen
              </TabsTrigger>
            </TabsList>
          )}

          <TabsContent value="requests">
            <AdminRequestList requests={filteredRequests} onUpdate={fetchRequests} />
          </TabsContent>

          <TabsContent value="tasks">
            <TaskList />
          </TabsContent>

          <TabsContent value="calendar">
            <TeamCalendar requests={filteredRequests} />
          </TabsContent>

          <TabsContent value="logbook">
            <ToolboxLogbook />
          </TabsContent>

          <TabsContent value="employees">
            <EmployeeList />
          </TabsContent>

          <TabsContent value="settings">
            <AdminSettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
