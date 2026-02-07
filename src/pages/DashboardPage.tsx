import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Loader2 } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

const DashboardPage = () => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);
    const { role, permissions, loading: permissionsLoading, isAdmin } = useUserPermissions(user?.id);
    const navigate = useNavigate();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
            if (!session?.user) {
                navigate("/");
            }
        });
    }, [navigate]);

    if (loading || permissionsLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) return null;

    return (
        <Dashboard
            userEmail={user.email}
            isAdmin={isAdmin}
            permissions={permissions}
            role={role}
        />
    );
};

export default DashboardPage;
