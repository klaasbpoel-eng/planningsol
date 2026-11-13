import "@/test/access/browserStubs";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactNode } from "react";
import { getPermissionsForRole } from "@/hooks/useUserPermissions";
import type { ProtectedRouteChildProps } from "@/components/auth/ProtectedRoute";

// Writes the page makes, recorded so tests can read them back.
const DB = vi.hoisted(() => ({
  writes: [] as unknown[][],
  roles: [{ user_id: "me", role: "admin" }, { user_id: "piet", role: "supervisor" }] as { user_id: string; role: string }[],
}));
const STORE = vi.hoisted(() => ({
  config: { roles: [] as unknown[], assignments: {} as Record<string, string> },
  saveCustomRoles: vi.fn(async (_roles: unknown[]) => {}),
  saveRoleAssignments: vi.fn(async (_a: Record<string, string>) => {}),
}));

vi.mock("@/lib/customRoleStore", () => ({
  loadCustomRoleConfig: async () => STORE.config,
  saveCustomRoles: STORE.saveCustomRoles,
  saveRoleAssignments: STORE.saveRoleAssignments,
  onCustomRolesChanged: () => () => {},
}));

vi.mock("@/integrations/supabase/client", () => {
  const table = (name: string) => {
    const q: Record<string, any> = {};
    q.select = () => q;
    q.not = () => q;
    q.order = () =>
      Promise.resolve({
        data: [
          { user_id: "me", full_name: "Ik Zelf", email: "ik@sol.nl" },
          { user_id: "piet", full_name: "Piet Planner", email: "piet@sol.nl" },
        ],
        error: null,
      });
    q.eq = (_c: string, v: string) => {
      q._eq = v;
      return q;
    };
    q.maybeSingle = () => Promise.resolve({ data: DB.roles.find((r) => r.user_id === q._eq) ? { id: "x" } : null, error: null });
    q.update = (values: unknown) => {
      DB.writes.push([name, "update", values]);
      return { eq: () => Promise.resolve({ error: null }) };
    };
    q.insert = (values: unknown) => {
      DB.writes.push([name, "insert", values]);
      return Promise.resolve({ error: null });
    };
    q.delete = () => ({ eq: () => Promise.resolve({ error: null }) });
    q.then = (resolve: (v: unknown) => void) => resolve({ data: name === "user_roles" ? DB.roles : [], error: null });
    return q;
  };
  return { supabase: { from: table, auth: { getSession: async () => ({ data: { session: null } }) } } };
});

vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: (props: ProtectedRouteChildProps) => ReactNode }) =>
    children({
      user: { id: "me", email: "ik@sol.nl" } as ProtectedRouteChildProps["user"],
      role: "admin",
      isAdmin: true,
      permissions: getPermissionsForRole("admin"),
      productionLocation: null,
      canViewAllLocations: true,
    }),
}));

vi.mock("@/components/layout/PageLayout", () => ({
  PageLayout: ({ title, children }: { title?: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import RolesPage from "./RolesPage";

const openPage = (tab = "rollen") =>
  render(
    <MemoryRouter initialEntries={[`/rollen?tab=${tab}`]}>
      <RolesPage />
    </MemoryRouter>,
  );

describe("pagina Rollen", () => {
  it("maakt een eigen rol met een uitgezet recht en een verborgen menu-onderdeel", async () => {
    openPage();
    fireEvent.click(await screen.findByRole("button", { name: "Nieuwe rol" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Naam"), { target: { value: "Planner" } });
    fireEvent.click(within(dialog).getByRole("switch", { name: "Droogijsorders aanmaken" }));
    fireEvent.click(within(dialog).getByRole("checkbox", { name: "Barcodegenerator tonen" }));
    fireEvent.click(within(dialog).getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(STORE.saveCustomRoles).toHaveBeenCalled());
    const [saved] = STORE.saveCustomRoles.mock.calls.at(-1)!;
    expect(saved).toEqual([
      expect.objectContaining({
        name: "Planner",
        baseRole: "operator",
        disabledPermissions: ["canCreateOrders"],
        hiddenMenuItems: ["barcode"],
      }),
    ]);
  });

  it("weigert een rol met de naam van een standaardrol", async () => {
    STORE.saveCustomRoles.mockClear();
    openPage();
    fireEvent.click(await screen.findByRole("button", { name: "Nieuwe rol" }));
    const dialog = screen.getByRole("dialog");
    fireEvent.change(within(dialog).getByLabelText("Naam"), { target: { value: "admin" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "Opslaan" }));
    expect(await within(dialog).findByText('"admin" is al een standaardrol.')).toBeInTheDocument();
    expect(STORE.saveCustomRoles).not.toHaveBeenCalled();
  });

  it("geeft een persoon een eigen rol: de standaardrol wordt mee opgeslagen", async () => {
    STORE.config = {
      roles: [{ id: "r1", name: "Planner", description: "", baseRole: "operator", disabledPermissions: [], hiddenMenuItems: [] }],
      assignments: {},
    };
    openPage("toewijzen");
    const picker = await screen.findByRole("combobox", { name: "Rol van Piet Planner" });
    // Your own role is locked so you cannot shut yourself out.
    expect(screen.getByRole("combobox", { name: "Rol van Ik Zelf" })).toBeDisabled();

    fireEvent.click(picker);
    fireEvent.click(await screen.findByRole("option", { name: "Planner" }));

    await waitFor(() => expect(STORE.saveRoleAssignments).toHaveBeenCalledWith({ piet: "r1" }));
    expect(DB.writes).toContainEqual(["user_roles", "update", { role: "operator" }]);
  });
});
