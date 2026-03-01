

# UI/UX Verbeteringen - Alle Onderdelen

Een overzicht van concrete, haalbare verbeteringen per module. De focus ligt op consistentie, bruikbaarheid en overzichtelijkheid zonder de complexiteit te vergroten.

---

## 1. Header & Navigatie

**Probleem:** De header bevat 7+ navigatieknoppen die op desktop al krap worden en niet goed schalen.

**Verbeteringen:**
- Navigatieknoppen groeperen in logische clusters met visuele scheiders (bijv. "Planning" = Kalender + Productie + Dagelijks Overzicht; "Beheer" = Verlof + Interne Bestellingen)
- Actieve pagina duidelijker markeren met een underline-indicator i.p.v. een volledig gevulde knop
- Op middelgrote schermen (tablets) overschakelen naar een icon-only modus met tooltips voor de navigatie, zodat alles past

**Bestanden:** `src/components/layout/Header.tsx`

---

## 2. User Launchpad (Startpagina)

**Probleem:** De kaarten zijn allemaal even groot en visueel gelijkwaardig, terwijl sommige modules vaker worden gebruikt.

**Verbeteringen:**
- Meest gebruikte modules (Productie, Kalender, Dagelijks Overzicht) groter tonen in het grid (span 2 kolommen) als "hero cards"
- Snelle statistieken toevoegen op de kaarten zelf (bijv. "3 openstaande taken", "2 orders vandaag") zodat je al op de startpagina ziet wat er speelt
- "Laatst bezocht" volgorde: kaarten sorteren op basis van recente activiteit (opgeslagen in localStorage)

**Bestanden:** `src/components/dashboard/UserLaunchpad.tsx`

---

## 3. Productieplanning

**Probleem:** Tabs worden lazy-loaded maar de tab-structuur kan overweldigend zijn voor nieuwe gebruikers.

**Verbeteringen:**
- Badges met aantallen toevoegen op de tab-triggers (bijv. "Gascilinders (12)", "Droogijs (5)")
- Een "snelfilter" balk bovenaan de tabel: statusfilter als toggle-chips (Gepland / In behandeling / Afgerond) i.p.v. een apart dropdown-menu
- Lege-state illustraties: wanneer er geen orders zijn voor de geselecteerde filters, een vriendelijke empty-state tonen met een call-to-action

**Bestanden:** `src/components/production/ProductionPlanning.tsx`, `src/components/production/GasCylinderPlanning.tsx`, `src/components/production/DryIcePlanning.tsx`

---

## 4. Kalender

**Probleem:** De kalender is feature-rijk (2300+ regels) maar kan visueel druk zijn op volle dagen.

**Verbeteringen:**
- Een "compact mode" toggle die items verkleint tot enkel een gekleurde stip + naam, waardoor meer items zichtbaar zijn zonder te scrollen
- Weeknummers tonen aan de linkerzijde van de kalender
- Bij meer dan 3 items per dag een "+X meer" badge tonen die een popover opent met de volledige lijst

**Bestanden:** `src/components/calendar/CalendarOverview.tsx`

---

## 5. Verlof & Aanvragen (Dashboard)

**Probleem:** Het formulier en de lijst staan naast elkaar, maar de flow is niet helemaal duidelijk.

**Verbeteringen:**
- Verlofsaldo prominent tonen bovenaan als een voortgangsbalk (bijv. "12 van 25 dagen gebruikt")
- Status van aanvragen visueel verbeteren met een stappen-indicator (Ingediend -> In behandeling -> Goedgekeurd/Afgewezen)
- Snelfilter op de aanvragenlijst: toon standaard alleen actieve/toekomstige aanvragen, met een toggle om historische te tonen

**Bestanden:** `src/components/dashboard/Dashboard.tsx`, `src/components/time-off/TimeOffRequestList.tsx`

---

## 6. Interne Bestellingen

**Verbeteringen:**
- Status-kolom visueel upgraden met een stappen-indicator (iconen: Package -> Truck -> CheckCircle) die de huidige stap markeert
- Rij-klik opent al een detail-dialoog (dit is al geimplementeerd) - hover-effect verbeteren met een subtiele achtergrondkleur
- "Vandaag verzonden" / "Vandaag ontvangen" tellers bovenaan als stat-cards

**Bestanden:** `src/components/internal-orders/OrdersTable.tsx`, `src/pages/InternalOrdersPage.tsx`

---

## 7. Admin Beheerpaneel

**Probleem:** De sidebar en content zijn functioneel maar missen visuele feedback over wat aandacht nodig heeft.

**Verbeteringen:**
- Notificatie-badges op sidebar-items (bijv. een rode stip bij "Aanvragen" als er openstaande aanvragen zijn)
- Een "aandachtspunten" banner bovenaan het admin dashboard die waarschuwt voor zaken die actie vereisen (bijv. "3 aanvragen wachten op goedkeuring", "1 gebruiker wacht op activatie")

**Bestanden:** `src/components/admin/layout/AdminSidebar.tsx`, `src/components/admin/AdminDashboard.tsx`

---

## 8. Algemene UX-patronen (cross-cutting)

**Keyboard shortcuts uitbreiden:**
- `N` voor "Nieuw item" op elke pagina (opent het juiste formulier)
- Pijltjestoetsen voor navigatie in de kalender en het dagelijks overzicht
- Command Palette uitbreiden met snelle acties ("Nieuwe order", "Verlof aanvragen")

**Loading & feedback:**
- Optimistic updates bij statuswijzigingen (toon de wijziging direct, revert bij fout)
- Skeleton loading is al aanwezig - consistent toepassen op alle pagina's

**Bestanden:** `src/components/command-palette/CommandPalette.tsx`, diverse pagina's

---

## Technische aanpak

### Volgorde van implementatie (impact vs. effort):

1. **Header navigatie-groepering** - snel, groot visueel effect
2. **Admin sidebar badges** - klein maar nuttig voor dagelijks gebruik
3. **Launchpad statistieken op kaarten** - maakt de startpagina informatief
4. **Productieplanning tab-badges en statusfilters** - verbetert dagelijkse workflow
5. **Verlof voortgangsbalk** - duidelijke status op een blik
6. **Kalender compact mode** - helpt bij drukke weken
7. **Command Palette uitbreiden** - power-user functie
8. **Keyboard shortcuts** - bonus voor ervaren gebruikers

### Bestanden die gewijzigd worden:
- `src/components/layout/Header.tsx` - navigatie groepering
- `src/components/dashboard/UserLaunchpad.tsx` - statistieken op kaarten
- `src/components/production/ProductionPlanning.tsx` - tab badges, filters
- `src/components/calendar/CalendarOverview.tsx` - compact mode
- `src/components/dashboard/Dashboard.tsx` - verlofsaldo balk
- `src/components/internal-orders/OrdersTable.tsx` - visuele status stappen
- `src/components/admin/layout/AdminSidebar.tsx` - notificatie badges
- `src/components/admin/AdminDashboard.tsx` - aandachtspunten banner
- `src/components/command-palette/CommandPalette.tsx` - uitgebreide acties

Geen database-wijzigingen nodig. Alle verbeteringen zijn puur frontend.

