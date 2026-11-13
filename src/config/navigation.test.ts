import { describe, expect, it } from "vitest";
import {
  ADMIN_SECTIONS,
  MOVED_PRODUCTION_TABS,
  NAVIGATION_ITEMS,
  getNavigationGroups,
  isNavigationItemActive,
} from "./navigation";

describe("gedeelde navigatie", () => {
  it("houdt labels en paden uniek voor alle navigatie-oppervlakken", () => {
    expect(new Set(NAVIGATION_ITEMS.map(item => item.path)).size).toBe(NAVIGATION_ITEMS.length);
    expect(new Set(NAVIGATION_ITEMS.map(item => item.label)).size).toBe(NAVIGATION_ITEMS.length);
  });

  it("toont admins de groepen Planning, Aanvragen, Veiligheid en Beheer in die volgorde", () => {
    expect(getNavigationGroups(true).map(group => group.label)).toEqual(["Planning", "Aanvragen", "Veiligheid", "Beheer"]);
  });

  it("verbergt de groep Beheer voor niet-admins", () => {
    expect(getNavigationGroups(false).map(group => group.label)).toEqual(["Planning", "Aanvragen", "Veiligheid"]);
  });

  it("plaatst PGS-register en Toolbox onder Veiligheid", () => {
    const veiligheid = getNavigationGroups(false).find(group => group.label === "Veiligheid");
    expect(veiligheid?.items.map(item => item.path)).toEqual(["/pgs-register", "/toolbox"]);
  });

  it("heeft één startpunt voor het dagoverzicht", () => {
    const paths = NAVIGATION_ITEMS.map(item => item.path);
    expect(paths).toContain("/");
    expect(paths).not.toContain("/dagoverzicht");
  });

  it("markeert het juiste beheeronderdeel op basis van het tabblad", () => {
    const settings = { path: "/admin?tab=settings" };
    const requests = { path: "/admin?tab=requests" };
    expect(isNavigationItemActive(settings, "/admin", "?tab=settings")).toBe(true);
    expect(isNavigationItemActive(requests, "/admin", "?tab=settings")).toBe(false);
    expect(isNavigationItemActive(requests, "/admin", "")).toBe(true);
    expect(isNavigationItemActive({ path: "/productie" }, "/productie", "?tab=droogijs")).toBe(true);
  });

  it("koppelt elk beheertabblad aan het beheerpaneel", () => {
    expect(ADMIN_SECTIONS.filter(section => section.tab).map(section => section.tab)).toEqual([
      "requests", "tasks", "calendar", "employees", "logbook", "settings",
    ]);
  });

  it("stuurt oude productietabbladen door naar Veiligheid", () => {
    expect(MOVED_PRODUCTION_TABS["pgs-register"]).toBe("/pgs-register?tab=register");
    expect(MOVED_PRODUCTION_TABS.plattegrond).toBe("/pgs-register?tab=plattegrond");
  });
});
