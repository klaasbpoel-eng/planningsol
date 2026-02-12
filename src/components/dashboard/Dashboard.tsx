import { useEffect, useState, useMemo } from "react";
import { TimeOffRequestForm } from "@/components/time-off/TimeOffRequestForm";
import { TimeOffRequestList } from "@/components/time-off/TimeOffRequestList";
import { TimeOffCalendar } from "@/components/time-off/TimeOffCalendar";
import { StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { CalendarCheck, Clock, XCircle, Shield, Factory, Users2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import type { Database } from "@/integrations/supabase/types";
import type { RolePermissions, AppRole } from "@/hooks/useUserPermissions";
import { StatCardSkeleton, TimeOffCalendarSkeleton, TableSkeleton } from "@/components/ui/skeletons";
import { FadeIn } from "@/components/ui/fade-in";
import { api } from "@/lib/api";
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO } from "date-fns";

type TimeOffRequest = Database["public"]["Tables"]["time_off_requests"]["Row"];

interface DashboardProps {
  userEmail?: string;
  isAdmin?: boolean;
  onSwitchToAdmin?: () => void;
  permissions?: RolePermissions;
  role?: AppRole;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  supervisor: "Supervisor",
  operator: "Operator",
  user: "Gebruiker",
};

export function Dashboard({ userEmail, isAdmin, onSwitchToAdmin, permissions, role }: DashboardProps) {
  const [requests, setRequests] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchRequests = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const data = await api.timeOffRequests.getByUser(user.id);
      if (data) {
        setRequests(data);
      }
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, []);

  // Calculate current stats
  const stats = useMemo(() => ({
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    rejected: requests.filter((r) => r.status === "rejected").length,
  }), [requests]);

  // Calculate previous month stats for trends
  const trends = useMemo(() => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const currentMonthEnd = endOfMonth(now);
    const prevMonthStart = startOfMonth(subMonths(now, 1));
    const prevMonthEnd = endOfMonth(subMonths(now, 1));

    const isInCurrentMonth = (dateStr: string) => {
      const date = parseISO(dateStr);
      return isWithinInterval(date, { start: currentMonthStart, end: currentMonthEnd });
    };

    const isInPrevMonth = (dateStr: string) => {
      const date = parseISO(dateStr);
      return isWithinInterval(date, { start: prevMonthStart, end: prevMonthEnd });
    };

    const currentApproved = requests.filter((r) => r.status === "approved" && isInCurrentMonth(r.created_at)).length;
    const prevApproved = requests.filter((r) => r.status === "approved" && isInPrevMonth(r.created_at)).length;

    const currentRejected = requests.filter((r) => r.status === "rejected" && isInCurrentMonth(r.created_at)).length;
    const prevRejected = requests.filter((r) => r.status === "rejected" && isInPrevMonth(r.created_at)).length;

    const calcTrend = (current: number, prev: number): number => {
      if (prev === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - prev) / prev) * 100);
    };

    return {
      approved: calcTrend(currentApproved, prevApproved),
      rejected: calcTrend(currentRejected, prevRejected),
    };
  }, [requests]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="w-full px-[10%] py-8">
          {/* Role buttons skeleton */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="h-10 w-44 rounded-md bg-muted animate-pulse" />
            <div className="h-10 w-36 rounded-md bg-muted animate-pulse" />
          </div>

          {/* Stats skeleton */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </div>

          {/* Main content skeleton */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <TableSkeleton rows={5} columns={4} />
            </div>
            <div className="lg:col-span-1">
              <TimeOffCalendarSkeleton />
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden">

      <FadeIn show={!loading}>
        <main className="w-full px-[1%] md:px-[10%] py-8">
          {/* Role-based action buttons */}
          <div className="flex flex-wrap gap-3 mb-6">
            {isAdmin && onSwitchToAdmin && (
              <Button
                onClick={onSwitchToAdmin}
                className="bg-accent hover:bg-accent/90 text-accent-foreground"
              >
                <Shield className="h-4 w-4 mr-2" />
                Naar Beheerderspaneel
              </Button>
            )}

            {permissions?.canViewOrders && (
              <Button
                onClick={() => navigate("/productie")}
                variant="outline"
              >
                <Factory className="h-4 w-4 mr-2" />
                Productieplanning
              </Button>
            )}

            {role === "admin" && (
              <Button
                onClick={() => navigate("/klanten")}
                variant="outline"
              >
                <Users2 className="h-4 w-4 mr-2" />
                Klanten
              </Button>
            )}
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <StatCard
              value={stats.pending}
              label="In behandeling"
              icon={<Clock className="h-6 w-6 text-warning" />}
              iconBgColor="bg-warning/10"
              cardBgColor="bg-warning/5"
            />

            <StatCard
              value={stats.approved}
              label="Goedgekeurd"
              icon={<CalendarCheck className="h-6 w-6 text-success" />}
              iconBgColor="bg-success/10"
              cardBgColor="bg-success/5"
              trend={stats.approved > 0 ? { value: trends.approved, label: "vs vorige maand" } : undefined}
            />

            <StatCard
              value={stats.rejected}
              label="Afgewezen"
              icon={<XCircle className="h-6 w-6 text-destructive" />}
              iconBgColor="bg-destructive/10"
              cardBgColor="bg-destructive/5"
              trend={stats.rejected > 0 ? { value: trends.rejected, label: "vs vorige maand" } : undefined}
            />
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {permissions?.canManageOwnTimeOff && (
                <TimeOffRequestForm onSuccess={fetchRequests} />
              )}
              <TimeOffRequestList requests={requests} onDelete={fetchRequests} />
            </div>
            <div className="lg:col-span-1">
              <TimeOffCalendar requests={requests.filter((r) => r.status !== "rejected")} />
            </div>
          </div>
        </main>
      </FadeIn>
    </div>
  );
}
