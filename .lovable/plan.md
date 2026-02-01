

# Plan: Fix Gascilinder Overzicht Data Limiet

## Probleemanalyse

Na onderzoek van de database en code:

- **Database**: Januari 2026 bevat **1445 orders** met **25.914 cilinders**
- **Weergave**: Slechts 1000 orders worden getoond
- **Oorzaak**: De oude code zonder maandfilter raakte de Supabase 1000-rij limiet

De recente wijziging met maandfiltering en `limit(5000)` zou dit probleem moeten oplossen, maar er zijn nog twee aandachtspunten:

## Huidige Status

| Component | Limiet | Status |
|-----------|--------|--------|
| GasCylinderPlanning.tsx | `limit(5000)` | Correct |
| ProductionReports.tsx | `range(0, 9999)` | Kan verbeterd |

## Oplossing

### Stap 1: Verifieer dat de nieuwe code actief is
De gebruiker moet de pagina vernieuwen (Ctrl+F5) om de nieuwe code met maandfiltering te laden.

### Stap 2: Pas ProductionReports.tsx aan voor consistentie
Wijzig de query methode van `.range(0, 9999)` naar hetzelfde patroon als GasCylinderPlanning:
- Gebruik maandelijkse filtering of een hogere limiet
- Voor periodes langer dan een maand: laad data per maand parallel

### Stap 3: Implementeer maandelijkse parallelle loading in rapportages

```typescript
const fetchMonthData = async (year: number, month: number) => {
  const monthStr = String(month).padStart(2, '0');
  const startDate = `${year}-${monthStr}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, '0')}`;
  
  return supabase
    .from("gas_cylinder_orders")
    .select(`*, gas_type_ref:gas_types(id, name, color)`)
    .gte("scheduled_date", startDate)
    .lte("scheduled_date", endDate)
    .limit(5000);
};

// Voor periodes die meerdere maanden omvatten:
const fetchDataForRange = async (from: Date, to: Date) => {
  const months = getMonthsInRange(from, to);
  const promises = months.map(({ year, month }) => fetchMonthData(year, month));
  const results = await Promise.all(promises);
  return results.flatMap(r => r.data || []);
};
```

---

## Technische Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `ProductionReports.tsx` | Implementeer maandelijkse data loading met `Promise.all` |
| `ProductionReports.tsx` | Verwijder `.range(0, 9999)` en vervang door `limit(5000)` per maand |

---

## Verwacht Resultaat

Na implementatie:
- Alle 1445 orders van januari 2026 worden correct getoond
- Rapportages kunnen periodes van meerdere maanden aan zonder datalimiet
- Consistente aanpak over alle componenten

