import { Outlet } from "react-router-dom";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

export function Layout() {
    const [user, setUser] = useState<User | null>(null);
    const { role, isAdmin } = useUserPermissions(user?.id);
    const location = useLocation();

    useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        // Listen for auth changes
        const {
            data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    // Determine if we should show the full layout (Header + Footer)
    // For now, we show it everywhere, but this gives us control if needed on specific routes like login
    const showLayout = true;

    return (
        <div className="min-h-screen flex flex-col bg-background font-sans text-foreground gradient-mesh">
            {showLayout && (
                <Header
                    userEmail={user?.email}
                    role={role}
                    isAdmin={isAdmin}
                />
            )}

            <main className="flex-1 w-full relative">
                <Outlet />
            </main>

            {showLayout && <Footer />}
        </div>
    );
}
