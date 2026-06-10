import { describe, it, expect } from "vitest";
import { periodLabel, yearWithYtdSuffix, totalsRowLabel } from "./periodLabels";

const MONTHS = ["Jan", "Feb", "Mrt", "Apr", "Mei", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

/**
 * Snapshot van alle labels die de gastype-tabel én de bijbehorende grafiek
 * delen, zodat een onbedoelde tekstwijziging direct zichtbaar is in de diff.
 */
function buildLabelSet(year: number, ytdMode: boolean, todayMonth: number) {
  return {
    chartDescription: `Cilinders per gastype — Emmen vs Tilburg (${periodLabel(year, ytdMode, todayMonth, MONTHS)})`,
    chartLegend: {
      emmenCurrent: `Emmen ${yearWithYtdSuffix(year, ytdMode)}`,
      tilburgCurrent: `Tilburg ${yearWithYtdSuffix(year, ytdMode)}`,
      emmenPrev: `Emmen ${yearWithYtdSuffix(year - 1, ytdMode)}`,
      tilburgPrev: `Tilburg ${yearWithYtdSuffix(year - 1, ytdMode)}`,
    },
    tableHeaders: {
      currentYear: yearWithYtdSuffix(year, ytdMode),
      previousYear: yearWithYtdSuffix(year - 1, ytdMode),
    },
    totalsRow: totalsRowLabel(year, ytdMode, todayMonth, MONTHS),
    emptyState: `Geen gastype data beschikbaar voor ${periodLabel(year, ytdMode, todayMonth, MONTHS)}`,
  };
}

describe("gastype-tabel + grafiek labels snapshots", () => {
  it("toggle aan (ytdMode = true) — juni 2026", () => {
    expect(buildLabelSet(2026, true, 6)).toMatchInlineSnapshot(`
      {
        "chartDescription": "Cilinders per gastype — Emmen vs Tilburg (2026 YTD t/m Jun)",
        "chartLegend": {
          "emmenCurrent": "Emmen 2026 YTD",
          "emmenPrev": "Emmen 2025 YTD",
          "tilburgCurrent": "Tilburg 2026 YTD",
          "tilburgPrev": "Tilburg 2025 YTD",
        },
        "emptyState": "Geen gastype data beschikbaar voor 2026 YTD t/m Jun",
        "tableHeaders": {
          "currentYear": "2026 YTD",
          "previousYear": "2025 YTD",
        },
        "totalsRow": "Totaal YTD t/m Jun",
      }
    `);
  });

  it("toggle uit (ytdMode = false) — 2025", () => {
    expect(buildLabelSet(2025, false, 6)).toMatchInlineSnapshot(`
      {
        "chartDescription": "Cilinders per gastype — Emmen vs Tilburg (2025 jaartotaal)",
        "chartLegend": {
          "emmenCurrent": "Emmen 2025",
          "emmenPrev": "Emmen 2024",
          "tilburgCurrent": "Tilburg 2025",
          "tilburgPrev": "Tilburg 2024",
        },
        "emptyState": "Geen gastype data beschikbaar voor 2025 jaartotaal",
        "tableHeaders": {
          "currentYear": "2025",
          "previousYear": "2024",
        },
        "totalsRow": "Totaal 2025 jaartotaal",
      }
    `);
  });
});