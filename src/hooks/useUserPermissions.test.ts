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
});
