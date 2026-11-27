import { describe, expect, it } from "vitest";
import { dayOf, latestImportOnly, groupByDriver, parseAantal, pickDefaultDay, totalsByArticle, type PlanningLine } from "./orderPicking";

const line = (id: string, o: Partial<PlanningLine>): PlanningLine => ({ id, Datum: "2026-11-30T00:00:00+00:00", Klant: "A", Artikelnummer: "1", Omschrijving: "X", Aantal: "1", Chauffeur: "Chauffeur 1", ...o });

describe("orderPicking", () => {
  it("leest Aantal als getal uit tekst", () => {
    expect(parseAantal("6")).toBe(6);
    expect(parseAantal("1,5")).toBe(1.5);
    expect(parseAantal("abc")).toBe(0);
    expect(parseAantal(null)).toBe(0);
  });

  it("neemt de dag uit Datum zonder tijdzoneverschuiving", () => {
    expect(dayOf("2026-11-30T00:00:00+00:00")).toBe("2026-11-30");
  });

  it("kiest vandaag, anders de eerstvolgende dag, anders de laatste", () => {
    expect(pickDefaultDay(["2026-11-27", "2026-11-30"], "2026-11-27")).toBe("2026-11-27");
    expect(pickDefaultDay(["2026-11-25", "2026-11-30"], "2026-11-27")).toBe("2026-11-30");
    expect(pickDefaultDay(["2026-11-20", "2026-11-25"], "2026-11-27")).toBe("2026-11-25");
  });

  it("groepeert per chauffeur en klant met pickvoortgang", () => {
    const groups = groupByDriver(
      [line("a", { Chauffeur: "Chauffeur 2", Klant: "Thalens" }), line("b", { Chauffeur: "Chauffeur 2", Klant: "Thalens" }), line("c", { Klant: "Wasse" })],
      new Set(["a"]),
    );
    expect(groups.map((g) => [g.chauffeur, g.picked, g.total])).toEqual([["Chauffeur 1", 0, 1], ["Chauffeur 2", 1, 2]]);
    expect(groups[1].customers[0]).toMatchObject({ klant: "Thalens", picked: 1, total: 2 });
  });

  it("telt aantallen per artikel op", () => {
    const totals = totalsByArticle(
      [line("a", { Artikelnummer: "250300", Aantal: "6" }), line("b", { Artikelnummer: "250300", Aantal: "8" }), line("c", { Artikelnummer: "250100", Aantal: "1" })],
      new Set(["b"]),
    );
    expect(totals[0]).toMatchObject({ artikelnummer: "250300", aantal: 14, pickedAantal: 8, lines: 2 });
    expect(totals[1].aantal).toBe(1);
  });

  it("toont per dag alleen de laatste keer inlezen", () => {
    const oud = "2026-11-27T09:42:06.880674+00:00";
    const nieuw = "2026-11-27T13:26:04.730922+00:00";
    const kept = latestImportOnly([
      line("oud", { created_at: oud }),
      line("nieuw", { created_at: nieuw }),
      line("anderedag", { Datum: "2026-12-01T00:00:00+00:00", created_at: oud }),
    ]);
    expect(kept.map((l) => l.id)).toEqual(["nieuw", "anderedag"]);
  });
});
