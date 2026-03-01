import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthForm } from "@/components/auth/AuthForm";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { PendingApproval } from "@/components/auth/PendingApproval";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useApprovalStatus } from "@/hooks/useApprovalStatus";
import { PageTransition } from "@/components/ui/page-transition";
import { PageLayout } from "@/components/layout/PageLayout";
import { Loader2, CalendarDays } from "lucide-react";
import { DailyOverview } from "@/components/dashboard/DailyOverview";
import type { User } from "@supabase/supabase-js";

import { useSearchParams } from "react-router-dom";

const Index = () => {
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdminView, setShowAdminView] = useState(searchParams.get("view") === "admin");
  const { role, permissions, loading: permissionsLoading, isAdmin } = useUserPermissions(user?.id);
  const { isApproved, loading: approvalLoading } = useApprovalStatus(user?.id);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setShowAdminView(searchParams.get("view") === "admin");
  }, [searchParams]);

  if (loading || permissionsLoading || approvalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <PageTransition>
        <AuthForm />
      </PageTransition>
    );
  }

  // Check approval status - admins bypass this check
  if (!isApproved && !isAdmin) {
    return (
      <PageTransition>
        <PendingApproval />
      </PageTransition>
    );
  }

  // Show admin dashboard for admins who want to see it
  if (isAdmin && showAdminView) {
    return (
      <PageTransition>
        <AdminDashboard
          userEmail={user.email}
          onSwitchView={() => setShowAdminView(false)}
          permissions={permissions}
          role={role}
        />
      </PageTransition>
    );
  }

  // Show Daily Overview as the home page
  return (
    <PageTransition>
      <PageLayout
        userEmail={user.email}
        role={role}
        isAdmin={isAdmin}
        title="Dagelijks Overzicht"
        description="Bekijk alle taken, orders en verlof per dag of week."
        titleIcon={<CalendarDays className="h-8 w-8" />}
      >
        <DailyOverview />
      </PageLayout>
    </PageTransition>
  );
};

export default Index;
