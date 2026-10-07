import { describe, expect, it } from "vitest";
import { calculatePercentageTrend, getComparisonRange, isYearToDateRange, mapProductionLocation } from "./productionMetrics";

describe("productionMetrics", () => {
  it("classificeert alleen bekende locaties en maakt onbekende waarden expliciet", () => {
    expect(mapProductionLocation("SOL Nederland-Depot Emmen")).toBe("sol_emmen");
    expect(mapProductionLocation("SOL Nederland-Tilburg")).toBe("sol_tilburg");
    expect(mapProductionLocation("Andere locatie")).toBe("unknown");
    expect(mapProductionLocation(null)).toBe("unknown");
  });

  it("herkent YTD tot en met vandaag", () => {
    const today = new Date(2026, 9, 7);
    expect(isYearToDateRange(new Date(2026, 0, 1), new Date(2026, 9, 7), today)).toBe(true);
    expect(isYearToDateRange(new Date(2026, 0, 1), new Date(2026, 9, 8), today)).toBe(false);
  });

  it("vergelijkt YTD met exact hetzelfde kalenderdeel vorig jaar", () => {
    const range = getComparisonRange(new Date(2026, 0, 1), new Date(2026, 9, 7), new Date(2026, 9, 7));
    expect(range.from).toEqual(new Date(2025, 0, 1));
    expect(range.to).toEqual(new Date(2025, 9, 7));
    expect(range.label).toBe("dezelfde periode vorig jaar");
  });

  it("vergelijkt overige bereiken met de direct voorafgaande periode van gelijke lengte", () => {
    const range = getComparisonRange(new Date(2026, 5, 8), new Date(2026, 5, 14), new Date(2026, 9, 7));
    expect(range.from).toEqual(new Date(2026, 5, 1));
    expect(range.to).toEqual(new Date(2026, 5, 7));
    expect(range.label).toBe("vorige periode");
  });

  it("toont geen misleidende procentuele groei zonder vergelijkingsbasis", () => {
    expect(calculatePercentageTrend(25, 0)).toBeNull();
    expect(calculatePercentageTrend(150, 100)).toBe(50);
  });
});