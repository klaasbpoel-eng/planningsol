import { describe, expect, it } from "vitest";
import { NAVIGATION_GROUPS, NAVIGATION_ITEMS } from "./navigation";

describe("gedeelde navigatie", () => {
  it("houdt labels en paden uniek voor alle navigatie-oppervlakken", () => {
    expect(new Set(NAVIGATION_ITEMS.map(item => item.path)).size).toBe(NAVIGATION_ITEMS.length);
    expect(new Set(NAVIGATION_ITEMS.map(item => item.label)).size).toBe(NAVIGATION_ITEMS.length);
  });

  it("bevat alle hoofdgroepen in de afgesproken volgorde", () => {
    expect(NAVIGATION_GROUPS.map(group => group.label)).toEqual(["Planning", "Beheer", "Tools"]);
  });

  it("biedt de dagelijkse kernroutes aan", () => {
    expect(NAVIGATION_ITEMS.map(item => item.path)).toEqual(expect.arrayContaining([
      "/dagoverzicht",
      "/kalender",
      "/productie",
      "/interne-bestellingen",
      "/verlof",
    ]));
  });
});