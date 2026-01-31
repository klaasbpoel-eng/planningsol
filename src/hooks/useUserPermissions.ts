import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "supervisor" | "operator" | "user";

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
  
  // Production orders
  canViewOrders: boolean;
  canCreateOrders: boolean;
  canEditOrders: boolean;
  canDeleteOrders: boolean;
  
  // Customers
  canManageCustomers: boolean;
  canViewCustomers: boolean;
  
  // Reports
  canViewReports: boolean;
  
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
    canViewOrders: true,
    canCreateOrders: true,
    canEditOrders: true,
    canDeleteOrders: true,
    canManageCustomers: true,
    canViewCustomers: true,
    canViewReports: true,
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
    canViewOrders: true,
    canCreateOrders: true,
    canEditOrders: true,
    canDeleteOrders: true,
    canManageCustomers: true,
    canViewCustomers: true,
    canViewReports: true,
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
    canViewOrders: true,
    canCreateOrders: true,
    canEditOrders: false,
    canDeleteOrders: false,
    canManageCustomers: false,
    canViewCustomers: true,
    canViewReports: false,
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
    canViewOrders: false,
    canCreateOrders: false,
    canEditOrders: false,
    canDeleteOrders: false,
    canManageCustomers: false,
    canViewCustomers: false,
    canViewReports: false,
    canViewCalendar: true,
    canViewTeamCalendar: false,
  },
};

export function useUserPermissions(userId: string | undefined) {
  const [role, setRole] = useState<AppRole>("user");
  const [permissions, setPermissions] = useState<RolePermissions>(ROLE_PERMISSIONS.user);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const fetchRole = async () => {
      try {
        const { data, error } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", userId)
          .maybeSingle();

        if (error) throw error;
        
        const userRole = (data?.role as AppRole) || "user";
        setRole(userRole);
        setPermissions(ROLE_PERMISSIONS[userRole]);
      } catch (error) {
        console.error("Error fetching role:", error);
        setRole("user");
        setPermissions(ROLE_PERMISSIONS.user);
      } finally {
        setLoading(false);
      }
    };

    fetchRole();
  }, [userId]);

  return { role, permissions, loading, isAdmin: role === "admin" };
}

export function getPermissionsForRole(role: AppRole): RolePermissions {
  return ROLE_PERMISSIONS[role];
}
