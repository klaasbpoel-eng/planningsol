import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { effectivePermissions, resolveCustomRole, type CustomRole } from "@/lib/customRoles";
import { loadCustomRoleConfig, onCustomRolesChanged } from "@/lib/customRoleStore";

export type AppRole = "admin" | "supervisor" | "operator" | "user";
export type ProductionLocation = Database["public"]["Enums"]["production_location"] | null;

export interface RolePermissions {
  // User management
  canManageUsers: boolean;
  canApproveUsers: boolean;
  canAssignRoles: boolean;
  
  // Settings
  canAccessSettings: boolean;
  
  // Time off
  canApproveTimeOff: boolean;
  canManageOwnTimeOff: boolean;

  // Approving leave requests and PGS expansion requests
  canApproveRequests: boolean;
  
  // Production orders
  canViewOrders: boolean;
  canCreateOrders: boolean;
  canEditOrders: boolean;
  canDeleteOrders: boolean;
  
  // Customers
  canManageCustomers: boolean;
  canViewCustomers: boolean;
  
  // Reports & Dashboards
  canViewReports: boolean;
  canViewPGSRegister: boolean;
  canViewKPIDashboard: boolean;
  canViewAdvancedWidgets: boolean;
  
  // Calendar
  canViewCalendar: boolean;
  canViewTeamCalendar: boolean;
}

const ROLE_PERMISSIONS: Record<AppRole, RolePermissions> = {
  admin: {
    canManageUsers: true,
    canApproveUsers: true,
    canAssignRoles: true,
    canAccessSettings: true,
    canApproveTimeOff: true,
    canManageOwnTimeOff: true,
    canApproveRequests: true,
    canViewOrders: true,
    canCreateOrders: true,
    canEditOrders: true,
    canDeleteOrders: true,
    canManageCustomers: true,
    canViewCustomers: true,
    canViewReports: true,
    canViewPGSRegister: true,
    canViewKPIDashboard: true,
    canViewAdvancedWidgets: true,
    canViewCalendar: true,
    canViewTeamCalendar: true,
  },
  supervisor: {
    canManageUsers: false,
    canApproveUsers: false,
    canAssignRoles: false,
    canAccessSettings: false,
    canApproveTimeOff: false,
    canManageOwnTimeOff: true,
    canApproveRequests: false,
    canViewOrders: true,
    canCreateOrders: true,
    canEditOrders: true,
    canDeleteOrders: true,
    canManageCustomers: true,
    canViewCustomers: true,
    canViewReports: true,
    canViewPGSRegister: true,
    canViewKPIDashboard: true,
    canViewAdvancedWidgets: true,
    canViewCalendar: true,
    canViewTeamCalendar: true,
  },
  operator: {
    canManageUsers: false,
    canApproveUsers: false,
    canAssignRoles: false,
    canAccessSettings: false,
    canApproveTimeOff: false,
    canManageOwnTimeOff: true,
    canApproveRequests: false,
    canViewOrders: true,
    canCreateOrders: true,
    canEditOrders: true,
    canDeleteOrders: true,
    // Operators add new customers from the order forms.
    canManageCustomers: true,
    canViewCustomers: true,
    canViewReports: false,
    canViewPGSRegister: false,
    canViewKPIDashboard: false,
    canViewAdvancedWidgets: false,
    canViewCalendar: true,
    canViewTeamCalendar: false,
  },
  user: {
    canManageUsers: false,
    canApproveUsers: false,
    canAssignRoles: false,
    canAccessSettings: false,
    canApproveTimeOff: false,
    canManageOwnTimeOff: true,
    canApproveRequests: false,
    canViewOrders: false,
    canCreateOrders: false,
    canEditOrders: false,
    canDeleteOrders: false,
    canManageCustomers: false,
    canViewCustomers: false,
    canViewReports: false,
    canViewPGSRegister: false,
    canViewKPIDashboard: false,
    canViewAdvancedWidgets: false,
    canViewCalendar: true,
    canViewTeamCalendar: false,
  },
};

export function useUserPermissions(userId: string | undefined) {
  const [role, setRole] = useState<AppRole>("user");
  const [permissions, setPermissions] = useState<RolePermissions>(ROLE_PERMISSIONS.user);
  const [productionLocation, setProductionLocation] = useState<ProductionLocation>(null);
  const [loading, setLoading] = useState(true);
  // The user id whose role has finished loading. Until it matches the current
  // id we report loading, so protected pages never judge a fresh sign-in with
  // the default "user" role (which bounced admins away from /admin).
  const [loadedUserId, setLoadedUserId] = useState<string | undefined>(undefined);
  // Own role made on the Rollen page; it can only switch rights off, never add them.
  const [customRole, setCustomRole] = useState<CustomRole | null>(null);
  const [rolesVersion, setRolesVersion] = useState(0);

  useEffect(() => onCustomRolesChanged(() => setRolesVersion((v) => v + 1)), []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchRoleAndLocation = async () => {
      try {
        // Fetch role
        const { data: roleData, error: roleError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        if (roleError) throw roleError;
        
        const userRole = (roleData?.role as AppRole) || "user";
        setRole(userRole);
        const config = await loadCustomRoleConfig();
        const ownRole = resolveCustomRole(userId, userRole, config.roles, config.assignments);
        setCustomRole(ownRole);
        setPermissions(effectivePermissions(ROLE_PERMISSIONS[userRole], ownRole));

        // Fetch production location from profile
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("production_location")
          .eq("user_id", userId)
          .maybeSingle();

        if (profileError) throw profileError;
        
        // Admins always have access to all locations (null means all)
        // Operators and supervisors are restricted to their assigned location
        if (userRole === "admin") {
          setProductionLocation(null); // null = all locations
        } else {
          setProductionLocation(profileData?.production_location || null);
        }
      } catch (error) {
        console.error("Error fetching role/location:", error);
        setRole("user");
        setCustomRole(null);
        setPermissions(ROLE_PERMISSIONS.user);
        setProductionLocation(null);
      } finally {
        setLoadedUserId(userId);
        setLoading(false);
      }
    };

    fetchRoleAndLocation();
  }, [userId, rolesVersion]);

  return { 
    role, 
    customRole,
    permissions, 
    loading: loading || (!!userId && loadedUserId !== userId), 
    isAdmin: role === "admin",
    productionLocation,
    // Helper to check if user can view all locations
    canViewAllLocations: role === "admin" || productionLocation === null,
  };
}

export function getPermissionsForRole(role: AppRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}
