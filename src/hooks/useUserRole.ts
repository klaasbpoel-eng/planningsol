import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useUserPermissions";

export function useUserRole(userId: string | undefined) {
  const [role, setRole] = useState<AppRole>("user");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setRole("user");
      setLoading(false);
      return;
    }

    const checkRole = async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;
        const value = data?.role as AppRole | undefined;
        setRole(value === "admin" || value === "supervisor" || value === "operator" ? value : "user");
      } catch (error) {
        console.error("Error checking role:", error);
        setRole("user");
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [userId]);

  return { role, isAdmin: role === "admin", loading };
}
