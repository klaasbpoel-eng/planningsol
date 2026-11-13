import "@/test/access/browserStubs";
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SafetyStorage } from "./SafetyStorage";
import { getPermissionsForRole, type AppRole, type ProductionLocation } from "@/hooks/useUserPermissions";

vi.mock("@/components/production/PGSRegistry", () => ({
  PGSRegistry: ({ location, isAdmin }: { location: string; isAdmin: boolean }) => (
    <div data-testid="pgs-registry" data-location={location} data-admin={String(isAdmin)} />
  ),
}));
vi.mock("@/components/production/SiteMap", () => ({
  SiteMap: ({ location }: { location: string }) => <div data-testid="site-map" data-location={location} />,
}));

function renderSafety(
  role: AppRole,
  { path = "/pgs-register", location = null, allLocations = true }: { path?: string; location?: ProductionLocation; allLocations?: boolean } = {}
) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SafetyStorage
        permissions={getPermissionsForRole(role)}
        userProductionLocation={location}
        canViewAllLocations={allLocations}
      />
    </MemoryRouter>
  );
}

describe("PGS-pagina met een beheerdersaccount", () => {
  it("opent standaard het PGS-register met beheerrechten", async () => {
    renderSafety("admin");
    expect(screen.getByRole("tab", { name: "PGS-register" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tab", { name: "Plattegrond" })).toBeInTheDocument();
    const registry = await screen.findByTestId("pgs-registry");
    expect(registry).toHaveAttribute("data-admin", "true");
    expect(registry).toHaveAttribute("data-location", "all");
  });

  it("kan alle locaties kiezen", () => {
    renderSafety("admin");
    for (const label of ["Alle locaties", "Emmen", "Tilburg"]) {
      expect(screen.getByRole("button", { name: label })).toBeEnabled();
    }
  });

  it("opent de plattegrond direct via ?tab=plattegrond", async () => {
    renderSafety("admin", { path: "/pgs-register?tab=plattegrond" });
    expect(screen.getByRole("tab", { name: "Plattegrond" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByTestId("site-map")).toBeInTheDocument();
  });
});

describe("PGS-pagina voor andere rollen", () => {
  it("geeft een supervisor het register zonder beheerrechten", async () => {
    renderSafety("supervisor");
    expect(screen.getByRole("tab", { name: "PGS-register" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByTestId("pgs-registry")).toHaveAttribute("data-admin", "false");
  });

  it.each<AppRole>(["operator", "user"])("toont een %s alleen de plattegrond, ook via ?tab=register", async role => {
    renderSafety(role, { path: "/pgs-register?tab=register" });
    expect(screen.queryByRole("tab", { name: "PGS-register" })).not.toBeInTheDocument();
    expect(screen.queryByTestId("pgs-registry")).not.toBeInTheDocument();
    expect(await screen.findByTestId("site-map")).toBeInTheDocument();
  });

  it("beperkt een medewerker met één vestiging tot die locatie", async () => {
    renderSafety("supervisor", { location: "sol_emmen", allLocations: false });
    expect(screen.getByRole("button", { name: "Emmen" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Tilburg" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Alle locaties" })).toBeDisabled();
    expect(await screen.findByTestId("pgs-registry")).toHaveAttribute("data-location", "sol_emmen");
  });
});
