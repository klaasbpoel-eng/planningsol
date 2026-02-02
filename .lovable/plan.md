

# Plan: Skeleton Loaders met Fade-in Animaties

## Overzicht

Dit plan implementeert professionele skeleton loaders met fade-in animaties voor de belangrijkste componenten. Dit verbetert de perceived performance door gebruikers visuele feedback te geven tijdens het laden van data.

---

## Wat wordt gebouwd

### 1. Enhanced Skeleton Component
Uitbreiding van de bestaande `Skeleton` component met:
- Shimmer animatie effect (al aanwezig in CSS)
- Varianten voor verschillende content types (text, card, table, chart)
- Ondersteuning voor fade-in wanneer content laadt

### 2. Fade-in Animatie Wrapper
Een `FadeIn` component die content smooth laat verschijnen na het laden.

### 3. Skeleton Templates voor specifieke componenten:
- **StatCardSkeleton**: Voor de statistiek cards in ProductionPlanning
- **TableSkeleton**: Voor order tabellen in DryIcePlanning en GasCylinderPlanning
- **ChartSkeleton**: Voor charts in ProductionReports
- **TopCustomersSkeleton**: Voor de TopCustomersWidget
- **CalendarSkeleton**: Voor CalendarOverview

---

## Implementatie Details

### Stap 1: Tailwind Animaties uitbreiden (tailwind.config.ts)

Nieuwe keyframes en animaties toevoegen:
- `skeleton-shimmer`: Bewegende shimmer over skeleton
- `fade-in-up`: Combinatie fade + subtle upward movement

### Stap 2: Skeleton Component uitbreiden (src/components/ui/skeleton.tsx)

```typescript
// Nieuwe varianten
interface SkeletonProps {
  variant?: "default" | "text" | "circular" | "rectangular";
  animation?: "pulse" | "shimmer" | "none";
}
```

### Stap 3: FadeIn Wrapper Component (src/components/ui/fade-in.tsx)

```typescript
// Wrapper die children smooth laat verschijnen
<FadeIn show={!loading}>
  <ActualContent />
</FadeIn>
```

### Stap 4: Skeleton Templates (src/components/ui/skeletons/)

- **stat-card-skeleton.tsx**: 4-5 stat cards als skeletons
- **table-skeleton.tsx**: Tabel met skeleton rows
- **chart-skeleton.tsx**: Chart placeholder met golven
- **customer-list-skeleton.tsx**: Top 5 klanten lijst

### Stap 5: Integratie in Componenten

| Component | Huidige Loading | Nieuwe Loading |
|-----------|-----------------|----------------|
| ProductionPlanning | Geen skeleton voor stats | StatCardSkeleton + FadeIn |
| DryIcePlanning | Loader2 spinner | TableSkeleton + FadeIn |
| GasCylinderPlanning | Loader2 spinner | TableSkeleton + FadeIn |
| ProductionReports | Loader2 spinner | ChartSkeleton + FadeIn |
| TopCustomersWidget | Basic skeleton | Enhanced shimmer + FadeIn |
| CalendarOverview | loading state | CalendarSkeleton + FadeIn |

---

## Visueel Ontwerp

### Skeleton Stijl
- Achtergrond: `bg-muted` (huidige)
- Shimmer: Lineair gradient van transparant naar primary/10 naar transparant
- Border radius: Afgestemd op het element type
- Animatie duur: 1.5s voor shimmer, 0.3s voor fade-in

### Fade-in Effect
- Opacity: 0 naar 1
- Transform: translateY(8px) naar translateY(0)
- Easing: ease-out
- Duur: 300ms

---

## Bestanden die worden aangemaakt

1. `src/components/ui/fade-in.tsx` - FadeIn wrapper component
2. `src/components/ui/skeletons/stat-card-skeleton.tsx` - Stat card skeletons
3. `src/components/ui/skeletons/table-skeleton.tsx` - Table skeleton
4. `src/components/ui/skeletons/chart-skeleton.tsx` - Chart skeleton
5. `src/components/ui/skeletons/customer-list-skeleton.tsx` - Customer list skeleton
6. `src/components/ui/skeletons/calendar-skeleton.tsx` - Calendar skeleton
7. `src/components/ui/skeletons/index.ts` - Export barrel file

## Bestanden die worden aangepast

1. `tailwind.config.ts` - Nieuwe animatie keyframes
2. `src/components/ui/skeleton.tsx` - Enhanced skeleton met varianten
3. `src/components/production/ProductionPlanning.tsx` - Skeleton + FadeIn
4. `src/components/production/DryIcePlanning.tsx` - TableSkeleton + FadeIn
5. `src/components/production/GasCylinderPlanning.tsx` - TableSkeleton + FadeIn
6. `src/components/production/ProductionReports.tsx` - ChartSkeleton + FadeIn
7. `src/components/production/TopCustomersWidget.tsx` - Enhanced skeleton
8. `src/components/calendar/CalendarOverview.tsx` - CalendarSkeleton + FadeIn

---

## Technische Details

### Performance Overwegingen
- Skeleton componenten zijn lightweight (geen state, pure rendering)
- Animaties gebruiken CSS transforms (GPU accelerated)
- FadeIn wrapper wrapped met React.memo voor re-render prevention

### Herbruikbaarheid
- Alle skeleton componenten accepteren className prop voor customization
- FadeIn component is generiek en kan overal worden gebruikt
- Skeleton varianten kunnen in elke context worden toegepast

