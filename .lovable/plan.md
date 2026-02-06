# Plan: Beperken van Operator Interface tot Order Creatie

## Status: ✅ Geïmplementeerd

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
- Veiligheid tab
- Site Map tab
- Trailer tab

## Geïmplementeerde Wijzigingen

### useUserPermissions.ts
Nieuwe permissie-vlaggen toegevoegd:
- `canViewKPIDashboard: boolean` - Voor KPI Dashboard toegang
- `canViewAdvancedWidgets: boolean` - Voor Top Customers & Stock Summary widgets

Operators krijgen beide op `false`, Admin en Supervisor op `true`.

### ProductionPlanning.tsx
Conditonele rendering geïmplementeerd:
- KPIDashboard alleen zichtbaar als `canViewKPIDashboard = true`
- StockSummaryWidget en TopCustomersWidget alleen als `canViewAdvancedWidgets = true`
- Rapportage, Veiligheid, Site Map, en Trailer tabs alleen als `canViewReports = true`
- Dynamische grid layout aanpassing (5 kolommen vs 3 kolommen)
- Dynamische TabsList kolommen (6 vs 2)

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

### Operator View (geïmplementeerd)
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
