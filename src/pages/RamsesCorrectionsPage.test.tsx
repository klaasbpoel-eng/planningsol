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

describe("tijdgroepen op de Ramses-correctiespagina", () => {
  it("toont per tijdgroep een kop met het aantal regels", async () => {
    await openPage();
    expect(screen.getByText("03-11-2026, 10:45")).toBeInTheDocument();
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
