/**
 * Normalize a free-text customer name so spelling variants merge into one key.
 * Rules: lowercase, strip diacritics, `&`/`+` → "en", strip punctuation,
 * remove common legal suffixes (b.v., bv, nv, gmbh, ltd, sa, sl, srl, ...).
 * Used in YoY insights and Top Customers so e.g. "Gashandel H. de Vries & Zn"
 * and "Gashandel H de Vries en Zn." count as one customer.
 */
export function normalizeKlant(raw: string | null | undefined): string {
  if (!raw) return "onbekend";
  let s = String(raw).toLowerCase();
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  s = s.replace(/[&+]/g, " en ");
  s = s.replace(/[.,'`"()\/\\]/g, " ");
  s = ` ${s} `;
  const suffixes = [
    " b v ", " bv ", " bvba ", " n v ", " nv ", " gmbh ", " ltd ", " sa ",
    " sl ", " srl ", " s a ", " s l ", " s r l ",
  ];
  let changed = true;
  while (changed) {
    changed = false;
    for (const suf of suffixes) {
      if (s.endsWith(suf)) {
        s = s.slice(0, -suf.length) + " ";
        changed = true;
      }
    }
  }
  s = s.replace(/\s+/g, " ").trim();
  return s || "onbekend";
}

/**
 * Aggregate per-row totals into per-normalized-customer totals while keeping
 * the original spelling with the highest combined volume as display label.
 */
export function groupByCustomer<T>(
  rows: T[],
  getName: (row: T) => string | null | undefined,
  getValue: (row: T) => number,
): { totals: Map<string, number>; labels: Map<string, string> } {
  const totals = new Map<string, number>();
  const votes = new Map<string, Map<string, number>>();
  for (const r of rows) {
    const original = (getName(r) || "Onbekend").toString().trim() || "Onbekend";
    const key = normalizeKlant(original);
    const v = Number(getValue(r)) || 0;
    totals.set(key, (totals.get(key) || 0) + v);
    let m = votes.get(key);
    if (!m) { m = new Map(); votes.set(key, m); }
    m.set(original, (m.get(original) || 0) + v);
  }
  const labels = new Map<string, string>();
  for (const [key, m] of votes) {
    let best = key;
    let bestVol = -1;
    for (const [lbl, v] of m) if (v > bestVol) { bestVol = v; best = lbl; }
    labels.set(key, best);
  }
  return { totals, labels };
}