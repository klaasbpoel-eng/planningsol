

## UI/UX Verbeteringen Dagelijks Overzicht

### 1. Keyboard Shortcuts voor navigatie
Voeg toetsenbordsnelkoppelingen toe zodat power-users sneller navigeren:
- Pijl links/rechts: vorige/volgende dag of week
- `T`: spring naar vandaag
- `D`/`W`: wissel tussen dag- en weekmodus
- `F`: toggle fullscreen

Technisch: een `useEffect` met `keydown` listener die alleen actief is als geen dialoog/input focus heeft.

### 2. Swipe-navigatie op mobiel
Voeg touch swipe-ondersteuning toe zodat gebruikers op mobiel met een veeg naar links/rechts door dagen/weken kunnen bladeren. Wordt geimplementeerd met `onTouchStart`/`onTouchEnd` handlers op de `CardContent`, zonder extra dependency.

### 3. Alles inklappen/uitklappen knop
Een enkele toggle-knop in de toolbar die alle secties tegelijk in- of uitklapt. Icoon wisselt tussen "expand all" en "collapse all" afhankelijk van de huidige staat.

### 4. Lege secties verbergen met filter-indicator
Wanneer een filter actief is en bepaalde secties geen resultaten opleveren, toon een subtiele melding met het aantal verborgen secties (bijv. "3 secties verborgen door filter") in plaats van niets.

### 5. Sticky dag-headers in weekweergave
In de weekweergave worden dag-headers (bijv. "Maandag 3 maart") sticky gemaakt zodat bij scrollen altijd zichtbaar is welke dag je bekijkt. Gebruik `sticky top-0 z-10 bg-background` styling.

---

### Technische aanpak

**Bestand: `src/components/dashboard/DailyOverview.tsx`**

**Keyboard shortcuts (verbetering 1):**
- Nieuwe `useEffect` met `keydown` handler
- Checkt `document.activeElement` om input-velden over te slaan
- Roept bestaande functies aan: `navigate("prev")`, `navigate("next")`, `goToToday()`, `setViewMode()`, `setIsFullscreen()`

**Swipe-navigatie (verbetering 2):**
- State: `touchStartX: number | null`
- `onTouchStart` en `onTouchEnd` handlers op de `CardContent`
- Drempel van 50px voor een swipe
- Links swipen = volgende dag/week, rechts swipen = vorige

**Alles inklappen/uitklappen (verbetering 3):**
- Nieuwe knop naast de print-knop in de header toolbar
- `allCollapsed` berekend via `useMemo` over alle sectie-keys
- `toggleAllSections()` functie die alle secties in- of uitklapt en opslaat in `localStorage`
- Iconen: `ChevronsUpDown` / `ChevronsDownUp` uit lucide-react

**Filter-indicator (verbetering 4):**
- Berekening van het aantal verborgen (lege) secties wanneer `isFiltering` actief is
- Subtiele tekstregel onder de zoekbalk: "X secties verborgen door filter"

**Sticky dag-headers (verbetering 5):**
- De dag-header `div` in weekmodus krijgt `sticky top-0 z-10 bg-card py-2` classes
- Alleen toegepast wanneer `viewMode === "week"`

**Bestanden die worden aangepast:**
- `src/components/dashboard/DailyOverview.tsx` (alle wijzigingen in dit ene bestand)

