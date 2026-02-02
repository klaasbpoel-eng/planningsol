
# Optimalisatieplan: Recharts Performance Verbetering

Dit plan beschrijft hoe we de huidige Recharts implementatie optimaliseren met lazy loading, memoization en code splitting voor betere performance zonder volledige migratie naar een andere library.

---

## Overzicht

De huidige implementatie bevat 5 grote chart componenten die samen meer dan 4.600 regels code bevatten. Deze worden allemaal direct geladen, zelfs als de gebruiker nooit naar de "Rapportage" tab navigeert.

### Huidige Situatie
- Alle chart componenten worden direct geimporteerd (geen lazy loading)
- Geen `React.memo` gebruikt op chart componenten
- `useMemo` wordt al goed gebruikt voor data processing
- `useCallback` wordt minimaal gebruikt
- Geen Vite code splitting configuratie

---

## Implementatiestappen

### Stap 1: Lazy Loading voor Zware Componenten

De "Jaarvergelijking" tab bevat 3 zeer zware componenten die alleen geladen hoeven te worden wanneer de gebruiker daadwerkelijk naar die tab navigeert.

**Bestanden:**
- `src/components/production/ProductionReports.tsx`

**Wijzigingen:**
- Importeer `React.lazy` en `Suspense`
- Vervang directe imports van `YearComparisonReport`, `CumulativeGasTypeChart`, en `CumulativeCylinderSizeChart` door lazy imports
- Wrap de componenten in `Suspense` met een loading fallback

### Stap 2: React.memo voor Chart Componenten

Voeg `React.memo` toe aan alle chart componenten om onnodige re-renders te voorkomen wanneer parent componenten updaten maar de props niet veranderen.

**Bestanden:**
- `src/components/production/CumulativeYearChart.tsx`
- `src/components/production/CumulativeGasTypeChart.tsx`
- `src/components/production/CumulativeCylinderSizeChart.tsx`
- `src/components/production/YearComparisonReport.tsx`
- `src/components/production/TopCustomersWidget.tsx`

**Wijzigingen per component:**
- Wrap de component export in `React.memo`
- Voeg `displayName` toe voor betere debugging

### Stap 3: Callback Memoization

Verbeter `useCallback` gebruik voor event handlers die aan child componenten worden doorgegeven.

**Bestanden:**
- `src/components/production/ProductionReports.tsx`
- `src/components/production/YearComparisonReport.tsx`

**Wijzigingen:**
- Wrap `getCustomerRanking`, `getOrdersPerDay`, `getGasTypeDistribution` functies in `useCallback`
- Memoize filter change handlers

### Stap 4: Vite Code Splitting Configuratie

Configureer Vite om grote dependencies in aparte chunks te splitsen voor betere caching.

**Bestand:**
- `vite.config.ts`

**Wijzigingen:**
- Voeg `build.rollupOptions.output.manualChunks` configuratie toe
- Splits `recharts` in een apart chunk
- Splits andere grote vendor libraries

### Stap 5: Lazy Loading voor Productie Tabs

Voeg lazy loading toe aan de hoofd productie tab componenten.

**Bestand:**
- `src/components/production/ProductionPlanning.tsx`

**Wijzigingen:**
- Lazy load `DryIcePlanning`, `GasCylinderPlanning`, en `ProductionReports` componenten
- Voeg Suspense wrappers toe per tab

---

## Technische Details

### Lazy Loading Pattern
```text
┌─────────────────────────────────────────────────────────┐
│  ProductionPlanning                                     │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Tabs                                              │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────────────────┐  │  │
│  │  │Droogijs │ │Cilinders│ │    Rapportage       │  │  │
│  │  └────┬────┘ └────┬────┘ └──────────┬──────────┘  │  │
│  │       │           │                 │             │  │
│  │       ▼           ▼                 ▼             │  │
│  │  ┌────────┐  ┌────────┐    ┌───────────────────┐  │  │
│  │  │ Lazy   │  │ Lazy   │    │ Lazy Loading      │  │  │
│  │  │ Load   │  │ Load   │    │ ┌───────────────┐ │  │  │
│  │  └────────┘  └────────┘    │ │YearComparison │ │  │  │
│  │                            │ │(Lazy)         │ │  │  │
│  │                            │ ├───────────────┤ │  │  │
│  │                            │ │CumulativeGas  │ │  │  │
│  │                            │ │(Lazy)         │ │  │  │
│  │                            │ ├───────────────┤ │  │  │
│  │                            │ │CumulativeSize │ │  │  │
│  │                            │ │(Lazy)         │ │  │  │
│  │                            │ └───────────────┘ │  │  │
│  │                            └───────────────────┘  │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### Vite Chunk Configuratie
```text
┌─────────────────────────────────────────────────────────┐
│  Build Output                                           │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │ main.[hash].js  │  │ vendor.[hash].js│               │
│  │ (App code)      │  │ (supabase, etc) │               │
│  └─────────────────┘  └─────────────────┘               │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────┐               │
│  │charts.[hash].js │  │  ui.[hash].js   │               │
│  │ (recharts)      │  │ (radix-ui)      │               │
│  └─────────────────┘  └─────────────────┘               │
│                                                         │
│  ┌────────────────────────────────────────────────────┐ │
│  │ Lazy Chunks (only loaded when needed)              │ │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │ │
│  │ │YearComparison│ │CumulativeGas │ │CumulativeSize│ │ │
│  │ └──────────────┘ └──────────────┘ └──────────────┘ │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

---

## Bestanden die Aangepast Worden

| Bestand | Type Wijziging |
|---------|----------------|
| `src/components/production/ProductionReports.tsx` | Lazy imports + Suspense |
| `src/components/production/ProductionPlanning.tsx` | Lazy imports + Suspense |
| `src/components/production/CumulativeYearChart.tsx` | React.memo wrapper |
| `src/components/production/CumulativeGasTypeChart.tsx` | React.memo wrapper + default export |
| `src/components/production/CumulativeCylinderSizeChart.tsx` | React.memo wrapper + default export |
| `src/components/production/YearComparisonReport.tsx` | React.memo wrapper + default export + useCallback |
| `src/components/production/TopCustomersWidget.tsx` | React.memo wrapper |
| `vite.config.ts` | Code splitting configuratie |

---

## Verwachte Resultaten

- **Initiele laadtijd**: ~30-40% sneller (lazy loading van zware componenten)
- **Bundle grootte**: Betere caching door chunk splitting
- **Re-render performance**: Minder onnodige re-renders door React.memo
- **Tab switch**: Alleen de eerste keer laden, daarna instant uit cache
