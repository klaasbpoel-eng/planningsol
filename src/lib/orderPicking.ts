/** Helpers for the order-picking screen built on the external PlanningRamses table. */

export interface PlanningLine {
  id: string;
  Datum: string | null;
  Klant: string | null;
  Artikelnummer: string | null;
  Omschrijving: string | null;
  Aantal: string | number | null;
  Chauffeur: string | null;
}

export interface CustomerGroup { klant: string; lines: PlanningLine[]; picked: number; total: number }
export interface DriverGroup { chauffeur: string; customers: CustomerGroup[]; picked: number; total: number }
export interface ArticleTotal { artikelnummer: string; omschrijving: string; aantal: number; pickedAantal: number; lines: number }

/** Aantal is stored as text ("6", "1,5"); unreadable values count as 0. */
export function parseAantal(value: PlanningLine["Aantal"]): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (!value) return 0;
  const n = Number(String(value).trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

/** Day part (YYYY-MM-DD) of a Datum value, without timezone shifting. */
export function dayOf(datum: string | null): string | null {
  const m = datum?.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

export function localDay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

/** Today when it has planning, else the first later day, else the last earlier day. */
export function pickDefaultDay(days: string[], today: string): string {
  const sorted = [...new Set(days)].sort();
  if (sorted.length === 0) return today;
  if (sorted.includes(today)) return today;
  return sorted.find((d) => d > today) ?? sorted[sorted.length - 1];
}

const nameOr = (v: string | null, fallback: string) => (v && v.trim() ? v.trim() : fallback);
const cmp = (a: string, b: string) => a.localeCompare(b, "nl", { numeric: true });

/** Groups lines per chauffeur, then per customer, with picked counts in lines. */
export function groupByDriver(lines: PlanningLine[], picked: Set<string>): DriverGroup[] {
  const drivers = new Map<string, Map<string, PlanningLine[]>>();
  for (const line of lines) {
    const d = nameOr(line.Chauffeur, "Zonder chauffeur");
    const k = nameOr(line.Klant, "Onbekende klant");
    if (!drivers.has(d)) drivers.set(d, new Map());
    const c = drivers.get(d)!;
    if (!c.has(k)) c.set(k, []);
    c.get(k)!.push(line);
  }
  return [...drivers.entries()].sort(([a], [b]) => cmp(a, b)).map(([chauffeur, cust]) => {
    const customers = [...cust.entries()].sort(([a], [b]) => cmp(a, b)).map(([klant, ls]) => ({
      klant,
      lines: [...ls].sort((a, b) => cmp(a.Omschrijving ?? "", b.Omschrijving ?? "")),
      picked: ls.filter((l) => picked.has(l.id)).length,
      total: ls.length,
    }));
    return {
      chauffeur,
      customers,
      picked: customers.reduce((s, c) => s + c.picked, 0),
      total: customers.reduce((s, c) => s + c.total, 0),
    };
  });
}

/** Total quantity per article for a day, largest first. */
export function totalsByArticle(lines: PlanningLine[], picked: Set<string>): ArticleTotal[] {
  const map = new Map<string, ArticleTotal>();
  for (const line of lines) {
    const key = nameOr(line.Artikelnummer, "") || nameOr(line.Omschrijving, "?");
    const t = map.get(key) ?? { artikelnummer: nameOr(line.Artikelnummer, ""), omschrijving: nameOr(line.Omschrijving, ""), aantal: 0, pickedAantal: 0, lines: 0 };
    const n = parseAantal(line.Aantal);
    t.aantal += n;
    if (picked.has(line.id)) t.pickedAantal += n;
    t.lines += 1;
    map.set(key, t);
  }
  return [...map.values()].sort((a, b) => b.aantal - a.aantal || cmp(a.omschrijving, b.omschrijving));
}
