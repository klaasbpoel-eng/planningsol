import { useEffect, useState, useMemo } from "react";
import { Header } from "@/components/layout/Header";
import { AdminRequestsPage } from "@/components/admin/pages/AdminRequestsPage";
import { TeamCalendar } from "@/components/admin/TeamCalendar";
import { EmployeeList } from "@/components/admin/EmployeeList";
import { TaskList } from "@/components/admin/TaskList";
import { FilterState } from "@/components/admin/AdminFilters";
import { AdminSettings } from "@/components/admin/AdminSettings";
import { ToolboxLogbook } from "@/components/admin/ToolboxLogbook";
import { AdminSidebar } from "@/components/admin/layout/AdminSidebar";
import { DailyOverview } from "@/components/dashboard/DailyOverview";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { parseISO, isWithinInterval, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import type { Database } from "@/integrations/supabase/types";
import type { RolePermissions, AppRole } from "@/hooks/useUserPermissions";
import { useSearchParams } from "react-router-dom";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [requests, setRequests] = useState<RequestWithProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Initialize active tab from URL or default to 'requests'
  const [activeTab, setActiveTab] = useState(searchParams.get("tab") || "requests");

  const [filters, setFilters] = useState<FilterState>({
    employeeId: null,
    status: "all",
    startDate: undefined,
    endDate: undefined,
  });

  // Update URL when tab changes
  useEffect(() => {
    if (activeTab) {
      setSearchParams(prev => {
        prev.set("tab", activeTab);
        return prev;
      });
    }
  }, [activeTab, setSearchParams]);

  // Sync state if URL changes externally (e.g. back button)
  useEffect(() => {
    const tabFromUrl = searchParams.get("tab");
    if (tabFromUrl && tabFromUrl !== activeTab) {
      setActiveTab(tabFromUrl);
    }
  }, [searchParams]);

  const fetchRequests = async () => {
    try {
      // Fetch requests
      const { data: requestsData, error: requestsError } = await supabase
        .from("time_off_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (requestsError) throw requestsError;

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("*");

      // Map profiles to requests
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

  // Get unique employees from requests for filter dropdown
  const employees = useMemo(() => {
    const uniqueProfiles = new Map<string, Profile>();
    requests.forEach(r => {
      if (r.profiles && !uniqueProfiles.has(r.profiles.id)) {
        uniqueProfiles.set(r.profiles.id, r.profiles);
      }
    });
    return Array.from(uniqueProfiles.values());
  }, [requests]);

  // Filter requests logic
  const filteredRequests = useMemo(() => {
    return requests.filter(request => {
      // Filter by employee
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
        if (isBefore(requestEnd, startOfDay(filters.startDate))) {
          return false;
        }
      }

      if (filters.endDate) {
        if (isAfter(requestStart, endOfDay(filters.endDate))) {
          return false;
        }
      }

      return true;
    });
  }, [requests, filters]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header userEmail={userEmail} isAdmin onSwitchView={onSwitchView} role={role} />

      <div className="flex-1 flex max-w-screen-2xl mx-auto w-full">
        {/* Sidebar Navigation */}
        <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />

        {/* Main Content Area */}
        <main className="flex-1 p-6 md:p-8 overflow-y-auto w-full">
          {/* Mobile Header for Sidebar Trigger is handled inside AdminSidebar via SheetTrigger */}

          <div className="max-w-6xl mx-auto w-full space-y-6">
            <DailyOverview />

            {activeTab === 'requests' && (
              <AdminRequestsPage
                requests={filteredRequests}
                filters={filters}
                onFiltersChange={setFilters}
                employees={employees}
                onUpdate={fetchRequests}
              />
            )}

            {activeTab === 'tasks' && (
              <div className="animate-fade-in space-y-6">
                <div className="flex flex-col gap-2 mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">Taken Overzicht</h2>
                  <p className="text-muted-foreground">Beheer openstaande taken.</p>
                </div>
                <TaskList />
              </div>
            )}

            {activeTab === 'calendar' && (
              <div className="animate-fade-in space-y-6">
                <div className="flex flex-col gap-2 mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">Teamkalender</h2>
                  <p className="text-muted-foreground">Overzicht van verlof en aanwezigheid.</p>
                </div>
                <TeamCalendar requests={filteredRequests} />
              </div>
            )}

            {activeTab === 'logbook' && (
              <div className="animate-fade-in space-y-6">
                <div className="flex flex-col gap-2 mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">Toolbox Logboek</h2>
                  <p className="text-muted-foreground">Overzicht van voltooide toolboxen.</p>
                </div>
                <ToolboxLogbook />
              </div>
            )}

            {activeTab === 'employees' && (
              <div className="animate-fade-in space-y-6">
                <div className="flex flex-col gap-2 mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">Medewerkers</h2>
                  <p className="text-muted-foreground">Beheer profielen en gegevens.</p>
                </div>
                <EmployeeList />
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="animate-fade-in space-y-6">
                <div className="flex flex-col gap-2 mb-6">
                  <h2 className="text-2xl font-bold tracking-tight">Instellingen</h2>
                  <p className="text-muted-foreground">Pas systeemconfiguraties aan.</p>
                </div>
                <AdminSettings />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
