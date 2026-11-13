import { describe, expect, it } from "vitest";
import { getPermissionsForRole } from "@/hooks/useUserPermissions";
import { getNavigationGroups } from "@/config/navigation";
import {
  currentChoice,
  effectivePermissions,
  filterNavigationForRole,
  parseCustomRoles,
  planAssignment,
  removeRole,
  resolveCustomRole,
  roleDisplayName,
  validateCustomRole,
  type CustomRole,
} from "./customRoles";

const planner: CustomRole = {
  id: "r1",
  name: "Planner",
  description: "",
  baseRole: "operator",
  disabledPermissions: ["canCreateOrders"],
  hiddenMenuItems: ["barcode", "vrijgaves"],
};

describe("eigen rollen", () => {
  it("zet rechten van de standaardrol uit, maar geeft er nooit een bij", () => {
    const operator = getPermissionsForRole("operator");
    const result = effectivePermissions(operator, { ...planner, disabledPermissions: ["canCreateOrders"] });
    expect(result.canCreateOrders).toBe(false);
    expect(result.canEditOrders).toBe(true);
    // Operators cannot see reports; an own role on top of it cannot either.
    expect(result.canViewReports).toBe(false);
    for (const key of Object.keys(result) as (keyof typeof result)[]) if (!operator[key]) expect(result[key]).toBe(false);
  });

  it("telt alleen zolang de standaardrol van de persoon bij de rol past", () => {
    expect(resolveCustomRole("u1", "operator", [planner], { u1: "r1" })).toBe(planner);
    expect(resolveCustomRole("u1", "supervisor", [planner], { u1: "r1" })).toBeNull();
    expect(resolveCustomRole("u2", "operator", [planner], { u1: "r1" })).toBeNull();
  });

  it("verbergt gekozen menu-onderdelen en lege groepen", () => {
    const groups = filterNavigationForRole(getNavigationGroups(false), { ...planner, hiddenMenuItems: ["pgs", "toolbox", "barcode"] });
    expect(groups.map((g) => g.id)).toEqual(["planning", "aanvragen"]);
    expect(groups[0].items.map((i) => i.id)).toEqual(["kalender", "productie"]);
  });

  it("toont de naam van de eigen rol, anders die van de standaardrol", () => {
    expect(roleDisplayName("operator", planner)).toBe("Planner");
    expect(roleDisplayName("supervisor", null)).toBe("Supervisor");
  });

  it("weigert lege, dubbele en standaardnamen", () => {
    expect(validateCustomRole({ id: "", name: "  " }, [planner])).toBe("Geef de rol een naam.");
    expect(validateCustomRole({ id: "", name: "planner" }, [planner])).toBe('Er bestaat al een rol "planner".');
    expect(validateCustomRole({ id: "", name: "Admin" }, [planner])).toBe('"Admin" is al een standaardrol.');
    expect(validateCustomRole({ id: "r1", name: "Planner" }, [planner])).toBeNull();
  });

  it("geeft bij een eigen rol de bijbehorende standaardrol, en haalt die koppeling weg bij een standaardrol", () => {
    expect(planAssignment("custom:r1", "u1", [planner], {})).toEqual({ baseRole: "operator", assignments: { u1: "r1" } });
    expect(planAssignment("std:supervisor", "u1", [planner], { u1: "r1", u2: "r1" })).toEqual({
      baseRole: "supervisor",
      assignments: { u2: "r1" },
    });
    expect(planAssignment("std:customer", "u1", [planner], {})).toBeNull();
    expect(planAssignment("custom:weg", "u1", [planner], {})).toBeNull();
    expect(currentChoice("u1", "operator", [planner], { u1: "r1" })).toBe("custom:r1");
    expect(currentChoice("u1", "admin", [planner], { u1: "r1" })).toBe("std:admin");
  });

  it("laat mensen bij verwijderen hun standaardrol houden", () => {
    expect(removeRole([planner], { u1: "r1", u2: "x" }, "r1")).toEqual({ roles: [], assignments: { u2: "x" } });
  });

  it("leest opgeslagen rollen veilig in", () => {
    expect(parseCustomRoles("geen json")).toEqual([]);
    expect(
      parseCustomRoles(JSON.stringify([{ id: "a", name: "X", baseRole: "superuser" }, { ...planner, disabledPermissions: ["canCreateOrders", "onbekend"] }])),
    ).toEqual([{ ...planner, disabledPermissions: ["canCreateOrders"] }]);
  });
});
