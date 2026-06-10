import { describe, it, expect } from "vitest";
import { periodLabel, yearWithYtdSuffix, totalsRowLabel } from "./periodLabels";

const MONTHS = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

describe("periodLabels — YTD vs jaartotaal consistentie", () => {
  describe("ytdMode = true", () => {
    const year = 2026;
    const todayMonth = 6; // Juni

    it("periodLabel geeft '{jaar} YTD t/m {maand}'", () => {
      expect(periodLabel(year, true, todayMonth, MONTHS)).toBe("2026 YTD t/m Jun");
    });

    it("yearWithYtdSuffix geeft '{jaar} YTD'", () => {
      expect(yearWithYtdSuffix(year, true)).toBe("2026 YTD");
      expect(yearWithYtdSuffix(year - 1, true)).toBe("2025 YTD");
    });

    it("totalsRowLabel geeft 'Totaal YTD t/m {maand}'", () => {
      expect(totalsRowLabel(year, true, todayMonth, MONTHS)).toBe("Totaal YTD t/m Jun");
    });

    it("alle gastype-tabel labels gebruiken dezelfde maand-suffix als de grafiek", () => {
      const chartDesc = periodLabel(year, true, todayMonth, MONTHS);
      const headerCurrent = yearWithYtdSuffix(year, true);
      const headerPrev = yearWithYtdSuffix(year - 1, true);
      const totals = totalsRowLabel(year, true, todayMonth, MONTHS);
      const emptyState = periodLabel(year, true, todayMonth, MONTHS);

      // Grafiek-beschrijving en lege-staat moeten exact identiek zijn
      expect(emptyState).toBe(chartDesc);
      // Alle YTD-labels delen exact dezelfde maand-suffix
      const monthSuffix = `t/m ${MONTHS[todayMonth - 1]}`;
      expect(chartDesc).toContain(monthSuffix);
      expect(totals).toContain(monthSuffix);
      // Headers delen exact dezelfde " YTD"-marker
      expect(headerCurrent.endsWith(" YTD")).toBe(true);
      expect(headerPrev.endsWith(" YTD")).toBe(true);
      // En het jaar in de header staat ook in de grafiek-beschrijving
      expect(chartDesc.startsWith(`${year}`)).toBe(true);
      expect(headerCurrent.startsWith(`${year}`)).toBe(true);
    });
  });

  describe("ytdMode = false", () => {
    const year = 2025;
    const todayMonth = 6;

    it("periodLabel geeft '{jaar} jaartotaal'", () => {
      expect(periodLabel(year, false, todayMonth, MONTHS)).toBe("2025 jaartotaal");
    });

    it("yearWithYtdSuffix geeft alleen het jaar", () => {
      expect(yearWithYtdSuffix(year, false)).toBe("2025");
      expect(yearWithYtdSuffix(year - 1, false)).toBe("2024");
    });

    it("totalsRowLabel geeft 'Totaal {jaar} jaartotaal'", () => {
      expect(totalsRowLabel(year, false, todayMonth, MONTHS)).toBe("Totaal 2025 jaartotaal");
    });

    it("alle gastype-tabel labels delen 'jaartotaal' suffix en zelfde jaar als de grafiek", () => {
      const chartDesc = periodLabel(year, false, todayMonth, MONTHS);
      const headerCurrent = yearWithYtdSuffix(year, false);
      const totals = totalsRowLabel(year, false, todayMonth, MONTHS);
      const emptyState = periodLabel(year, false, todayMonth, MONTHS);

      expect(emptyState).toBe(chartDesc);
      expect(chartDesc).toContain("jaartotaal");
      expect(totals).toContain("jaartotaal");
      // Geen YTD-tekst wanneer toggle uit staat
      expect(chartDesc).not.toContain("YTD");
      expect(headerCurrent).not.toContain("YTD");
      expect(totals).not.toContain("YTD");
      // Jaar moet overal hetzelfde zijn
      expect(chartDesc.startsWith(`${year}`)).toBe(true);
      expect(headerCurrent).toBe(`${year}`);
      expect(totals).toContain(`${year}`);
    });
  });

  describe("schakelen tussen ytdMode aan/uit", () => {
    it("verandert alle labels consistent zonder onderlinge afwijking", () => {
      const year = 2026;
      const todayMonth = 3; // Maart

      const onChart = periodLabel(year, true, todayMonth, MONTHS);
      const offChart = periodLabel(year, false, todayMonth, MONTHS);
      const onHeader = yearWithYtdSuffix(year, true);
      const offHeader = yearWithYtdSuffix(year, false);
      const onTotals = totalsRowLabel(year, true, todayMonth, MONTHS);
      const offTotals = totalsRowLabel(year, false, todayMonth, MONTHS);

      expect(onChart).toBe("2026 YTD t/m Mrt");
      expect(offChart).toBe("2026 jaartotaal");
      expect(onHeader).toBe("2026 YTD");
      expect(offHeader).toBe("2026");
      expect(onTotals).toBe("Totaal YTD t/m Mrt");
      expect(offTotals).toBe("Totaal 2026 jaartotaal");
    });
  });
});