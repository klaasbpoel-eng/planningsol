import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AuthForm } from "@/components/auth/AuthForm";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { PendingApproval } from "@/components/auth/PendingApproval";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useApprovalStatus } from "@/hooks/useApprovalStatus";
import { PageTransition } from "@/components/ui/page-transition";
import { Loader2 } from "lucide-react";
import { UserLaunchpad } from "@/components/dashboard/UserLaunchpad";
import type { User } from "@supabase/supabase-js";

const Index = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdminView, setShowAdminView] = useState(false);
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
  // Redirect customers to their order page
  if (role === "customer") {
    navigate("/bestellen", { replace: true });
    return null;
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

  // Show User Launchpad for all authenticated users
  return (
    <PageTransition>
      <UserLaunchpad
        userEmail={user.email}
        isAdmin={isAdmin}
        onSwitchToAdmin={() => setShowAdminView(true)}
        permissions={permissions}
        role={role}
      />
    </PageTransition>
  );
};

export default Index;
