import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/hooks/useUserPermissions";
import { resolveCustomRole, type CustomRole } from "@/lib/customRoles";
import { loadCustomRoleConfig, onCustomRolesChanged } from "@/lib/customRoleStore";

/** The own role of a person with this standard role; null when they have none or it no longer matches. */
export function useCustomRole(userId: string | undefined, baseRole: AppRole) {
  const [customRole, setCustomRole] = useState<CustomRole | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => onCustomRolesChanged(() => setVersion((v) => v + 1)), []);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setCustomRole(null);
      return;
    }
    loadCustomRoleConfig().then((config) => {
      if (!cancelled) setCustomRole(resolveCustomRole(userId, baseRole, config.roles, config.assignments));
    });
    return () => {
      cancelled = true;
    };
  }, [userId, baseRole, version]);

  return customRole;
}

/** Same as useCustomRole, for places that only know the role and not who is signed in. */
export function useCurrentCustomRole(baseRole: AppRole) {
  const [userId, setUserId] = useState<string | undefined>();
  useEffect(() => {
    let active = true;
    Promise.resolve(supabase.auth?.getSession?.())
      .then((result) => {
        if (active) setUserId(result?.data?.session?.user?.id);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  return useCustomRole(userId, baseRole);
}
