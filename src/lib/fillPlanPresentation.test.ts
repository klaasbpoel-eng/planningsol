import { describe, it, expect } from "vitest";
import { summarizeByUnit, coveredByStock, shortageAfterDemand, dayRangeLabel, unitWord, formatLiters } from "./fillPlanPresentation";

describe("fillPlanPresentation", () => {
  it("telt cilinders en bundels apart", () => {
    const t = summarizeByUnit(
      [
        { isBundle: false, packSize: 1, n: 10 },
        { isBundle: true, packSize: 12, n: 2 },
      ],
      (i) => i.n
    );
    expect(t).toEqual({ cylinders: 10, bundles: 2, bundleCylinders: 24 });
  });
  it("gedekt door voorraad is vraag min vullen, nooit negatief", () => {
    expect(coveredByStock(1261, 991)).toBe(270);
    expect(coveredByStock(5, 8)).toBe(0);
  });
  it("tekort na vraag ten opzichte van bufferdoel", () => {
    expect(shortageAfterDemand({ projectedStockBefore: 19, expectedDemand: 60, safetyTarget: 0 })).toBe(41);
    expect(shortageAfterDemand({ projectedStockBefore: 10, expectedDemand: 3, safetyTarget: 2 })).toBe(0);
  });
  it("periodelabel", () => {
    expect(dayRangeLabel([{ date: "2026-11-30" }, { date: "2026-12-04" }])).toBe("ma 30 nov t/m vr 4 dec");
    expect(dayRangeLabel([])).toBe("");
  });
  it("eenheden en liters", () => {
    expect(unitWord(true, 1)).toBe("bundel");
    expect(unitWord(false, 3)).toBe("cilinders");
    expect(formatLiters(1200)).toBe("1.200 L");
  });
});
