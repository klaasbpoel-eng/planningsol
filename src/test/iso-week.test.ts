import { describe, it, expect } from "vitest";
import { getISOWeek, getISOWeekYear, addDays, format } from "date-fns";

/**
 * Verifieert dat onze kalender ISO 8601 weeknummering volgt.
 * ISO 8601: week begint op maandag, week 1 = week met 4 januari.
 */

const KNOWN_CASES: Array<{ date: string; week: number; year: number; label: string }> = [
  { date: "2024-12-29", week: 52, year: 2024, label: "zondag 29 dec 2024" },
  { date: "2024-12-30", week: 1, year: 2025, label: "maandag 30 dec 2024 (al week 1 van 2025)" },
  { date: "2025-01-01", week: 1, year: 2025, label: "woensdag 1 jan 2025" },
  { date: "2025-01-05", week: 1, year: 2025, label: "zondag 5 jan 2025" },
  { date: "2025-01-06", week: 2, year: 2025, label: "maandag 6 jan 2025" },
  { date: "2026-12-28", week: 53, year: 2026, label: "maandag 28 dec 2026" },
  { date: "2027-01-03", week: 53, year: 2026, label: "zondag 3 jan 2027" },
  { date: "2027-01-04", week: 1, year: 2027, label: "maandag 4 jan 2027" },
  { date: "2026-05-25", week: 22, year: 2026, label: "maandag 25 mei 2026" },
  { date: "2026-05-31", week: 22, year: 2026, label: "zondag 31 mei 2026" },
  { date: "2026-06-01", week: 23, year: 2026, label: "maandag 1 juni 2026" },
  { date: "2026-06-07", week: 23, year: 2026, label: "zondag 7 juni 2026" },
  { date: "2026-06-08", week: 24, year: 2026, label: "maandag 8 juni 2026" },
];

describe("ISO 8601 weeknummering", () => {
  it.each(KNOWN_CASES)(
    "$label moet week $week (jaar $year) zijn",
    ({ date, week, year }) => {
      const d = new Date(`${date}T12:00:00`);
      expect(getISOWeek(d)).toBe(week);
      expect(getISOWeekYear(d)).toBe(year);
    },
  );

  it("alle 7 dagen van dezelfde ISO-week delen hetzelfde weeknummer (ma t/m zo)", () => {
    const monday = new Date("2026-06-01T12:00:00");
    for (let i = 0; i < 7; i++) {
      const d = addDays(monday, i);
      expect(getISOWeek(d), `${format(d, "EEEE yyyy-MM-dd")} (offset ${i})`).toBe(23);
    }
  });

  it("op zondag wisselt het ISO-weeknummer pas op de volgende maandag", () => {
    const sunday = new Date("2026-05-31T12:00:00");
    const nextMonday = addDays(sunday, 1);
    expect(getISOWeek(sunday)).toBe(22);
    expect(getISOWeek(nextMonday)).toBe(23);
  });

  it("binnen 2026 bevat elke ISO-week max 7 dagen, en week 23 exact 7", () => {
    const counts = new Map<string, number>();
    const start = new Date("2026-01-01T12:00:00");
    for (let i = 0; i < 365; i++) {
      const d = addDays(start, i);
      const key = `${getISOWeekYear(d)}-${getISOWeek(d)}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    for (const [key, count] of counts) {
      expect(count, `week ${key}`).toBeLessThanOrEqual(7);
      expect(count, `week ${key}`).toBeGreaterThan(0);
    }
    expect(counts.get("2026-23")).toBe(7);
  });
});
