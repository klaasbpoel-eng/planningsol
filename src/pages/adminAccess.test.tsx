import "@/test/access/browserStubs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import type { ReactNode } from "react";
import { getPermissionsForRole, type AppRole } from "@/hooks/useUserPermissions";
import type { ProtectedRouteChildProps } from "@/components/auth/ProtectedRoute";

const session = vi.hoisted(() => ({ role: "admin" as AppRole }));

vi.mock("@/components/auth/ProtectedRoute", () => ({
  ProtectedRoute: ({ children }: { children: (props: ProtectedRouteChildProps) => ReactNode }) =>
    children({
      user: { id: "u1", email: "test@sol.nl" } as ProtectedRouteChildProps["user"],
      role: session.role,
      isAdmin: session.role === "admin",
      permissions: getPermissionsForRole(session.role),
      productionLocation: null,
      canViewAllLocations: true,
    }),
}));
vi.mock("@/integrations/supabase/client", () => {
  const result = Promise.resolve({ data: [], error: null });
  const query: Record<string, unknown> = {};
  for (const method of ["select", "order", "eq", "insert", "update", "delete"]) query[method] = () => query;
  query.then = result.then.bind(result);
  return { supabase: { from: () => query, auth: { signOut: vi.fn() } } };
});
vi.mock("@/components/layout/PageLayout", () => ({
  PageLayout: ({ title, children }: { title?: string; children: ReactNode }) => (
    <main><h1>{title}</h1>{children}</main>
  ),
}));
vi.mock("@/components/admin/AdminDashboard", () => ({ AdminDashboard: () => <h1>Beheerdashboard</h1> }));
vi.mock("@/components/admin/SqlSyncTaskForm", () => ({ SqlSyncTaskForm: () => null }));
vi.mock("@/components/production/PGSRegistry", () => ({ PGSRegistry: () => <div data-testid="pgs-registry" /> }));
vi.mock("@/components/production/SiteMap", () => ({ SiteMap: () => <div data-testid="site-map" /> }));

import AdminPage from "./AdminPage";
import SqlSyncTasksPage from "./SqlSyncTasksPage";
import SafetyStoragePage from "./SafetyStoragePage";

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<p>Startpagina</p>} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/sync-instellingen" element={<SqlSyncTasksPage />} />
        <Route path="/pgs-register" element={<SafetyStoragePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("toegang tot beheer- en veiligheidspagina's met een beheerdersaccount", () => {
  beforeEach(() => {
    session.role = "admin";
  });

  it("opent het beheerdashboard", () => {
    renderAt("/admin?tab=employees");
    expect(screen.getByRole("heading", { name: "Beheerdashboard" })).toBeInTheDocument();
  });

  it("opent de synchronisatiepagina", () => {
    renderAt("/sync-instellingen");
    expect(screen.getByRole("heading", { name: "Synchronisatie" })).toBeInTheDocument();
    expect(screen.queryByText("Startpagina")).not.toBeInTheDocument();
  });

  it("opent de PGS-pagina met het register", async () => {
    renderAt("/pgs-register");
    expect(screen.getByRole("heading", { name: "PGS-register & opslag" })).toBeInTheDocument();
    expect(await screen.findByTestId("pgs-registry")).toBeInTheDocument();
  });
});

describe.each<AppRole>(["supervisor", "operator", "user"])("toegang voor rol %s", role => {
  beforeEach(() => {
    session.role = role;
  });

  it("stuurt /admin terug naar de startpagina", () => {
    renderAt("/admin?tab=settings");
    expect(screen.getByText("Startpagina")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Beheerdashboard" })).not.toBeInTheDocument();
  });

  it("stuurt /sync-instellingen terug naar de startpagina", () => {
    renderAt("/sync-instellingen");
    expect(screen.getByText("Startpagina")).toBeInTheDocument();
  });

  it("laat de PGS-pagina wel open, met het register alleen voor rapportagerechten", async () => {
    renderAt("/pgs-register");
    expect(screen.getByRole("heading", { name: "PGS-register & opslag" })).toBeInTheDocument();
    const expected = role === "supervisor" ? "pgs-registry" : "site-map";
    expect(await screen.findByTestId(expected)).toBeInTheDocument();
    if (role !== "supervisor") expect(screen.queryByTestId("pgs-registry")).not.toBeInTheDocument();
  });
});
