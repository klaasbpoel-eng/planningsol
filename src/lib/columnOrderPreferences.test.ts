import { describe, expect, it } from "vitest";
import { columnOrderKey, parseColumnOrder } from "./columnOrderPreferences";

describe("persoonlijke kolomvolgorde", () => {
  it("gebruikt een aparte instelling per tabel en account", () => {
    expect(columnOrderKey("RamsesCorrecties", "u1")).toBe("column_order_RamsesCorrecties_u1");
    expect(columnOrderKey("RamsesCorrecties", "u2")).not.toBe(columnOrderKey("RamsesCorrecties", "u1"));
  });

  it("leest alleen een geldige lijst met unieke kolomnamen", () => {
    expect(parseColumnOrder('["Klant","Capaciteit","Klant"]')).toEqual(["Klant", "Capaciteit"]);
    expect(parseColumnOrder('["Klant",42,""]')).toEqual(["Klant"]);
  });

  it("valt terug op de standaardvolgorde bij ontbrekende of kapotte opslag", () => {
    expect(parseColumnOrder(null)).toEqual([]);
    expect(parseColumnOrder('{"Klant":1}')).toEqual([]);
    expect(parseColumnOrder("kapot")).toEqual([]);
  });
});
