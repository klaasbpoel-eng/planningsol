import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserRole(userId: string | undefined) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const checkRole = async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();

        if (error) throw error;
        setIsAdmin(!!data);
      } catch (error) {
        console.error("Error checking role:", error);
        setIsAdmin(false);
      } finally {
        setLoading(false);
      }
    };

    checkRole();
  }, [userId]);

  return { isAdmin, loading };
}
