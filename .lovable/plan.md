

# UI/UX en Functionaliteitsverbeteringen — Aanbevelingen

Na een grondige analyse van de codebase heb ik de volgende verbeterpunten geidentificeerd, gegroepeerd in UI/UX en missende functionaliteiten.

---

## A. UI/UX Verbeteringen

### 1. ProtectedRoute gebruikt kale Loader2 spinner
**Probleem:** `ProtectedRoute.tsx` toont nog een `<Loader2>` spinner in plaats van de `BrandedLoader`. Dit is inconsistent met `Index.tsx` en `DailyOverviewPage.tsx`.

**Oplossing:** Vervang door `<BrandedLoader />`.

**Bestand:** `src/components/auth/ProtectedRoute.tsx`

---

### 2. PendingApproval pagina mist branding
**Probleem:** De "Wachten op goedkeuring" pagina heeft een kale achtergrond zonder de `bg-mesh-animate` styling die de login nu wel heeft.

**Oplossing:** Dezelfde mesh-achtergrond en glass-card styling toevoegen als op de login pagina.

**Bestand:** `src/components/auth/PendingApproval.tsx`

---

### 3. Admin sidebar mist hamburger-trigger positie op mobiel
**Probleem:** De `AdminSidebar` rendeert een mobiele `SheetTrigger` als losse Button, maar deze lijkt niet zichtbaar gepositioneerd in de admin layout — de header heeft geen plek ervoor. Op mobiel moet de gebruiker weten dat er een sidebar is.

**Oplossing:** De admin sidebar trigger integreren in de header wanneer de admin-view actief is, of een vaste floating trigger toevoegen die duidelijk zichtbaar is.

**Bestand:** `src/components/admin/AdminDashboard.tsx`, `src/components/admin/layout/AdminSidebar.tsx`

---

### 4. DailyOverview — 1700+ regels in een enkel bestand
**Probleem:** Het bestand is zeer groot en moeilijk onderhoudbaar. Niet direct een UX-probleem, maar vertraagt ontwikkeling en vergroot de kans op bugs.

**Oplossing:** Splitsen in sub-componenten: `DayView`, `WeekView`, `SectionList`, `StatusBadge` (al aparte functie), `PrintView`. Dit is refactoring, geen visuele wijziging.

---

### 5. Geen "keyboard shortcuts" overzicht
**Probleem:** Het DailyOverview heeft sneltoetsen (←→ navigatie, T voor vandaag, D/W voor dag/week, F voor fullscreen) maar de gebruiker weet dit niet.

**Oplossing:** Een klein `?` icoon-knop toevoegen dat een dialog opent met alle beschikbare sneltoetsen. Eventueel ook tonen als tooltip bij eerste gebruik.

**Bestanden:** Nieuw component `KeyboardShortcutsDialog.tsx`, integratie in `DailyOverview.tsx`

---

### 6. Geen feedback bij realtime updates
**Probleem:** Het DailyOverview heeft realtime subscriptions, maar als er een wijziging binnenkomt is er geen visueel signaal — de data ververst stil.

**Oplossing:** Een subtiele toast of een korte "Data bijgewerkt" indicator tonen wanneer er een realtime update binnenkomt, zodat de gebruiker weet dat de weergave actueel is.

**Bestand:** `src/components/dashboard/DailyOverview.tsx`

---

## B. Missende Functionaliteiten

### 7. Geen undo bij statuswijzigingen in DailyOverview
**Probleem:** De CalendarOverview heeft undo-functionaliteit bij drag-and-drop, maar het DailyOverview mist dit bij quick-status toggles. Een per-ongeluk klik op een status badge is niet terug te draaien.

**Oplossing:** Na een statuswijziging een toast tonen met "Ongedaan maken" knop die de vorige status herstelt.

**Bestand:** `src/components/dashboard/DailyOverview.tsx`

---

### 8. NotificationBell mist filter/categorisatie
**Probleem:** Notificaties worden als platte lijst getoond zonder categorisatie of filtermogelijkheid.

**Oplossing:** Tabs toevoegen in de notification popover: "Alles", "Ongelezen", eventueel per type (verlof, orders, taken).

**Bestand:** `src/components/notifications/NotificationBell.tsx`

---

### 9. Geen globale error/offline indicator
**Probleem:** Er is geen feedback als de gebruiker offline gaat of als Supabase-verbinding wegvalt. Data zou dan stil niet laden.

**Oplossing:** Een online/offline detector toevoegen die een banner toont wanneer de verbinding wegvalt, en automatisch data herlaadt bij reconnect.

**Bestanden:** Nieuw hook `useOnlineStatus.ts`, integratie in `PageLayout.tsx`

---

### 10. Geen "Vandaag" quick-link in de header
**Probleem:** Om terug te gaan naar vandaag moet de gebruiker naar het DailyOverview navigeren en dan op "Vandaag" klikken. Er is geen snelle manier om vanuit elke pagina het dagoverzicht van vandaag te openen.

**Oplossing:** Dit zit al in de Command Palette, maar een klein datum-chip in de header zou direct naar `/dagoverzicht` linken met de huidige datum — een snelle "wat staat er vandaag?" shortcut.

**Bestand:** `src/components/layout/Header.tsx`

---

## Prioritering

| # | Type | Impact | Complexiteit |
|---|------|--------|-------------|
| 1 | UI consistency | Hoog | Laag |
| 2 | UI branding | Middel | Laag |
| 7 | UX — undo | Hoog | Middel |
| 5 | UX — discoverability | Middel | Laag |
| 6 | UX — feedback | Middel | Laag |
| 9 | Functionaliteit | Hoog | Middel |
| 3 | Mobile UX | Middel | Middel |
| 8 | Functionaliteit | Laag | Middel |
| 10 | UX — navigatie | Laag | Laag |
| 4 | Refactoring | Laag (nu) | Hoog |

Alle verbeteringen zijn uitvoerbaar met het bestaande design system en dependencies. Geen nieuwe packages nodig.

