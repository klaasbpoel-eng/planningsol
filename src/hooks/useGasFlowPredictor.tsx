import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { differenceInDays, addDays, isBefore, isAfter, startOfDay } from 'date-fns';

export interface GasFlowPrediction {
  product: string;
  location: string;
  capacityPerUnit: number;   // liters per cylinder/bundle
  currentStock: number;      // stuks
  capacity: number;          // total liters in stock (currentStock × capacityPerUnit)
  predictedDemand7Days: number;   // stuks
  predictedDemand10Days: number;  // stuks
  deficit: number;           // stuks
  status: 'Kritiek' | 'Actie' | 'OK';
}

export interface CustomerHotspot {
  customerName: string;
  city: string;
  products: string[];
  nextDeliveryDate: Date;
  avgInterval: number;
  urgency: 'Kritiek' | 'Actie';
  driver?: string; // Automatically determined from latest Afname record
}

export interface DeadStockItem {
  product: string;
  location: string;
  capacityPerUnit: number;
  currentStock: number;          // stuks
  daysSinceLastDelivery: number | null; // null = geen geschiedenis afgelopen 12 maanden
}

export interface FillPlanItem {
  product: string;
  location: string;
  capacityPerUnit: number;
  startStock: number;             // huidige voorraad in stuks
  totalExpectedDemand: number;    // som vraag over horizon
  totalSuggestedFill: number;     // som vulsuggestie over horizon
  perDay: {
    date: string;                 // YYYY-MM-DD
    expectedDemand: number;       // stuks verwacht deze dag
    projectedStockBefore: number; // voorraad voor vraag van die dag
    projectedStockAfter: number;  // voorraad na vraag, voor vullen
    suggestedFill: number;        // stuks bij te vullen om voorraad >= safety te houden
    endStock: number;             // voorraad einde dag (na vulling)
  }[];
}

export interface FillPlanDay {
  date: string;
  dayLabel: string;        // bv. "ma 11 mei"
  totalExpectedDemand: number;
  totalSuggestedFill: number;
  items: {
    product: string;
    location: string;
    capacityPerUnit: number;
    expectedDemand: number;
    projectedStockBefore: number;
    suggestedFill: number;
  }[];
}

export interface ChurnRisk {
  customerName: string;
  city: string;
  lastDeliveryDate: Date;
  daysSinceLastDelivery: number;
  avgInterval: number;           // normale bezorgfrequentie in dagen
  overdueBy: number;             // daysSinceLast - avgInterval
  totalDeliveries: number;
  avgCylindersPerDelivery: number;
  products: string[];
  driver?: string;
  riskLevel: 'Hoog' | 'Middel'; // Hoog = >3× interval, Middel = 2–3× interval
}

export interface PerYearStat {
  year: number;
  totalCylinders: number;
  totalDepotCylinders: number;
  totalDeliveryDays: number;
  avgCylindersPerDay: number;
  uniqueCustomers: number;
  topProducts: { product: string; total: number }[];
  topCustomers: { customer: string; total: number }[];
  monthlyTotals: { month: string; cylinders: number }[]; // alle 12 maanden van dit jaar
  dayOfWeekTotals: number[];
  weeklyTotals: { week: string; cylinders: number; days: number }[];
  allDays: { date: string; cylinders: number; customers: number }[]; // alle rijdagen van dit jaar
  lastDeliveryDate: Date;
}

export interface DriverStat {
  driver: string;
  totalCylinders: number;
  totalDepotCylinders: number;
  totalDeliveryDays: number;
  avgCylindersPerDay: number;
  uniqueCustomers: number;
  topProducts: { product: string; total: number }[];   // top 5
  topCustomers: { customer: string; total: number }[];  // top 5
  lastDeliveryDate: Date;
  monthlyTotals: { month: string; cylinders: number }[]; // laatste 6 maanden, key "YYYY-MM"
  dayOfWeekTotals: number[]; // [Ma, Di, Wo, Do, Vr, Za, Zo] — som cilinders per weekdag
  recentDays: { date: string; cylinders: number; customers: number }[]; // laatste 90 dagen, gesorteerd asc
  weeklyTotals: { week: string; cylinders: number; days: number }[]; // laatste 12 weken, key "YYYY-WW"
  perYear: PerYearStat[];
}

// ─── Depot-klantdetectie ─────────────────────────────────────────────────────
// Klantnamen die beginnen met D00 t/m D28 zijn interne depots.
// Voeg aanvullende exacte namen toe in DEPOT_CUSTOMER_NAMES indien nodig.
export const DEPOT_CUSTOMER_NAMES: Set<string> = new Set([
  // Aanvullende exacte depot-namen (case-insensitief), buiten D00-D28:
  // 'depot emmen',
]);

function isDepotCustomer(name: string): boolean {
  const lower = name.toLowerCase();
  if (DEPOT_CUSTOMER_NAMES.has(lower)) return true;
  // Klantnamen die beginnen met D0 t/m D28 of D00 t/m D28 (intern depot-codeformaat)
  // \d{1,2} = 1 of 2 cijfers zodat zowel "D1 - NTG" als "D01 - NTG" matchen
  const m = lower.match(/^d(\d{1,2})(\b|[^0-9]|$)/);
  if (m) {
    const num = parseInt(m[1], 10);
    return num >= 0 && num <= 28;
  }
  return false;
}
// ─────────────────────────────────────────────────────────────────────────────


// Ensure any returned field is strictly a primitive string so React UI doesn't crash on render (Invariant 31)
function safeStr(val: any, fallback = 'Onbekend'): string {
  if (!val) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  if (typeof val === 'object') {
     return String(val.name || val.Username || val.username || val.description || val.value || fallback);
  }
  return String(val);
}

async function fetchAllRows(tableName: string) {
  let all: any[] = [];
  let page = 0;
  while (true) {
    // @ts-ignore
    const { data, error } = await supabase.from(tableName).select('*').range(page * 1000, (page + 1) * 1000 - 1);
    if (error) throw error;
    if (data && data.length > 0) all.push(...data);
    if (!data || data.length < 1000) break;
    page++;
  }
  return all;
}

export function useGasFlowPredictor() {
  return useQuery({
    queryKey: ['gasFlowPredictions'],
    queryFn: async () => {
      const [voorraadRows, afnameRows] = await Promise.all([
        fetchAllRows('Voorraad'),
        fetchAllRows('Afname')
      ]);

      // ── Bundel/pakket mapping: 1 bundel rij telt als N individuele cilinders ──
      // Bv. 800L bundel = 16 cilinders van 50L
      const { data: pkgRows } = await supabase
        .from('gas_packages')
        .select('bundle_capacity_liters, cylinders_per_pack, single_cylinder_liters, is_active');
      const packageMap = new Map<number, { mult: number; unitCap: number }>();
      for (const p of (pkgRows || [])) {
        if ((p as any).is_active === false) continue;
        const bundleCap = Number((p as any).bundle_capacity_liters);
        const mult = Math.max(1, Number((p as any).cylinders_per_pack) || 1);
        const unitCap = Math.max(1, Number((p as any).single_cylinder_liters) || 50);
        if (bundleCap > 0) packageMap.set(bundleCap, { mult, unitCap });
      }
      // Helper: converteer (cap, aantal) naar (effectiveCap, effectiveAantal)
      // gebaseerd op de mapping. Niet-bundels blijven onveranderd.
      const expandPackage = (cap: number, aantal: number): { cap: number; aantal: number } => {
        const m = packageMap.get(cap);
        if (!m) return { cap, aantal };
        return { cap: m.unitCap, aantal: aantal * m.mult };
      };

      const today = startOfDay(new Date());
      const in7Days = addDays(today, 7);
      const in10Days = addDays(today, 10);
      // Only consider deliveries from the last 12 months for predictions
      const cutoff = addDays(today, -365);
      // Track latest delivery date per product-location-cap (for dead stock detection)
      const lastDeliveryPerPKey = new Map<string, Date>();
      // Churn risk: customers with regular history but gone silent
      const churnRiskMap = new Map<string, ChurnRisk>();
      // Track deliveries per driver per day (for driver statistics)
      const driverDays = new Map<string, Map<string, {
        cylinders: number; depotCylinders: number; customers: Map<string, number>; products: Map<string, number>; date: Date;
      }>>();

      // 1. Parse Afname to calculate per-customer delivery intervals
      const customerHistory = new Map<string, any[]>();
      // Globaal depot-totaal per jaar — telt ALLE depot-rijen, ook zonder chauffeur
      const depotTotalByYear = new Map<number, number>();

      for (const row of afnameRows) {
        // Datum is altijd vereist
        if (!row.Datum) continue;

        // Parse datum: try ISO string first, then YYYYMMDD
        let parsedDate: Date | null = null;
        const dateRaw = row.Datum;
        if (typeof dateRaw === 'string') {
          const dateStr = dateRaw.replace(/\s/g, '');
          if (dateStr.length === 8 && /^\d{8}$/.test(dateStr)) {
            const year = parseInt(dateStr.substring(0, 4));
            const month = parseInt(dateStr.substring(4, 6)) - 1;
            const day = parseInt(dateStr.substring(6, 8));
            parsedDate = new Date(year, month, day);
          } else {
            const d = new Date(dateStr);
            if (!isNaN(d.getTime())) parsedDate = d;
          }
        } else if (typeof dateRaw === 'number') {
          const d = new Date(dateRaw);
          if (!isNaN(d.getTime())) parsedDate = d;
        }
        if (!parsedDate || isNaN(parsedDate.getTime())) continue;

        const aantal = Number(row.Aantal) || 0;
        const cap    = Math.max(1, Number(row.Capaciteit || row.Capacity) || 1);

        // Derive supply location from SyncID (contains "Tilburg" or "Emmen") or legacy columns
        const syncIdStr = safeStr(row.SyncID || '', '').toLowerCase();
        const supplyLocDerived = syncIdStr.includes('tilburg') ? 'Tilburg' : syncIdStr.includes('emmen') ? 'Emmen' : safeStr(row.CenterDescription || row.DS_CENTER_DESCRIPTION, 'Overig');

        // ── Globaal depot-totaal per jaar (ongeacht chauffeur, ook Aantal=0 telt als 1) ──
        {
          const globalCust = safeStr(row.Klant || row.DS_ENTITY_DESCRIPTION || row.CustomerName, '');
          if (isDepotCustomer(globalCust) || isDepotCustomer(supplyLocDerived)) {
            const yr = parsedDate.getFullYear();
            depotTotalByYear.set(yr, (depotTotalByYear.get(yr) || 0) + (aantal > 0 ? aantal : 1));
          }
        }

        // ── Chauffeur-statistieken: ALLE historische data (geen cutoff) ──
        const driverRaw = safeStr(row.Gebruiker || row.UserName || row.Username || row.username || row.User, '');
        if (driverRaw && driverRaw !== 'Onbekend' && aantal > 0) {
          const dateKey = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`;
          if (!driverDays.has(driverRaw)) driverDays.set(driverRaw, new Map());
          const days = driverDays.get(driverRaw)!;
          if (!days.has(dateKey)) days.set(dateKey, { cylinders: 0, depotCylinders: 0, customers: new Map(), products: new Map(), date: parsedDate });
          const dd = days.get(dateKey)!;
          dd.cylinders += aantal;
          const cust = safeStr(row.Klant || row.DS_ENTITY_DESCRIPTION || row.CustomerName, '');
          if (isDepotCustomer(cust)) {
            dd.depotCylinders += aantal;
          }
          if (cust && cust !== 'Onbekend') dd.customers.set(cust, (dd.customers.get(cust) || 0) + aantal);
          const prod = safeStr(row.Product || row.ContentDescription, '');
          if (prod && prod !== 'Onbekend') dd.products.set(prod, (dd.products.get(prod) || 0) + aantal);
        }

        // ── Voorspellingen & klanthistorie ──
        const customerName = row.Klant || row.DS_ENTITY_DESCRIPTION || row.CustomerName;
        const productName  = row.Product || row.ContentDescription;
        if (!productName || !customerName) continue;

        if (parsedDate < cutoff) continue;

        const key = `${customerName}__${productName}__${cap}__${supplyLocDerived}`;
        if (!customerHistory.has(key)) customerHistory.set(key, []);

        customerHistory.get(key)!.push({
          date: parsedDate,
          aantal,
          cap,
          city: safeStr(row.Stad || row.TX_CITY || row.City || row.CustomerCity, 'Unknown'),
          product: safeStr(productName),
          customer: safeStr(customerName),
          supplyLocation: supplyLocDerived,
          driver: safeStr(row.Gebruiker || row.UserName || row.Username || row.username || row.User)
        });
      }

      const hotspots: CustomerHotspot[] = [];
      const productDemand7Days = new Map<string, number>();
      const productDemand10Days = new Map<string, number>();

      // ── Vulplanning: vraag per (pKey, dagIndex 0..N-1) over komende werkdagen ──
      const FILL_PLAN_DAYS = 5; // werkdagen
      // Bouw lijst van komende werkdagen (ma-vr), startend bij vandaag (of eerstvolgende werkdag)
      const planDays: { date: Date; key: string }[] = [];
      {
        const cursor = new Date(today);
        while (planDays.length < FILL_PLAN_DAYS) {
          const dow = cursor.getDay(); // 0 zo, 6 za
          if (dow !== 0 && dow !== 6) {
            const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
            planDays.push({ date: new Date(cursor), key });
          }
          cursor.setDate(cursor.getDate() + 1);
        }
      }
      const planLastDate = planDays[planDays.length - 1].date;
      // demandPerDay[pKey] = number[FILL_PLAN_DAYS]
      const demandPerDay = new Map<string, number[]>();
      const ensureDemandRow = (pKey: string) => {
        let row = demandPerDay.get(pKey);
        if (!row) { row = new Array(FILL_PLAN_DAYS).fill(0); demandPerDay.set(pKey, row); }
        return row;
      };
      const dayIndexFor = (d: Date): number => {
        // Map elke datum naar eerstvolgende werkdag-slot binnen het venster
        if (d < today) {
          // Achterstallig → eerste werkdag (vandaag/eerstvolgende werkdag)
          return 0;
        }
        for (let i = 0; i < planDays.length; i++) {
          if (d <= planDays[i].date) return i;
        }
        return -1; // buiten venster
      };

      for (const [key, deliveries] of customerHistory.entries()) {
        // Sort by date ascending
        deliveries.sort((a, b) => a.date.getTime() - b.date.getTime());

        // Track latest delivery date per product-location-cap (all customers, even single delivery)
        for (const del of deliveries) {
          const locStr = del.supplyLocation.toLowerCase();
          const loc = locStr.includes('tilburg') ? 'Tilburg' : locStr.includes('emmen') ? 'Emmen' : 'Overig';
          const dPKey = `${del.product}__${loc}__${del.cap}`;
          const existing = lastDeliveryPerPKey.get(dPKey);
          if (!existing || del.date > existing) lastDeliveryPerPKey.set(dPKey, del.date);
        }

        if (deliveries.length < 2) continue; // Need at least 2 deliveries to calculate interval
        
        // Calculate average interval and average stuks per delivery
        let totalDays   = 0;
        let totalAantal = 0;

        for (let i = 1; i < deliveries.length; i++) {
          const days = differenceInDays(deliveries[i].date, deliveries[i-1].date);
          if (days > 0) totalDays += days;
          totalAantal += deliveries[i].aantal; // bundels blijven bundels — eenheid consistent met voorraad
        }

        const avgInterval = Math.max(1, Math.round(totalDays / (deliveries.length - 1)));
        const avgAmount   = totalAantal / (deliveries.length - 1); // avg stuks per delivery
        const capPerUnit  = deliveries[deliveries.length - 1].cap; // capacity of this cylinder type
        const lastDelivery = deliveries[deliveries.length - 1];

        // Skip inactive customers: last delivery was more than 2× the average interval ago
        const daysSinceLast = differenceInDays(today, lastDelivery.date);
        if (daysSinceLast > avgInterval * 2) {
          // Churn risk: klant had regelmatig patroon maar is gestopt
          // Minimaal 3 leveringen voor betrouwbaar patroon
          if (deliveries.length >= 3) {
            const riskLevel: ChurnRisk['riskLevel'] = daysSinceLast > avgInterval * 3 ? 'Hoog' : 'Middel';
            const products = [...new Set(deliveries.map(d => d.product))];
            const existing = churnRiskMap.get(lastDelivery.customer);
            if (!existing) {
              churnRiskMap.set(lastDelivery.customer, {
                customerName: lastDelivery.customer,
                city: lastDelivery.city,
                lastDeliveryDate: lastDelivery.date,
                daysSinceLastDelivery: daysSinceLast,
                avgInterval,
                overdueBy: daysSinceLast - avgInterval,
                totalDeliveries: deliveries.length,
                avgCylindersPerDelivery: Math.round(totalAantal / (deliveries.length - 1)),
                products,
                driver: lastDelivery.driver !== 'Onbekend' ? lastDelivery.driver : undefined,
                riskLevel,
              });
            } else {
              // Merge producten; escaleer risico indien hoger
              for (const p of products) {
                if (!existing.products.includes(p)) existing.products.push(p);
              }
              if (riskLevel === 'Hoog') existing.riskLevel = 'Hoog';
              if (daysSinceLast > existing.daysSinceLastDelivery) {
                existing.daysSinceLastDelivery = daysSinceLast;
                existing.overdueBy = daysSinceLast - existing.avgInterval;
              }
            }
          }
          continue;
        }

        const nextDate = addDays(lastDelivery.date, avgInterval);

        // If next date is already passed or within 10 days, we aggregate demand
        if (isBefore(nextDate, in10Days)) {
          const product = lastDelivery.product;
          const supplyLocStr = lastDelivery.supplyLocation.toLowerCase();
          const location = supplyLocStr.includes('tilburg') ? 'Tilburg' : supplyLocStr.includes('emmen') ? 'Emmen' : 'Overig';
          const pKey = `${product}__${location}__${capPerUnit}`;

          if (isBefore(nextDate, in7Days)) {
            productDemand7Days.set(pKey, (productDemand7Days.get(pKey) || 0) + avgAmount);
            hotspots.push({
              customerName: lastDelivery.customer,
              city: lastDelivery.city,
              products: [product],
              nextDeliveryDate: nextDate,
              avgInterval,
              urgency: 'Kritiek',
              driver: lastDelivery.driver,
            });
          } else {
            productDemand10Days.set(pKey, (productDemand10Days.get(pKey) || 0) + avgAmount);

            hotspots.push({
              customerName: lastDelivery.customer,
              city: lastDelivery.city,
              products: [product],
              nextDeliveryDate: nextDate,
              avgInterval,
              urgency: 'Actie',
              driver: lastDelivery.driver,
            });
          }
        }

        // ── Vulplanning: voeg verwachte leveringen binnen het werkdag-venster toe ──
        {
          const product = lastDelivery.product;
          const supplyLocStr = lastDelivery.supplyLocation.toLowerCase();
          const location = supplyLocStr.includes('tilburg') ? 'Tilburg' : supplyLocStr.includes('emmen') ? 'Emmen' : 'Overig';
          const pKey = `${product}__${location}__${capPerUnit}`;
          // Stap door volgende verwachte leveringen
          let cursorDate = new Date(nextDate);
          let safety = 0;
          while (cursorDate <= planLastDate && safety < 20) {
            const idx = dayIndexFor(cursorDate);
            if (idx >= 0) {
              const row = ensureDemandRow(pKey);
              row[idx] += avgAmount;
            }
            cursorDate = addDays(cursorDate, avgInterval);
            safety++;
          }
        }
      }

      // Group hotspots by customer if they need multiple products
      const groupedHotspots = Array.from(hotspots.reduce((acc, curr) => {
        if (!acc.has(curr.customerName)) {
          acc.set(curr.customerName, curr);
        } else {
          const existing = acc.get(curr.customerName)!;
          if (!existing.products.includes(curr.products[0])) {
            existing.products.push(curr.products[0]);
          }
          if (isBefore(curr.nextDeliveryDate, existing.nextDeliveryDate)) {
            existing.nextDeliveryDate = curr.nextDeliveryDate;
            existing.urgency = curr.urgency === 'Kritiek' || existing.urgency === 'Kritiek' ? 'Kritiek' : 'Actie';
          }
          if (curr.driver && curr.driver !== 'Onbekend') {
             existing.driver = curr.driver; // Inherit concrete drivers
          }
        }
        return acc;
      }, new Map<string, CustomerHotspot>()).values()).sort((a, b) => a.nextDeliveryDate.getTime() - b.nextDeliveryDate.getTime());

      // 2. Aggregate current stock (Voorraad) — key includes capacity per unit
      const stockMap = new Map<string, { current: number, capacityPerUnit: number, location: string }>();
      for (const row of voorraadRows) {
        const product = safeStr(row.ContentDescription || row.SubCodeDescription || row.Product, '');
        if (!product || product === 'Onbekend') continue;

        const rawLoc = safeStr(row.DS_ENTITY_DESCRIPTION || row.CenterDescription || row.DS_CENTER_DESCRIPTION || row.Locatie, '');
        const locStr = rawLoc.toLowerCase();
        const location = locStr.includes('tilburg') ? 'Tilburg' : locStr.includes('emmen') ? 'Emmen' : 'Overig';
        const rowCapacity = Math.max(1, Number(row.Capacity || row.Capaciteit) || 1);
        const key = `${product}__${location}__${rowCapacity}`;

        const rowAantal = Number(row.Aantal) || 0;

        if (!stockMap.has(key)) {
          stockMap.set(key, { current: 0, capacityPerUnit: rowCapacity, location });
        }
        stockMap.get(key)!.current += rowAantal; // stuks
      }

      // 3. Gap Analysis
      const predictions: GasFlowPrediction[] = [];
      const allKeys = new Set([...Array.from(stockMap.keys()), ...Array.from(productDemand7Days.keys())]);

      for (const pKey of allKeys) {
        const parts = pKey.split('__');
        if (parts.length < 3) continue;
        const [product, location, capStr] = parts;
        if (!product || !location || product === 'Onbekend') continue;
        const capacityPerUnit = Number(capStr) || 1;

        const stock = stockMap.get(pKey) || { current: 0, capacityPerUnit, location };
        const d7  = productDemand7Days.get(pKey)  || 0;
        const d10 = (productDemand10Days.get(pKey) || 0) + d7;

        let status: 'Kritiek' | 'Actie' | 'OK' = 'OK';
        if (stock.current < d7 && d7 > 0) status = 'Kritiek';
        else if (stock.current < d10 && d10 > 0) status = 'Actie';
        else if (stock.current <= 0 && (d7 > 0 || d10 > 0)) status = 'Kritiek';

        if (d7 > 0 || stock.current > 0) {
          predictions.push({
            product,
            location,
            capacityPerUnit,
            currentStock: stock.current,
            capacity: stock.current * capacityPerUnit, // total liters
            predictedDemand7Days:  Math.round(d7),
            predictedDemand10Days: Math.round(d10),
            deficit: status === 'Kritiek' ? Math.round(d7 - stock.current) : 0,
            status
          });
        }
      }

      predictions.sort((a, b) => {
        if (a.status === 'Kritiek' && b.status !== 'Kritiek') return -1;
        if (b.status === 'Kritiek' && a.status !== 'Kritiek') return 1;
        if (a.status === 'Actie' && b.status === 'OK') return -1;
        if (b.status === 'Actie' && a.status === 'OK') return 1;
        return b.deficit - a.deficit;
      });

      // 4. Dead Stock Detection — voorraad zonder voorspelde vraag én geen levering de afgelopen 60 dagen
      const DEAD_STOCK_DAYS = 60;
      const deadStock: DeadStockItem[] = [];

      for (const pKey of stockMap.keys()) {
        const parts = pKey.split('__');
        if (parts.length < 3) continue;
        const [product, location, capStr] = parts;
        if (!product || !location || product === 'Onbekend') continue;
        const capacityPerUnit = Number(capStr) || 1;
        const stock = stockMap.get(pKey)!;
        if (stock.current <= 0) continue;
        if (productDemand7Days.has(pKey) || productDemand10Days.has(pKey)) continue;

        const lastDel = lastDeliveryPerPKey.get(pKey);
        const daysSince = lastDel ? differenceInDays(today, lastDel) : null;

        if (daysSince === null || daysSince > DEAD_STOCK_DAYS) {
          deadStock.push({ product, location, capacityPerUnit, currentStock: stock.current, daysSinceLastDelivery: daysSince });
        }
      }
      deadStock.sort((a, b) => b.currentStock - a.currentStock);

      // ── Bouw FillPlan: per product+locatie de dag-per-dag projectie ──
      const fillPlan: FillPlanItem[] = [];
      const SAFETY_BUFFER = 0; // stuks; verhogen voor extra marge
      const allFillKeys = new Set<string>([
        ...Array.from(demandPerDay.keys()),
      ]);
      for (const pKey of allFillKeys) {
        const parts = pKey.split('__');
        if (parts.length < 3) continue;
        const [product, location, capStr] = parts;
        if (!product || !location || product === 'Onbekend') continue;
        const capacityPerUnit = Number(capStr) || 1;
        const stock = stockMap.get(pKey);
        const startStock = stock ? stock.current : 0;
        const demands = demandPerDay.get(pKey)!;
        // Som vraag — als nul, sla over
        const totalDemand = demands.reduce((s, d) => s + d, 0);
        if (totalDemand <= 0) continue;

        let running = startStock;
        let totalFill = 0;
        const perDay = planDays.map((pd, i) => {
          const expectedDemand = Math.round(demands[i]);
          const projectedStockBefore = Math.round(running);
          const projectedStockAfter = Math.round(running - expectedDemand);
          let suggestedFill = 0;
          if (projectedStockAfter < SAFETY_BUFFER) {
            suggestedFill = Math.ceil(SAFETY_BUFFER - projectedStockAfter);
          }
          totalFill += suggestedFill;
          const endStock = projectedStockAfter + suggestedFill;
          running = endStock;
          return {
            date: pd.key,
            expectedDemand,
            projectedStockBefore,
            projectedStockAfter,
            suggestedFill,
            endStock: Math.round(endStock),
          };
        });

        fillPlan.push({
          product, location, capacityPerUnit,
          startStock: Math.round(startStock),
          totalExpectedDemand: Math.round(totalDemand),
          totalSuggestedFill: totalFill,
          perDay,
        });
      }
      // Sorteer: meest dringend (vroegste vulling eerst, dan grootste totaalvulling)
      fillPlan.sort((a, b) => {
        const aFirstFillDay = a.perDay.findIndex(p => p.suggestedFill > 0);
        const bFirstFillDay = b.perDay.findIndex(p => p.suggestedFill > 0);
        const aDay = aFirstFillDay === -1 ? 999 : aFirstFillDay;
        const bDay = bFirstFillDay === -1 ? 999 : bFirstFillDay;
        if (aDay !== bDay) return aDay - bDay;
        return b.totalSuggestedFill - a.totalSuggestedFill;
      });

      // Per-dag aggregatie voor "wat moet vandaag/morgen gevuld worden"
      const fillPlanByDay: FillPlanDay[] = planDays.map((pd, i) => {
        const items = fillPlan
          .filter(fp => fp.perDay[i].suggestedFill > 0)
          .map(fp => ({
            product: fp.product,
            location: fp.location,
            capacityPerUnit: fp.capacityPerUnit,
            expectedDemand: fp.perDay[i].expectedDemand,
            projectedStockBefore: fp.perDay[i].projectedStockBefore,
            suggestedFill: fp.perDay[i].suggestedFill,
          }))
          .sort((a, b) => b.suggestedFill - a.suggestedFill);
        const dayLabel = pd.date.toLocaleDateString('nl-NL', { weekday: 'short', day: 'numeric', month: 'short' });
        return {
          date: pd.key,
          dayLabel,
          totalExpectedDemand: items.reduce((s, it) => s + it.expectedDemand, 0),
          totalSuggestedFill: items.reduce((s, it) => s + it.suggestedFill, 0),
          items,
        };
      });

      // 5. Driver Statistics
      const last6Months: string[] = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
        last6Months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      }

      const driverStats: DriverStat[] = [];
      for (const [driver, days] of driverDays.entries()) {
        const daysArr = Array.from(days.values());
        const totalCylinders = daysArr.reduce((s, d) => s + d.cylinders, 0);

        // Aggregate customers and products across all days
        const custTotals = new Map<string, number>();
        const prodTotals = new Map<string, number>();
        for (const d of daysArr) {
          for (const [c, n] of d.customers) custTotals.set(c, (custTotals.get(c) || 0) + n);
          for (const [p, n] of d.products)  prodTotals.set(p, (prodTotals.get(p) || 0) + n);
        }

        const topProducts = Array.from(prodTotals.entries())
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([product, total]) => ({ product, total }));
        const topCustomers = Array.from(custTotals.entries())
          .sort((a, b) => b[1] - a[1]).slice(0, 5)
          .map(([customer, total]) => ({ customer, total }));

        const lastDeliveryDate = daysArr.reduce((max, d) => d.date > max ? d.date : max, daysArr[0].date);

        // Monthly totals (last 6 months)
        const monthMap = new Map<string, number>();
        for (const d of daysArr) {
          const mKey = `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}`;
          monthMap.set(mKey, (monthMap.get(mKey) || 0) + d.cylinders);
        }
        const monthlyTotals = last6Months.map(m => ({ month: m, cylinders: monthMap.get(m) || 0 }));

        // Day-of-week totals: 0=Ma … 6=Zo
        const dotw = new Array(7).fill(0);
        for (const d of daysArr) {
          const dow = (d.date.getDay() + 6) % 7; // JS: 0=Sun → remap to Mon=0
          dotw[dow] += d.cylinders;
        }

        // Recent days — last 90 days, sorted ascending
        const cutoff90 = addDays(today, -90);
        const recentDays = Array.from(days.entries())
          .filter(([, d]) => d.date >= cutoff90)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([date, d]) => ({ date, cylinders: d.cylinders, customers: d.customers.size }));

        // Weekly totals — last 12 ISO-ish weeks (Mon-based)
        const weekMap = new Map<string, { cylinders: number; days: number }>();
        for (const d of daysArr) {
          // ISO week: get Monday of the week
          const tmp = new Date(d.date);
          const dow = (tmp.getDay() + 6) % 7; // Mon=0
          tmp.setDate(tmp.getDate() - dow);
          const wKey = `${tmp.getFullYear()}-${String(tmp.getMonth() + 1).padStart(2, '0')}-${String(tmp.getDate()).padStart(2, '0')}`;
          if (!weekMap.has(wKey)) weekMap.set(wKey, { cylinders: 0, days: 0 });
          const w = weekMap.get(wKey)!;
          w.cylinders += d.cylinders;
          w.days += 1;
        }
        const weeklyTotals = Array.from(weekMap.entries())
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-12)
          .map(([week, v]) => ({ week, cylinders: v.cylinders, days: v.days }));

        // Per-jaar statistieken
        const yearGroupMap = new Map<number, typeof daysArr>();
        for (const d of daysArr) {
          const y = d.date.getFullYear();
          if (!yearGroupMap.has(y)) yearGroupMap.set(y, []);
          yearGroupMap.get(y)!.push(d);
        }
        const perYear: PerYearStat[] = Array.from(yearGroupMap.entries())
          .sort(([a], [b]) => a - b)
          .map(([year, yDays]) => {
            const yTotal = yDays.reduce((s, d) => s + d.cylinders, 0);
            const yDepotTotal = yDays.reduce((s, d) => s + d.depotCylinders, 0);
            const yCust = new Map<string, number>();
            const yProd = new Map<string, number>();
            for (const d of yDays) {
              for (const [c, n] of d.customers) yCust.set(c, (yCust.get(c) || 0) + n);
              for (const [p, n] of d.products)  yProd.set(p, (yProd.get(p) || 0) + n);
            }
            const yMonthMap = new Map<string, number>();
            for (const d of yDays) {
              const mk = `${year}-${String(d.date.getMonth() + 1).padStart(2, '0')}`;
              yMonthMap.set(mk, (yMonthMap.get(mk) || 0) + d.cylinders);
            }
            const yMonthlyTotals = Array.from({ length: 12 }, (_, i) => {
              const mk = `${year}-${String(i + 1).padStart(2, '0')}`;
              return { month: mk, cylinders: yMonthMap.get(mk) || 0 };
            });
            const yDotw = new Array(7).fill(0);
            for (const d of yDays) yDotw[(d.date.getDay() + 6) % 7] += d.cylinders;
            const yWeekMap = new Map<string, { cylinders: number; days: number }>();
            for (const d of yDays) {
              const tmp = new Date(d.date);
              const wdow = (tmp.getDay() + 6) % 7;
              tmp.setDate(tmp.getDate() - wdow);
              const wKey = `${tmp.getFullYear()}-${String(tmp.getMonth() + 1).padStart(2, '0')}-${String(tmp.getDate()).padStart(2, '0')}`;
              if (!yWeekMap.has(wKey)) yWeekMap.set(wKey, { cylinders: 0, days: 0 });
              const yw = yWeekMap.get(wKey)!; yw.cylinders += d.cylinders; yw.days += 1;
            }
            const yWeeklyTotals = Array.from(yWeekMap.entries())
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([week, v]) => ({ week, cylinders: v.cylinders, days: v.days }));
            const yAllDays = [...yDays]
              .sort((a, b) => a.date.getTime() - b.date.getTime())
              .map(d => ({
                date: `${d.date.getFullYear()}-${String(d.date.getMonth() + 1).padStart(2, '0')}-${String(d.date.getDate()).padStart(2, '0')}`,
                cylinders: d.cylinders, customers: d.customers.size,
              }));
            const yLast = yDays.reduce((max, d) => d.date > max ? d.date : max, yDays[0].date);
            return {
              year, totalCylinders: yTotal, totalDepotCylinders: yDepotTotal, totalDeliveryDays: yDays.length,
              avgCylindersPerDay: Math.round(yTotal / yDays.length),
              uniqueCustomers: yCust.size,
              topProducts: Array.from(yProd.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([product, total]) => ({ product, total })),
              topCustomers: Array.from(yCust.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([customer, total]) => ({ customer, total })),
              monthlyTotals: yMonthlyTotals, dayOfWeekTotals: yDotw,
              weeklyTotals: yWeeklyTotals, allDays: yAllDays, lastDeliveryDate: yLast,
            };
          });

        const totalDepotCylinders = daysArr.reduce((s, d) => s + d.depotCylinders, 0);
        driverStats.push({
          driver,
          totalCylinders,
          totalDepotCylinders,
          totalDeliveryDays: daysArr.length,
          avgCylindersPerDay: Math.round(totalCylinders / daysArr.length),
          uniqueCustomers: custTotals.size,
          topProducts,
          topCustomers,
          lastDeliveryDate,
          monthlyTotals,
          dayOfWeekTotals: dotw,
          recentDays,
          weeklyTotals,
          perYear,
        });
      }
      driverStats.sort((a, b) => b.totalCylinders - a.totalCylinders);

      // 6. Churn risks — sorteer: Hoog eerst, daarna op meeste dagen te laat
      const churnRisks = Array.from(churnRiskMap.values()).sort((a, b) => {
        if (a.riskLevel === 'Hoog' && b.riskLevel !== 'Hoog') return -1;
        if (b.riskLevel === 'Hoog' && a.riskLevel !== 'Hoog') return 1;
        return b.overdueBy - a.overdueBy;
      });

      // Find most recent Afname date
      let lastAfnameDate: Date | null = null;
      for (const row of afnameRows) {
        if (!row.Datum) continue;
        const dateRaw = row.Datum;
        let d: Date | null = null;
        if (typeof dateRaw === 'string') {
          const s = dateRaw.replace(/\s/g, '');
          if (s.length === 8 && /^\d{8}$/.test(s)) {
            d = new Date(parseInt(s.slice(0, 4)), parseInt(s.slice(4, 6)) - 1, parseInt(s.slice(6, 8)));
          } else {
            const parsed = new Date(s);
            if (!isNaN(parsed.getTime())) d = parsed;
          }
        }
        if (d && !isNaN(d.getTime()) && (!lastAfnameDate || d > lastAfnameDate)) lastAfnameDate = d;
      }

      return {
        predictions,
        hotspots: groupedHotspots,
        deadStock,
        driverStats,
        depotTotalByYear,
        churnRisks,
        fillPlan,
        fillPlanByDay,
        lastUpdated: new Date(),
        _diagnostics: {
          afnameRows: afnameRows.length,
          voorraadRows: voorraadRows.length,
          lastAfnameDate,
        }
      };
    },
    refetchInterval: 5 * 60 * 1000 // Refetch every 5 mins
  });
}
