import "@/test/access/browserStubs";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { getPermissionsForRole } from "@/hooks/useUserPermissions";
import type { ProtectedRouteChildProps } from "@/components/auth/ProtectedRoute";

// Two rows share the same displayed minute, so they must end up in one collapsible group.
const ROWS = vi.hoisted(() => [
  { id: 1, dt_dn: "2026-11-03T10:45:02", code: "A1" },
  { id: 2, dt_dn: "2026-11-03T10:45:41", code: "A2" },
  { id: 3, dt_dn: "2026-11-03T11:51:00", code: "A3" },
]);

// Stored column names, as they live in the backend settings table.
const SETTINGS = vi.hoisted(() => ({
  stored: '{"dt_dn":"Tijdstip"}',
  getByKey: vi.fn(async () => ({ value: SETTINGS.stored, description: null })),
  upsert: vi.fn(async (_key: string, value: string, _description?: string) => ({
    key: "column_labels_RamsesCorrecties",
    value,
  })),
}));

vi.mock("@/lib/api", () => ({ api: { appSettings: { getByKey: SETTINGS.getByKey, upsert: SETTINGS.upsert } } }));

vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: (props: ProtectedRouteChildProps) => ReactNode }) =>
    children({
      user: { id: "u1", email: "test@sol.nl" } as ProtectedRouteChildProps["user"],
      role: "admin",
      isAdmin: true,
      permissions: getPermissionsForRole("admin"),
      productionLocation: null,
      canViewAllLocations: true,
    }),
}));

vi.mock("@/integrations/supabase/client", () => {
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order", "eq", "or"]) query[method] = () => query;
  query.range = (_from: number, to: number) =>
    Promise.resolve({ data: ROWS.slice(0, to + 1), error: null, count: ROWS.length });
  return { supabase: { from: () => query, auth: { signOut: vi.fn() } } };
});

vi.mock("@/components/layout/PageLayout", () => ({
  PageLayout: ({ title, children }: { title?: string; children: ReactNode }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));

vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

import RamsesCorrectionsPage from "./RamsesCorrectionsPage";

const groupHeader = (time: string) => screen.getByRole("button", { name: new RegExp(time) });

async function openPage() {
  render(<RamsesCorrectionsPage />);
  await waitFor(() => expect(screen.getByText("A3")).toBeInTheDocument());
}

const columnNameInput = (key: string) => document.getElementById(`kolomnaam-${key}`) as HTMLInputElement;

describe("tijdgroepen op de Ramses-correctiespagina", () => {
  it("toont per tijdgroep een kop met het aantal regels", async () => {
    await openPage();
    expect(screen.getByRole("button", { name: "Klap tijdgroep 03-11-2026, 10:45" })).toBeInTheDocument();
    expect(screen.getByText("2 regels")).toBeInTheDocument();
    expect(screen.getByText("1 regel")).toBeInTheDocument();
    expect(screen.getByText("2 tijdgroepen op deze pagina")).toBeInTheDocument();
  });

  it("klapt een tijdgroep in en weer uit", async () => {
    await openPage();
    const header = groupHeader("03-11-2026, 10:45");
    expect(header).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(header);
    expect(screen.queryByText("A1")).not.toBeInTheDocument();
    expect(screen.queryByText("A2")).not.toBeInTheDocument();
    expect(screen.getByText("A3")).toBeInTheDocument();
    expect(header).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(header);
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("A2")).toBeInTheDocument();
    expect(header).toHaveAttribute("aria-expanded", "true");
  });

  it("sluit en opent alle groepen tegelijk", async () => {
    await openPage();
    fireEvent.click(screen.getByRole("button", { name: "Alles sluiten" }));
    expect(screen.queryByText("A1")).not.toBeInTheDocument();
    expect(screen.queryByText("A3")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Alles openen" }));
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("A3")).toBeInTheDocument();
  });
});

describe("kolomnamen op de Ramses-correctiespagina", () => {
  it("gebruikt de opgeslagen kolomnamen in de tabelkop", async () => {
    await openPage();
    expect(screen.getByRole("button", { name: "Sorteer op Tijdstip" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Sorteer op Dt dn" })).not.toBeInTheDocument();
  });

  it("leest een kolomnaam uit de backend en slaat een nieuwe naam daar op", async () => {
    await openPage();
    fireEvent.click(screen.getByRole("button", { name: "Kolomnamen" }));

    const input = columnNameInput("dt_dn");
    expect(input.value).toBe("Tijdstip");

    fireEvent.change(input, { target: { value: "Datumcorrectie" } });
    fireEvent.click(screen.getByRole("button", { name: "Opslaan" }));

    await waitFor(() => expect(SETTINGS.upsert).toHaveBeenCalled());
    const [key, value, description] = SETTINGS.upsert.mock.calls.at(-1);
    expect(key).toBe("column_labels_RamsesCorrecties");
    expect(JSON.parse(value)).toEqual({ dt_dn: "Datumcorrectie" });
    expect(description).toContain("RamsesCorrecties");
    expect(screen.getByRole("button", { name: "Sorteer op Datumcorrectie" })).toBeInTheDocument();
  });

  it("zet alle kolomnamen terug naar de automatische namen", async () => {
    await openPage();
    fireEvent.click(screen.getByRole("button", { name: "Kolomnamen" }));
    fireEvent.click(screen.getByRole("button", { name: "Automatische namen herstellen" }));

    await waitFor(() => expect(SETTINGS.upsert).toHaveBeenCalledWith("column_labels_RamsesCorrecties", "{}", expect.any(String)));
    fireEvent.click(screen.getByRole("button", { name: "Sluiten" }));
    expect(screen.getByRole("button", { name: "Sorteer op Dt dn" })).toBeInTheDocument();
  });
});
