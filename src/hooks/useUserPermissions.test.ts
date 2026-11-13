import { describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => {
  const makeQuery = (table: string) => {
    const query: Record<string, unknown> = {};
    for (const method of ["select", "eq"]) query[method] = () => query;
    query.maybeSingle = () =>
      Promise.resolve({
        data: table === "user_roles" ? { role: "admin" } : { production_location: null },
        error: null,
      });
    return query;
  };
  return { supabase: { from: (table: string) => makeQuery(table) } };
});

const ROLES = vi.hoisted(() => ({
  config: { roles: [] as unknown[], assignments: {} as Record<string, string> },
}));
vi.mock("@/lib/customRoleStore", () => ({
  loadCustomRoleConfig: () => Promise.resolve(ROLES.config),
  onCustomRolesChanged: () => () => {},
}));

import { useUserPermissions } from "./useUserPermissions";

describe("useUserPermissions", () => {
  it("meldt 'laden' zodra een gebruiker bekend wordt, voordat de rol is opgehaald", async () => {
    const { result, rerender } = renderHook(({ id }) => useUserPermissions(id), {
      initialProps: { id: undefined as string | undefined },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ id: "admin-user" });
    // Direct na het inloggen mag de standaardrol "user" nog niet als definitief gelden.
    expect(result.current.loading).toBe(true);
    expect(result.current.isAdmin).toBe(false);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
  });

  it("zet rechten uit die de eigen rol van de persoon niet heeft, zonder de standaardrol te veranderen", async () => {
    ROLES.config = {
      roles: [{ id: "r1", name: "Kijker", description: "", baseRole: "admin", disabledPermissions: ["canCreateOrders"], hiddenMenuItems: [] }],
      assignments: { "admin-user": "r1" },
    };
    const { result } = renderHook(() => useUserPermissions("admin-user"));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAdmin).toBe(true);
    expect(result.current.customRole?.name).toBe("Kijker");
    expect(result.current.permissions.canCreateOrders).toBe(false);
    expect(result.current.permissions.canEditOrders).toBe(true);
    ROLES.config = { roles: [], assignments: {} };
  });
});
