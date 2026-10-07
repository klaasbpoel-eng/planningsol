import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthForm } from "@/components/auth/AuthForm";
import { PendingApproval } from "@/components/auth/PendingApproval";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useApprovalStatus } from "@/hooks/useApprovalStatus";
import { PageTransition } from "@/components/ui/page-transition";
import { PageLayout } from "@/components/layout/PageLayout";
import { BrandedLoader } from "@/components/ui/branded-loader";
import { CalendarDays } from "lucide-react";
import { DailyOverview } from "@/components/dashboard/DailyOverview";
import type { User } from "@supabase/supabase-js";

import { useNavigate, useSearchParams } from "react-router-dom";

const Index = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
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

  useEffect(() => {
    if (searchParams.get("view") === "admin") navigate("/admin", { replace: true });
  }, [navigate, searchParams]);

  if (loading || permissionsLoading || approvalLoading) {
    return <BrandedLoader />;
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

  // Show Daily Overview as the home page
  return (
    <PageTransition>
      <PageLayout
        userEmail={user.email}
        role={role}
        isAdmin={isAdmin}
        onSwitchView={() => navigate("/admin")}
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
