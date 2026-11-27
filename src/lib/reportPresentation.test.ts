import { describe, it, expect } from "vitest";
import { calendarYearProgress, reportChange, shareOfTotal, splitSeriesName, targetProgress } from "./reportPresentation";

describe("interpretatie van rapportcijfers", () => {
  it("verzint geen groei bij nul in de vergelijkingsperiode", () => {
    expect(reportChange(50, 0)).toBe("Geen basis");
    expect(reportChange(0, 0)).toBe("Geen basis");
  });
  it("geeft werkelijke groei weer zonder afkapping", () => {
    expect(reportChange(800, 100)).toBe("+700%");
    expect(reportChange(75, 100)).toBe("-25%");
  });
  it("berekent aandelen ten opzichte van het volledige totaal, niet alleen de top", () => {
    expect(shareOfTotal(30, 200)).toBe(15);
    expect(shareOfTotal(0, 0)).toBeNull();
  });
  it("toont overprestatie maar begrenst de voortgangsbalk", () => {
    expect(targetProgress(125, 100)).toEqual({ percentage: 125, barPercentage: 100 });
    expect(targetProgress(20, 0)).toBeNull();
  });
  it("telt de einddag mee en ondersteunt schrikkeljaren", () => {
    expect(calendarYearProgress(new Date(2024, 1, 29))).toEqual({ elapsedDays: 60, totalDays: 366, fraction: 60 / 366 });
    expect(calendarYearProgress(new Date(2026, 11, 31)).fraction).toBe(1);
    expect(calendarYearProgress(new Date(2026, 0, 1)).elapsedDays).toBe(1);
  });
  it("behoudt underscores in productnamen in de legenda", () => {
    expect(splitSeriesName("Gas_SOL_2026")).toEqual(["Gas_SOL", "2026"]);
  });
});