
# Plan: Beperken van Operator Interface tot Order Creatie

## Overzicht

Dit plan past de productieplanning-interface aan zodat operators alleen de essentiële functies zien voor hun dagelijkse werkzaamheden: het aanmaken van droogijs- en gascilinder-orders, plus de basale maandstatistieken.

## Wat Operators Zullen Zien

**Behouden:**
- Droogijs tab (order creatie)
- Gascilinders tab (order creatie)
- 3 basis statistiek-kaarten:
  - Droogijs gepland (kg)
  - Cilinders gepland
  - Totaal orders
- Locatiefilter (beperkt tot eigen locatie)

**Verborgen voor Operators:**
- KPI Dashboard (geavanceerde efficiëntiegrafieken)
- Top Klanten widget
- Voorraad overzicht widget
- Rapportage tab
- Veiligheid tab (optioneel, bespreken)
- Site Map tab
- Trailer tab

## Technische Aanpak

### Stap 1: Uitbreiden van Permissions Hook

Toevoegen van nieuwe permissie-vlaggen aan `useUserPermissions.ts`:

```text
canViewKPIDashboard: boolean
canViewAdvancedWidgets: boolean  // Top Customers, Stock Summary
```

Operator krijgt beide op `false`, Admin en Supervisor op `true`.

### Stap 2: Aanpassen ProductionPlanning.tsx

Conditoneel renderen van componenten op basis van permissions:

```text
ProductionPlanning Component
├── {permissions.canViewKPIDashboard && <KPIDashboard />}
├── Locatie Filter (altijd zichtbaar)
├── Quick Stats Grid
│   ├── Droogijs StatCard (altijd)
│   ├── Cilinders StatCard (altijd)
│   ├── Totaal Orders StatCard (altijd)
│   ├── {permissions.canViewAdvancedWidgets && <StockSummaryWidget />}
│   └── {permissions.canViewAdvancedWidgets && <TopCustomersWidget />}
└── Tabs
    ├── Droogijs (altijd)
    ├── Gascilinders (altijd)
    ├── {permissions.canViewReports && Rapportage}
    ├── {permissions.canViewReports && Veiligheid}
    ├── {permissions.canViewReports && Site Map}
    └── {permissions.canViewReports && Trailer}
```

### Stap 3: Dynamische Tab Rendering

Implementeren van een tabs-array die gefilterd wordt op basis van permissions:

```text
const availableTabs = [
  { id: "droogijs", show: true },
  { id: "gascilinders", show: true },
  { id: "rapportage", show: permissions.canViewReports },
  { id: "veiligheid", show: permissions.canViewReports },
  { id: "sitemap", show: permissions.canViewReports },
  { id: "trailer", show: permissions.canViewReports },
].filter(tab => tab.show)
```

## Bestanden die Gewijzigd Worden

| Bestand | Wijziging |
|---------|-----------|
| `src/hooks/useUserPermissions.ts` | Nieuwe permissie-vlaggen toevoegen |
| `src/components/production/ProductionPlanning.tsx` | Conditonele rendering van componenten en tabs |

## Visuele Vergelijking

### Admin/Supervisor View
```text
┌─────────────────────────────────────────────────┐
│ KPI Dashboard (grafieken, efficiëntie)          │
├─────────────────────────────────────────────────┤
│ Locatie: [Alle] [Emmen] [Tilburg]               │
├─────────────────────────────────────────────────┤
│ [Droogijs] [Cilinders] [Orders] [Stock] [Top5] │
├─────────────────────────────────────────────────┤
│ [Droogijs][Cilinders][Rapportage][Veilig][Map] │
└─────────────────────────────────────────────────┘
```

### Operator View (na wijziging)
```text
┌─────────────────────────────────────────────────┐
│ Locatie: [Emmen] (beperkt)                      │
├─────────────────────────────────────────────────┤
│ [Droogijs kg]  [Cilinders]  [Orders]            │
├─────────────────────────────────────────────────┤
│ [Droogijs]  [Gascilinders]                      │
└─────────────────────────────────────────────────┘
```

## Voordelen

1. **Eenvoudigere Interface** - Operators zien alleen wat relevant is
2. **Betere Focus** - Minder afleiding, snellere workflows
3. **Consistente Permissies** - Sluit aan bij bestaande `canViewReports` logica
4. **Geen Database Wijzigingen** - Puur frontend aanpassing
5. **Backward Compatible** - Geen impact op Admin/Supervisor workflows
