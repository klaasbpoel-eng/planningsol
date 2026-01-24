import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthForm } from "@/components/auth/AuthForm";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { useUserRole } from "@/hooks/useUserRole";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAdminView, setShowAdminView] = useState(true);
  const { isAdmin, loading: roleLoading } = useUserRole(user?.id);

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

  if (loading || roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <AuthForm />;
  }

  if (isAdmin && showAdminView) {
    return (
      <AdminDashboard 
        userEmail={user.email} 
        onSwitchView={() => setShowAdminView(false)} 
      />
    );
  }

  return (
    <Dashboard 
      userEmail={user.email} 
      isAdmin={isAdmin}
      onSwitchToAdmin={() => setShowAdminView(true)}
    />
  );
};

export default Index;
