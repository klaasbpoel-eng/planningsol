

## Alle 5 verbeteringen voor het Dagelijks Overzicht

### 1. Voortgangsbalk + Samenvatting-strip
Een compacte balk bovenaan de content die toont hoeveel items zijn afgerond van het totaal, met een visuele Progress-bar en samenvattingsbadges per categorie (totaal droogijs kg, aantal cilinders, etc.).

### 2. Zoek- en filterfunctie
Een zoekbalk en statusfilter (dropdown of toggle) boven de secties waarmee je kunt filteren op klantnaam/taaknaam en op status (Alles / Open / Afgerond).

### 3. Inklapbare secties
Elke categorie-sectie (Ambulance, Gascilinders, Droogijs, Taken, Afwezig) krijgt een chevron-toggle om in/uit te klappen. De inklapstatus wordt opgeslagen in `localStorage` zodat het wordt onthouden.

### 4. Snelle toevoeg-knoppen (admin)
Per sectie een kleine "+" knop naast de sectietitel die alleen voor admins zichtbaar is en de bijbehorende aanmaak-dialog opent.

### 5. Print-compatibiliteit
Alle nieuwe UI-elementen (zoekbalk, filters, toevoeg-knoppen) worden verborgen bij printen via `print:hidden`.

---

### Technische aanpak

**Bestand: `src/components/dashboard/DailyOverview.tsx`**

**Nieuwe state:**
- `searchQuery: string` -- zoektekst
- `statusFilter: "all" | "open" | "completed"` -- statusfilter
- `collapsedSections: Record<string, boolean>` -- inklapstatus per sectie, geinitialiseerd vanuit `localStorage`

**Voortgangsbalk (boven de secties):**
```text
[============================--------] 6/9 afgerond
Ambulance: 2  |  Gas: 12 cil.  |  Droogijs: 450 kg  |  Taken: 3  |  Afwezig: 1
```
- Berekend via `useMemo` over alle items van de huidige dag/week
- Gebruikt de bestaande `Progress` component uit `src/components/ui/progress.tsx`

**Zoek + filter (onder de header, boven content):**
- `Input` component met zoek-icoon voor klantnaam/taaknaam filtering
- Drie toggle-buttons: Alles / Open / Afgerond
- Items worden gefilterd via `useMemo` voordat ze per dag worden gerenderd

**Inklapbare secties:**
- De `Section` component krijgt een `collapsed` en `onToggle` prop
- Chevron-icoon naast de sectietitel die roteert bij in/uitklappen
- `localStorage` key: `daily-overview-collapsed-sections`

**Snelle toevoeg-knoppen:**
- Importeer de bestaande create-dialogen:
  - `CreateDryIceOrderCalendarDialog`
  - `CreateTaskDialog`
  - `CreateAmbulanceTripDialog`
- Per sectie een kleine `+` knop, alleen zichtbaar als `isAdmin`
- Elke knop opent de bijbehorende create-dialog met de huidige datum als default

**Bestanden die worden aangepast:**
- `src/components/dashboard/DailyOverview.tsx` (hoofdbestand, alle wijzigingen)

