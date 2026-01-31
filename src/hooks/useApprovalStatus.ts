import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useApprovalStatus(userId: string | undefined) {
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const checkApproval = async () => {
      try {
        const { data, error } = await supabase
          .from("profiles")
          .select("is_approved")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;
        setIsApproved(data?.is_approved ?? false);
      } catch (error) {
        console.error("Error checking approval status:", error);
        setIsApproved(false);
      } finally {
        setLoading(false);
      }
    };

    checkApproval();
  }, [userId]);

  return { isApproved, loading };
}
