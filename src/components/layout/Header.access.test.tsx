import "@/test/access/browserStubs";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Header } from "./Header";
import type { AppRole } from "@/hooks/useUserPermissions";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue({ error: null }) } },
}));
vi.mock("@/components/notifications/NotificationBell", () => ({ NotificationBell: () => null }));
vi.mock("@/components/ui/theme-toggle", () => ({ ThemeToggle: () => null }));

function renderHeader(props: { role: AppRole; isAdmin: boolean }, path = "/") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Header userEmail="test@sol.nl" {...props} />
    </MemoryRouter>
  );
}

function openGroup(label: string) {
  const nav = screen.getByRole("navigation", { name: "Hoofdmenu" });
  const trigger = within(nav).getByRole("button", { name: new RegExp(`^${label}`) });
  fireEvent.keyDown(trigger, { key: "Enter" });
  return screen.getByRole("menu");
}

function menuLinks(menu: HTMLElement) {
  return within(menu)
    .getAllByRole("menuitem")
    .map(item => [item.textContent?.trim(), item.getAttribute("href")]);
}

describe("Hoofdmenu met een beheerdersaccount", () => {
  it("toont de groep Beheer met alle beheeronderdelen en hun adressen", () => {
    renderHeader({ role: "admin", isAdmin: true });
    expect(menuLinks(openGroup("Beheer"))).toEqual([
      ["Verlofaanvragen", "/admin?tab=requests"],
      ["Taken", "/admin?tab=tasks"],
      ["Teamkalender", "/admin?tab=calendar"],
      ["Medewerkers", "/admin?tab=employees"],
      ["Toolbox-logboek", "/admin?tab=logbook"],
      ["Instellingen", "/admin?tab=settings"],
      ["Synchronisatie", "/sync-instellingen"],
      ["Ramses-correcties", "/ramses-correcties"],
    ]);
  });

  it("toont de groep Veiligheid met PGS-register & opslag en Toolbox", () => {
    renderHeader({ role: "admin", isAdmin: true });
    expect(menuLinks(openGroup("Veiligheid"))).toEqual([
      ["PGS-register & opslag", "/pgs-register"],
      ["Toolbox", "/toolbox"],
    ]);
  });

  it("toont Beheer ook als alleen de rol admin is doorgegeven", () => {
    renderHeader({ role: "admin", isAdmin: false });
    const nav = screen.getByRole("navigation", { name: "Hoofdmenu" });
    expect(within(nav).getByRole("button", { name: /^Beheer/ })).toBeInTheDocument();
  });

  it("markeert Beheer en het juiste onderdeel als actief op een beheertab", () => {
    renderHeader({ role: "admin", isAdmin: true }, "/admin?tab=employees");
    const menu = openGroup("Beheer");
    expect(within(menu).getByRole("menuitem", { name: "Medewerkers" })).toHaveAttribute("aria-current", "page");
    expect(within(menu).getByRole("menuitem", { name: "Verlofaanvragen" })).not.toHaveAttribute("aria-current");
  });

  it("markeert PGS-register & opslag als actief op de PGS-pagina", () => {
    renderHeader({ role: "admin", isAdmin: true }, "/pgs-register?tab=register");
    const menu = openGroup("Veiligheid");
    expect(within(menu).getByRole("menuitem", { name: "PGS-register & opslag" })).toHaveAttribute("aria-current", "page");
  });
});

describe.each<AppRole>(["supervisor", "operator", "user"])("Hoofdmenu voor rol %s", role => {
  it("verbergt de groep Beheer", () => {
    renderHeader({ role, isAdmin: false });
    const nav = screen.getByRole("navigation", { name: "Hoofdmenu" });
    expect(within(nav).queryByRole("button", { name: /^Beheer/ })).not.toBeInTheDocument();
    expect(screen.queryByText("Synchronisatie")).not.toBeInTheDocument();
  });

  it("toont wel de groep Veiligheid met de PGS-pagina", () => {
    renderHeader({ role, isAdmin: false });
    expect(menuLinks(openGroup("Veiligheid"))).toContainEqual(["PGS-register & opslag", "/pgs-register"]);
  });
});
