

## Dagelijks Overzicht: Mobiele optimalisatie en admin-acties

### Probleem
Het dagelijks overzicht is ontworpen voor desktop. Op mobiel zijn er UX-problemen:
- De werkbalk (header) is te vol met knoppen
- Statuswijzigingen werken via rechtermuisklik (ContextMenu), wat niet werkt op touchscreens
- Zoek- en filterbalk neemt te veel ruimte in
- Admin-acties (toevoegen, bewerken, verwijderen) zijn niet goed bereikbaar op mobiel
- De "+" toevoegknoppen zijn klein en moeilijk te raken op touch

### Aanpassingen

**1. Compacte mobiele werkbalk**
- Navigatieknoppen (vorige/volgende) en datumtitel op een rij, dag/week-toggle eronder
- Print, fullscreen, collapse-all en mark-as-seen knoppen verbergen in een "meer" dropdown op mobiel
- "Vandaag" knop compact houden

**2. Statuswijziging via tap (touch-friendly)**
- Op mobiel: een DropdownMenu als vervanging voor het ContextMenu toevoegen
- Long-press op een item toont het statusmenu (via `onTouchStart`/`onTouchEnd` timer)
- StatusBadge tap-area vergroten voor makkelijker raken

**3. Zoek- en filterbalk optimaliseren**
- Zoekbalk en filters op aparte rijen op mobiel
- Filters als compacte chips in plaats van segmented control
- Zoekbalk met volledige breedte op mobiel

**4. Floating Action Button (FAB) voor admin toevoegen**
- Een FAB rechtsonder op mobiel voor admins
- Bij klikken een speed-dial met opties: Ambulance, Droogijs, Taak
- Vervangt de kleine "+" knoppen in de sectieheaders op mobiel

**5. Sectiekaarten mobiel-vriendelijk**
- Meer padding en grotere tap-targets
- Items met grotere touch-area (min 44px hoog)
- Notities en details beter gestructureerd met meer witruimte

### Technische details

**Bestanden die worden aangepast:**
- `src/components/dashboard/DailyOverview.tsx` - Hoofdcomponent met alle wijzigingen

**Aanpak per onderdeel:**

**Werkbalk (regels 791-879):**
- Wrap in responsive layout: op mobiel (`md:hidden` / `hidden md:flex`) twee rijen
- Overflow-knoppen in DropdownMenu op mobiel

**ContextMenu naar DropdownMenu op mobile (regels 1074-1122 etc.):**
- Nieuwe wrapper component `MobileContextMenu` die op desktop ContextMenu gebruikt en op mobiel een long-press DropdownMenu
- Gebruikt de bestaande `useIsMobile()` hook

**Zoekbalk (regels 935-958):**
- `min-w-[200px]` verwijderen op mobiel, `w-full` gebruiken
- Filters op eigen rij met `flex-wrap`

**FAB voor admin (nieuw, onder de Card):**
- Alleen zichtbaar op mobiel (`md:hidden`) en voor admins
- Geimplementeerd met het bestaande `FloatingActionButton` component of een simpele fixed-position knop
- Speed-dial met Ambulance/Droogijs/Taak opties

**Touch-targets vergroten:**
- StatusBadge: grotere click-area met padding
- Sectie-items: `min-h-[44px]` en `py-2` op mobiel
- "+" knoppen in sectieheaders: `h-8 w-8` op mobiel

