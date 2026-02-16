import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import type { AppRole, RolePermissions, ProductionLocation } from "@/hooks/useUserPermissions";

export interface ProtectedRouteChildProps {
  user: User;
  role: AppRole;
  permissions: RolePermissions;
  isAdmin: boolean;
  productionLocation: ProductionLocation;
  canViewAllLocations: boolean;
}

interface ProtectedRouteProps {
  children: (props: ProtectedRouteChildProps) => React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { role, permissions, loading: permissionsLoading, isAdmin, productionLocation, canViewAllLocations } =
    useUserPermissions(user?.id);

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading || permissionsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  return <>{children({ user, role, permissions, isAdmin, productionLocation, canViewAllLocations })}</>;
}
