

# Plan: Live Dashboard Refresh gebaseerd op Rapportageperiode

## Overzicht
De KPI Dashboard, statistiek kaarten en Top 5 Klanten widget zullen dynamisch worden bijgewerkt wanneer de datumperiode in de Rapportage tab wordt gewijzigd.

## Huidige Situatie

De productieplanning componenten werken momenteel als volgt:
- **KPI Dashboard**: Toont data voor het huidige jaar vs vorig jaar
- **Statistiek kaarten**: Tonen data voor vandaag en deze week
- **Top 5 Klanten widget**: Toont data voor het huidige kalenderjaar

Deze widgets negeren de datumperiode selectie in Rapportage en gebruiken hun eigen vaste datumlogica.

## Oplossing

### Architectuur Wijziging

```text
ProductionPlanning (parent)
    │
    ├── dateRange state (nieuw - lift up from ProductionReports)
    │
    ├── KPIDashboard
    │   └── Props: location, refreshKey, dateRange (nieuw)
    │
    ├── Stat Cards (inline)
    │   └── Nu gebaseerd op dateRange
    │
    ├── TopCustomersWidget
    │   └── Props: refreshKey, location, dateRange (nieuw)
    │
    └── ProductionReports
        └── Props: dateRange, onDateRangeChange (nieuw callback)
```

### Bestandswijzigingen

#### 1. ProductionPlanning.tsx
- Voeg `dateRange` state toe op parent niveau
- Maak `handleDateRangeChange` callback functie
- Pas `fetchStats()` aan om dateRange te gebruiken i.p.v. "vandaag"
- Geef `dateRange` door aan KPIDashboard en TopCustomersWidget
- Geef `dateRange` en `onDateRangeChange` door aan ProductionReports

#### 2. ProductionReports.tsx
- Verwijder interne `dateRange` state
- Ontvang `dateRange` en `onDateRangeChange` via props
- Roep `onDateRangeChange` aan bij preset knoppen en kalender selectie

#### 3. KPIDashboard.tsx
- Voeg optionele `dateRange` prop toe
- Wanneer dateRange aanwezig is: gebruik deze periode voor berekeningen
- Wanneer dateRange afwezig is: behoud huidige gedrag (jaar-totalen)
- Pas sparkline data op om alleen de geselecteerde periode te tonen

#### 4. TopCustomersWidget.tsx
- Voeg optionele `dateRange` prop toe
- Wanneer dateRange aanwezig is: filter klanten op deze periode
- Maak nieuwe RPC functie of pas client-side filtering toe

### Technische Details

**ProductionPlanning.tsx:**
```typescript
// Nieuwe state
const [dateRange, setDateRange] = useState<DateRange>({
  from: startOfMonth(new Date()),
  to: endOfMonth(new Date())
});

// Aangepaste fetchStats die dateRange gebruikt
const fetchStats = async () => {
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");
  
  // Query dry ice en cylinder orders binnen dateRange
  // ...
};

// In render:
<KPIDashboard 
  location={selectedLocation} 
  refreshKey={refreshKey}
  dateRange={dateRange}
/>

<TopCustomersWidget
  refreshKey={refreshKey}
  location={selectedLocation}
  dateRange={dateRange}
/>

<ProductionReports 
  refreshKey={refreshKey} 
  onDataChanged={handleDataChanged} 
  location={selectedLocation}
  dateRange={dateRange}
  onDateRangeChange={setDateRange}
/>
```

**KPIDashboard.tsx:**
```typescript
interface KPIDashboardProps {
  location: ProductionLocation;
  refreshKey?: number;
  dateRange?: DateRange; // Nieuw
}

// In fetchKPIData:
if (dateRange) {
  // Gebruik dateRange voor queries
  const fromStr = format(dateRange.from, "yyyy-MM-dd");
  const toStr = format(dateRange.to, "yyyy-MM-dd");
  // ... filter op deze periode
} else {
  // Bestaand gedrag (jaar-totalen)
}
```

### UX Verbeteringen

1. **Visuele feedback**: Toon een badge bij elk widget met de actieve periode
2. **Loading states**: Toon skeleton tijdens het herladen
3. **Smooth transitions**: Gebruik bestaande FadeIn en refresh animaties

### Trend Berekeningen

Bij gebruik van een custom dateRange worden trends berekend als:
- **Vorige periode**: Dezelfde duur, direct voorafgaand aan de geselecteerde periode
- Voorbeeld: Als je "Vorig jaar" selecteert, wordt de trend vergeleken met het jaar daarvoor

### Fallback Gedrag

Als geen dateRange prop wordt meegegeven, behouden alle widgets hun huidige standaard gedrag. Dit zorgt voor backwards compatibility.

