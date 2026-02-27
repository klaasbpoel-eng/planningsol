import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthForm } from "@/components/auth/AuthForm";
import { PendingApproval } from "@/components/auth/PendingApproval";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useApprovalStatus } from "@/hooks/useApprovalStatus";
import { PageLayout } from "@/components/layout/PageLayout";
import { Loader2, CalendarDays } from "lucide-react";
import { DailyOverview } from "@/components/dashboard/DailyOverview";
import type { User } from "@supabase/supabase-js";

const DailyOverviewPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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

  if (loading || permissionsLoading || approvalLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthForm />;
  if (!isApproved && !isAdmin) return <PendingApproval />;

  return (
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
  );
};

export default DailyOverviewPage;
