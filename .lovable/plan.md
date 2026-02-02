
# Plan: Trend Indicators voor Productie-Statistieken

## Overzicht
Dit plan voegt trend indicators toe aan de productie-statistieken in twee delen van de applicatie: de "quick stats" op de Productieplanning pagina en de statistiek cards in de Rapportage sectie.

---

## Wat wordt aangepast

### 1. ProductionPlanning Quick Stats
De 4 statistiek cards bovenaan de productieplanning krijgen trend indicators:

| Card | Huidige waarde | Trend vergelijking |
|------|----------------|-------------------|
| Droogijs vandaag | X kg | vs. vorige week zelfde dag |
| Gascilinders vandaag | X stuks | vs. vorige week zelfde dag |
| Orders deze week | X orders | vs. vorige week |
| Voorraadstatus | Status | (geen trend - behoud huidige weergave) |

**Visuele weergave:**
- Groene pijl omhoog met percentage bij toename
- Rode pijl omlaag met percentage bij afname
- Grijze streep bij geen verandering

### 2. ProductionReports Quick Stats
De 6 statistiek cards in de rapportage sectie krijgen trend indicators:

| Card | Huidige waarde | Trend vergelijking |
|------|----------------|-------------------|
| Cilinder orders | X orders | vs. vorige periode |
| Totaal cilinders | X stuks | vs. vorige periode |
| Droogijs orders | X orders | vs. vorige periode |
| Totaal droogijs | X kg | vs. vorige periode |
| Voltooid | X orders | vs. vorige periode |
| Gepland | X orders | vs. vorige periode |

**Logica:** De trend wordt berekend door dezelfde periode in het verleden te vergelijken (bijv. als je "deze maand" selecteert, wordt vergeleken met vorige maand).

---

## Technische Implementatie

### Stap 1: Uitbreiden van ProductionPlanning.tsx

**Nieuwe state variabelen:**
```typescript
const [previousDryIceToday, setPreviousDryIceToday] = useState(0);
const [previousCylindersToday, setPreviousCylindersToday] = useState(0);
const [previousWeekOrders, setPreviousWeekOrders] = useState(0);
```

**Uitbreiding fetchStats():**
- Query voor dezelfde dag vorige week (droogijs/cilinders)
- Query voor vorige week totaal (orders)

**UI aanpassing:**
- Vervang huidige Card componenten door `StatCard` component
- Voeg `trend` prop toe met berekende waarde

### Stap 2: Uitbreiden van ProductionReports.tsx

**Nieuwe state variabelen:**
```typescript
const [previousPeriodStats, setPreviousPeriodStats] = useState({
  cylinderOrders: 0,
  totalCylinders: 0,
  dryIceOrders: 0,
  totalDryIce: 0,
  completed: 0,
  pending: 0
});
```

**Uitbreiding fetchReportData():**
- Bereken "vorige periode" datum range (zelfde lengte, direct ervoor)
- Fetch dezelfde data voor de vorige periode
- Bereken statistieken voor vergelijking

**UI aanpassing:**
- Importeer en gebruik `StatCard` component
- Vervang huidige Cards door StatCards met trend indicators

### Stap 3: Trend Berekening Utility

Hergebruik bestaande `calculateTrend` functie uit KPIDashboard of extraheer naar shared utility:

```typescript
const calculateTrend = (current: number, previous: number): number => {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
};
```

---

## Visueel Resultaat

**ProductionPlanning (voor):**
```
┌─────────────────┐ ┌─────────────────┐
│ Droogijs vandaag│ │ Cilinders vandaag│
│     250 kg      │ │       45        │
└─────────────────┘ └─────────────────┘
```

**ProductionPlanning (na):**
```
┌─────────────────┐ ┌─────────────────┐
│ Droogijs vandaag│ │ Cilinders vandaag│
│   250 kg  ↑+12% │ │    45     ↓-5%  │
│ vs. vorige week │ │ vs. vorige week │
└─────────────────┘ └─────────────────┘
```

---

## Bestanden die worden aangepast

1. `src/components/production/ProductionPlanning.tsx`
   - Import StatCard component
   - Uitbreiden fetchStats met vorige periode queries
   - Vervangen Card componenten door StatCard met trends

2. `src/components/production/ProductionReports.tsx`
   - Import StatCard component
   - Toevoegen state voor vorige periode statistieken
   - Uitbreiden fetchReportData met vorige periode queries
   - Vervangen Quick Stats Cards door StatCard met trends

---

## Performance Overwegingen

- **Parallelle queries:** Vorige periode data wordt parallel gefetched met huidige data
- **Caching:** Trends worden pas herberekend bij datum/locatie wijziging
- **Minimale overhead:** Slechts 2-3 extra database queries per pagina load
