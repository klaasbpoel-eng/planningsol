import { subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { Depot, VehicleType, ADRClass, Trend, CustomerSummary, DayAssignment, GeoPoint } from "./types";

// ─── Constants ────────────────────────────────────────────────────────────────

// Rollerend venster: laatste 6 maanden t.o.v. het moment van laden
export const PERIOD_MONTHS = 6;
export const DATE_FROM = (() => {
  const d = new Date();
  d.setMonth(d.getMonth() - PERIOD_MONTHS);
  d.setHours(0, 0, 0, 0);
  return d;
})();
export const DATE_FROM_STR = DATE_FROM.toISOString().split("T")[0]; // "YYYY-MM-DD"
export const WEEKS = Math.max(1, Math.round((Date.now() - DATE_FROM.getTime()) / (7 * 24 * 60 * 60 * 1000)));
// Halverwege het venster (voor trend-detectie: eerste vs. laatste 3 maanden)
export const DATE_MID = subMonths(new Date(), PERIOD_MONTHS / 2);

export const DAY_LABELS = ["Zo", "Ma", "Di", "Wo", "Do", "Vr", "Za"];
export const DAY_FULL   = ["Zondag", "Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag"];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const MAX_CYLINDERS_TRUCK = 200;
export const MAX_TOTAL_LOAD     = MAX_CYLINDERS_TRUCK * 2; // vol + leeg retour
export const GEO_CACHE_KEY      = "geocache_nl_v1";

// IBM Carbon kleurblinde-veilige palette (D4)
export const ZONE_COLORS: Record<string, { badge: string; row: string; stroke: string }> = {
  A: { badge: "border-[#0072B2]/50 text-[#0072B2] bg-[#0072B2]/5",   row: "border-l-[#0072B2]", stroke: "#0072B2" },
  B: { badge: "border-[#009E73]/50 text-[#009E73] bg-[#009E73]/5",   row: "border-l-[#009E73]", stroke: "#009E73" },
  C: { badge: "border-[#E69F00]/50 text-[#b07500] bg-[#E69F00]/5",   row: "border-l-[#E69F00]", stroke: "#E69F00" },
  D: { badge: "border-[#CC79A7]/50 text-[#9d4e7c] bg-[#CC79A7]/5",   row: "border-l-[#CC79A7]", stroke: "#CC79A7" },
  E: { badge: "border-[#D55E00]/50 text-[#D55E00] bg-[#D55E00]/5",   row: "border-l-[#D55E00]", stroke: "#D55E00" },
  F: { badge: "border-[#0072B2]/50 text-[#0072B2] bg-[#0072B2]/10",  row: "border-l-[#0072B2]", stroke: "#0072B2" },
  G: { badge: "border-[#009E73]/50 text-[#009E73] bg-[#009E73]/10",  row: "border-l-[#009E73]", stroke: "#009E73" },
  H: { badge: "border-[#E69F00]/50 text-[#b07500] bg-[#E69F00]/10",  row: "border-l-[#E69F00]", stroke: "#E69F00" },
  X: { badge: "border-indigo-500/50 text-indigo-700 bg-indigo-50",    row: "border-l-indigo-500", stroke: "#6366f1" },
  Y: { badge: "border-emerald-500/50 text-emerald-700 bg-emerald-50", row: "border-l-emerald-500", stroke: "#10b981" },
  Z: { badge: "border-gray-500/50 text-gray-700 bg-gray-100",        row: "border-l-gray-400",  stroke: "#9ca3af" },
};

export const DEPOT_COORDS = {
  emmen:   { lat: 52.7616, lng: 6.9397 },
  tilburg: { lat: 51.5555, lng: 5.0913 },
};

// ─── Geocache helpers ─────────────────────────────────────────────────────────

export function geocacheGet(zip: string): { lat: number; lng: number } | null {
  try {
    const cache = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) ?? "{}");
    return cache[zip] ?? null;
  } catch { return null; }
}

export function geocacheSet(zip: string, v: { lat: number; lng: number }) {
  try {
    const cache = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) ?? "{}");
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ...cache, [zip]: v }));
  } catch {}
}

export async function geocodeZip(
  zip: string,
  signal: AbortSignal,
  city?: string
): Promise<{ lat: number; lng: number } | null> {
  const cached = geocacheGet(zip);
  if (cached) return cached;
  try {
    const cityParam = city ? `&city=${encodeURIComponent(city)}` : "";
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?postalcode=${zip}${cityParam}&country=NL&format=json&limit=1`,
      { signal }
    );
    const data = await res.json();
    if (!data[0]) return null;
    const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    geocacheSet(zip, result);
    return result;
  } catch { return null; }
}

// ─── Domain helpers ───────────────────────────────────────────────────────────

export function normalizeProvince(raw: string): string {
  if (!raw) return "";
  const p = raw.trim().toUpperCase();
  const map: Record<string, string> = {
    GELDERLAND: "GL", OVERIJSSEL: "OV", GRONINGEN: "GR", "FRYSLÂN": "FR",
    FRIESLAND: "FR", DRENTHE: "DR", FLEVOLAND: "FL", UTRECHT: "UT",
    "NOORD-HOLLAND": "NH", "NOORD-BRABANT": "NB", LIMBURG: "LI",
    ZEELAND: "ZL", "ZUID-HOLLAND": "ZH",
  };
  return map[p] ?? p.replace(/\s+/g, "");
}

/** Determine Dutch province from 4-digit postcode. Covers ~95% of NL addresses. */
export function getProvinceFromZip(zip: string): string | null {
  if (!zip) return null;
  const match = zip.replace(/\s/g, "").match(/^(\d{4})/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (n >= 1000 && n <= 1299) return "NH"; // Amsterdam
  if (n >= 1300 && n <= 1399) return "FL"; // Almere
  if (n >= 1400 && n <= 2299) return "NH"; // Noord-Holland (incl. Haarlem)
  if (n >= 2300 && n <= 3399) return "ZH"; // Leiden, Den Haag, Rotterdam, Dordrecht
  if (n >= 3400 && n <= 3849) return "UT"; // Utrecht, Amersfoort
  if (n >= 3850 && n <= 3999) return "GL"; // Veluwe, Harderwijk
  if (n >= 4000 && n <= 4199) return "GL"; // Rivierenland: Tiel, Culemborg
  if (n >= 4200 && n <= 4299) return "ZH"; // Gorinchem
  if (n >= 4300 && n <= 4799) return "ZL"; // Zeeland
  if (n >= 4800 && n <= 5799) return "NB"; // Noord-Brabant
  if (n >= 5800 && n <= 6499) return "LI"; // Limburg
  if (n >= 6500 && n <= 6999) return "GL"; // Nijmegen, Arnhem
  if (n >= 7000 && n <= 7399) return "GL"; // Doetinchem, Zutphen, Apeldoorn
  if (n >= 7400 && n <= 7799) return "OV"; // Deventer, Enschede, Almelo
  if (n >= 7800 && n <= 7999) return "DR"; // Emmen, Hoogeveen, Coevorden
  if (n >= 8000 && n <= 8199) return "OV"; // Zwolle, Kampen
  if (n >= 8200 && n <= 8499) return "FL"; // Lelystad, Dronten, Emmeloord
  if (n >= 8500 && n <= 9299) return "FR"; // Friesland
  if (n >= 9300 && n <= 9399) return "GR"; // Oost-Groningen
  if (n >= 9400 && n <= 9499) return "DR"; // Assen
  if (n >= 9500 && n <= 9999) return "GR"; // Groningen
  return null;
}

export function getZone(rawProvince: string, rawCity: string, _depot?: Depot, rawZip?: string): { full: string; short: string } {
  let p = normalizeProvince(rawProvince);

  if (!p || p.length > 3) {
    const fb = getProvinceFromZip(rawZip ?? "");
    if (fb) p = fb;
  }

  if (["GR","FR","DR"].includes(p))   return { full: "A — Noord",     short: "A" };
  if (p === "OV")                      return { full: "B — Oost",      short: "B" };
  if (["GL","GE","UT"].includes(p))    return { full: "C — Midden",    short: "C" };
  if (["NH","FL"].includes(p))         return { full: "D — West",      short: "D" };
  if (p === "ZH")                      return { full: "E — West-Zuid", short: "E" };
  if (p === "ZL")                      return { full: "F — Zuidwest",  short: "F" };
  if (p === "NB")                      return { full: "G — Zuid",      short: "G" };
  if (p === "LI")                      return { full: "H — Zuidoost",  short: "H" };

  const rawProv = (rawProvince || "").toLowerCase();
  const rawCit  = (rawCity    || "").toLowerCase().trim();

  if (rawProv.includes("vlaanderen") || rawProv.includes("belgi") || rawProv.includes("antwerpen") || rawProv.includes("brussel") ||
      /^(mol|arendonk|leuven|brugge|antwerpen|brussel|gent|hasselt|genk|lommel)$/i.test(rawCit))
    return { full: "X — België", short: "X" };

  if (rawProv.includes("deutschland") || rawProv.includes("germany") ||
      /^(krefeld|düsseldorf|duisburg|köln|essen|aachen|mönchengladbach)$/i.test(rawCit))
    return { full: "Y — Duitsland", short: "Y" };

  return { full: "Z — Onbekend", short: "Z" };
}

export function isMedical(content: string, containerType: string, capacity: number): boolean {
  const c = (content ?? "").toLowerCase();
  const ct = (containerType ?? "").toLowerCase();
  return (
    (c.includes("medicinaal") || c.includes("medical") || c.includes("air medical")) &&
    (capacity <= 10 || ct.includes("alu") || ct.includes("integrated"))
  );
}

export function effectiveDepot(c: CustomerSummary, asgMap: Map<string, DayAssignment>): Depot {
  const override = asgMap.get(c.key)?.depot_override;
  if (override === "emmen" || override === "tilburg") return override;
  return c.depot;
}

export function effectiveVehicleType(c: CustomerSummary, asgMap: Map<string, DayAssignment>): VehicleType {
  const override = asgMap.get(c.key)?.vehicle_type;
  if (override === "truck" || override === "courier" || override === "mixed") return override;
  return c.vehicleType;
}

export function heatClass(pct: number): string {
  if (pct === 0)    return "text-muted-foreground/20";
  if (pct < 0.10)  return "bg-primary/10 text-primary/60";
  if (pct < 0.20)  return "bg-primary/20 text-primary/80";
  if (pct < 0.35)  return "bg-primary/40 text-primary";
  return "bg-primary/65 text-white font-semibold";
}

export function capacityBarColor(pct: number): string {
  if (pct < 0.70) return "bg-emerald-500";
  if (pct < 0.90) return "bg-amber-500";
  return "bg-red-500";
}

// ─── Data fetching ────────────────────────────────────────────────────────────

export function parseDatumToDate(raw: unknown): Date | null {
  if (!raw) return null;
  if (typeof raw === "string") { const d = new Date(raw); return isNaN(d.getTime()) ? null : d; }
  if (typeof raw === "number") { const d = new Date(raw); return isNaN(d.getTime()) ? null : d; }
  if (Array.isArray(raw) && raw.length > 0) return parseDatumToDate(raw[0]);
  if (typeof raw === "object" && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const candidate = obj.date ?? obj.value ?? obj.datum ?? Object.values(obj)[0];
    return parseDatumToDate(candidate);
  }
  return null;
}

export async function fetchAfname(): Promise<any[]> {
  const all: any[] = [];
  const PAGE = 1000;
  const BASE = "CenterDescription,DS_ENTITY_DESCRIPTION,TX_CITY,TX_PROVINCE,TX_ZIP,ContentDescription,ContainerTypeDescription,Capacity,Aantal,Datum";
  const WITH_STREET = `TX_ADDRESS,${BASE}`;

  // Probe whether TX_ADDRESS column exists
  const probe = await (supabase.from("Afname" as never) as any)
    .select(WITH_STREET).range(0, 0);
  const selectFields = probe.error ? BASE : WITH_STREET;

  let from = 0;
  while (true) {
    const { data, error } = await (supabase.from("Afname" as never) as any)
      .select(selectFields)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ─── Aggregation ──────────────────────────────────────────────────────────────

export function buildSummaries(rows: any[]): CustomerSummary[] {
  const map = new Map<string, {
    depot: Depot; name: string; street: string; city: string; province: string; zip: string;
    dowCounts: number[]; medical: number; truck: number;
    cylinders: number; products: Set<string>; productDetails: Map<string, { container: string; capacity: number }>;
    totalCount: number; recentCount: number;
  }>();

  for (const row of rows) {
    const center: string = row.CenterDescription ?? "";
    const depot: Depot = center.toLowerCase().includes("emmen") ? "emmen" : "tilburg";
    const name: string = row.DS_ENTITY_DESCRIPTION ?? "";
    const street: string = row.TX_ADDRESS ?? "";
    const city: string = row.TX_CITY ?? "";
    const province: string = row.TX_PROVINCE ?? "";
    const zip: string = row.TX_ZIP ?? "";
    if (!name) continue;

    const zipKey = zip.replace(/\s+/g, "").toUpperCase();
    const key = `${depot}__${name}__${zipKey}`;

    let dow = -1;
    const d = parseDatumToDate(row.Datum);
    if (d) dow = d.getDay();
    const isRecent = d ? d >= DATE_MID : false;

    const cap = Number(row.Capacity) || 0;
    const aantal = Number(row.Aantal) || 0;
    const content: string = row.ContentDescription ?? "";
    const containerType: string = row.ContainerTypeDescription ?? "";
    const medical = isMedical(content, containerType, cap);

    const existing = map.get(key);
    
    // Bundel equivalentie voor transport: een 800L bundel telt fysiek voor 16 cilinders.
    // We checken expliciete capaciteiten of of de container type 'bundel' bevat.
    const ct = containerType.toLowerCase();
    const isBundle = cap === 800 || cap === 640 || cap === 600 || cap === 480 || ct.includes("bundel") || ct.includes("bundle") || ct.includes("bndl");
    let equivalentAantal = aantal;
    
    if (isBundle) {
        let multiplier = 16; // default voor bundels als capaciteit onbekend is
        if (cap === 800 || cap === 640) {
            multiplier = 16;
        } else if (cap === 600 || cap === 480) {
            multiplier = 12;
        } else if (cap >= 50) {
            multiplier = Math.round(cap / 50);
        }
        equivalentAantal = aantal * multiplier;
    }

    const productKey = content ? content.split(" in ")[0].trim() : "";
    if (existing) {
      if (dow >= 0) existing.dowCounts[dow]++;
      medical ? existing.medical++ : existing.truck++;
      existing.cylinders += equivalentAantal;
      if (content) existing.products.add(content);
      if (productKey && !existing.productDetails.has(productKey))
        existing.productDetails.set(productKey, { container: containerType, capacity: cap });
      existing.totalCount++;
      if (isRecent) existing.recentCount++;
    } else {
      const dowCounts = [0, 0, 0, 0, 0, 0, 0];
      if (dow >= 0) dowCounts[dow]++;
      const productDetails = new Map<string, { container: string; capacity: number }>();
      if (productKey) productDetails.set(productKey, { container: containerType, capacity: cap });
      map.set(key, {
        depot, name, street, city, province, zip,
        dowCounts,
        medical: medical ? 1 : 0,
        truck: medical ? 0 : 1,
        cylinders: equivalentAantal,
        products: new Set(content ? [content] : []),
        productDetails,
        totalCount: 1,
        recentCount: isRecent ? 1 : 0,
      });
    }
  }

  const summaries: CustomerSummary[] = [];
  for (const [key, v] of map.entries()) {
    const totalDeliveries = v.dowCounts.reduce((s, c) => s + c, 0);
    if (totalDeliveries === 0) continue;

    const { full, short } = getZone(v.province, v.city, v.depot, v.zip);
    const medicalShare = v.medical / (v.medical + v.truck || 1);
    const vehicleType: VehicleType =
      medicalShare > 0.7 ? "courier" : medicalShare > 0.3 ? "mixed" : "truck";

    const preferredDays = WEEKDAYS.filter(d => {
      const pct = totalDeliveries > 0 ? v.dowCounts[d] / totalDeliveries : 0;
      return pct >= 0.15;
    });

    const topProducts = [...v.products]
      .map(p => p.split(" in ")[0].trim())
      .filter((p, i, arr) => arr.indexOf(p) === i)
      .slice(0, 3);

    const topProductDetails = topProducts.map(name => ({
      name,
      container: v.productDetails.get(name)?.container ?? "",
      capacity:  v.productDetails.get(name)?.capacity ?? 0,
    }));

    // Trend
    const earlyCount = v.totalCount - v.recentCount;
    let trend: Trend = "stable";
    if (earlyCount === 0 && v.recentCount > 0)       trend = "new";
    else if (v.recentCount < earlyCount * 0.6)       trend = "declining";
    else if (v.recentCount > earlyCount * 1.4)       trend = "rising";

    summaries.push({
      key,
      depot: v.depot,
      name: v.name,
      street: v.street,
      city: v.city,
      province: v.province,
      zip: v.zip,
      zone: full,
      zoneShort: short,
      vehicleType,
      totalDeliveries,
      perWeek: totalDeliveries / WEEKS,
      dowCounts: v.dowCounts,
      preferredDays,
      isMedical: medicalShare > 0.5,
      cylinders: v.cylinders,
      topProducts,
      topProductDetails,
      trend,
      recentDeliveries: v.recentCount,
    });
  }

  return summaries.sort((a, b) => b.perWeek - a.perWeek);
}

// ─── Depot coords + Haversine ─────────────────────────────────────────────────

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function getADRClass(products: string[]): ADRClass {
  const text = products.join(" ").toLowerCase();
  if (text.includes("zuurstof") || text.includes("oxygen"))           return "oxidizer";
  if (text.includes("acetyleen") || text.includes("propaan") ||
      text.includes("waterstof") || text.includes("hydrogen"))        return "flammable";
  if (text.includes("co2") || text.includes("stikstof") ||
      text.includes("argon") || text.includes("helium"))              return "inert";
  return "none";
}

export function nearestNeighborTSP(depotLat: number, depotLng: number, stops: GeoPoint[]): GeoPoint[] {
  if (!stops.length) return [];
  const unvisited = [...stops];
  const result: GeoPoint[] = [];
  let curLat = depotLat, curLng = depotLng;
  while (unvisited.length) {
    let best = 0;
    let bestDist = haversineKm(curLat, curLng, unvisited[0].lat, unvisited[0].lng);
    for (let i = 1; i < unvisited.length; i++) {
      const d = haversineKm(curLat, curLng, unvisited[i].lat, unvisited[i].lng);
      if (d < bestDist) { bestDist = d; best = i; }
    }
    result.push(unvisited[best]);
    curLat = unvisited[best].lat;
    curLng = unvisited[best].lng;
    unvisited.splice(best, 1);
  }
  return result;
}

export function twoOptImprove(route: GeoPoint[], depotLat: number, depotLng: number): GeoPoint[] {
  if (route.length < 3) return route;
  let best = [...route];
  const routeDist = (r: GeoPoint[]) => {
    let d = haversineKm(depotLat, depotLng, r[0].lat, r[0].lng);
    for (let i = 0; i < r.length - 1; i++) d += haversineKm(r[i].lat, r[i].lng, r[i+1].lat, r[i+1].lng);
    d += haversineKm(r[r.length-1].lat, r[r.length-1].lng, depotLat, depotLng);
    return d;
  };
  let bestDist = routeDist(best);
  const MAX_ITER = 3;
  for (let iter = 0; iter < MAX_ITER; iter++) {
    let improved = false;
    for (let i = 0; i < best.length - 1; i++) {
      for (let j = i + 2; j < best.length; j++) {
        const candidate = [...best.slice(0, i+1), ...best.slice(i+1, j+1).reverse(), ...best.slice(j+1)];
        const cDist = routeDist(candidate);
        if (cDist < bestDist - 0.01) {
          best = candidate;
          bestDist = cDist;
          improved = true;
        }
      }
    }
    if (!improved) break;
  }
  return best;
}
