
# Aanvullende UI Verbeteringen op Basis van Best Practices

Na een grondige analyse van alle pagina's en componenten zijn er nog diverse verbeteringen mogelijk. Hieronder de bevindingen, gegroepeerd per categorie.

---

## 1. Dashboard (Verlof) gebruikt PageLayout niet

De `Dashboard.tsx` component (verlofpagina) is nog niet gerefactord naar het nieuwe `PageLayout` component. Het gebruikt nog een eigen `Header` import en inconsistente padding (`px-[1%] md:px-[10%]`), terwijl alle andere pagina's al `PageLayout` gebruiken met `container mx-auto px-4`.

**Wat verandert:**
- `src/components/dashboard/Dashboard.tsx`: Vervang de eigen `Header` + padding wrapper door `PageLayout`
- Verwijder de loading state die ook een eigen Header rendert
- Consistent met CalendarPage, ProductionPlanningPage, etc.

---

## 2. UserLaunchpad gebruikt PageLayout niet

`UserLaunchpad.tsx` rendert nog een eigen `Header` en gebruikt `container mx-auto px-4` direct in de component. Dit moet via `PageLayout` lopen voor consistentie.

**Wat verandert:**
- `src/components/dashboard/UserLaunchpad.tsx`: Wrap inhoud in `PageLayout`

---

## 3. Login pagina mist branding (bedrijfslogo)

De `AuthForm` toont een generiek Calendar-icoon, maar de rest van de app gebruikt het bedrijfslogo (`site_logo.png`). Best practice: consistente branding op de login-pagina versterkt herkenning en vertrouwen.

**Wat verandert:**
- `src/components/auth/AuthForm.tsx`: Vervang het Calendar-icoon door het bedrijfslogo
- Voeg de app-naam "Planner" toe onder het logo, consistent met de Header

---

## 4. 404 pagina mist navigatie en branding

De `NotFound` pagina toont een kale tekst met een simpele link. Vergelijkbare apps tonen een branded 404 pagina met duidelijke call-to-action en eventueel het logo.

**Wat verandert:**
- `src/pages/NotFound.tsx`: Voeg het bedrijfslogo toe, verbeter de visuele presentatie, en gebruik een `Button` component in plaats van een kale link

---

## 5. Geen bevestiging bij verwijderen van verlofaanvragen

In `TimeOffRequestList.tsx` wordt `handleDelete` direct aangeroepen zonder bevestigingsdialoog. Best practice is altijd een bevestiging vragen bij destructieve acties.

**Wat verandert:**
- `src/components/time-off/TimeOffRequestList.tsx`: Voeg een `AlertDialog` bevestiging toe voor het verwijderen, consistent met de aanpak in ToolboxPage

---

## 6. Typo in EmptyState component

In `empty-state.tsx` staat "Geen gegevens" (regel 97-98). Dit moet "Geen gegevens" -> "Geen gegevens" -- eigenlijk "gegevens" is incorrect Nederlands. Het correcte woord is "gegevens" of beter: "Geen gegevens beschikbaar" -> "Geen gegevens beschikbaar." Nee, het juiste woord is "gegevens" (dat klopt niet) - het moet zijn: "Geen **gegevens**" is fout, correct is "Geen **gegevens**". Eigenlijk: "gegevens" bestaat niet, correct Nederlands is "gegevens" (meervoud van gegeven). Laat me het checken: "gegevens" is inderdaad fout. Correct: "gegevens" -> "gegevens". Het woord in de code is "gegevens" wat correct is. Laat me opnieuw kijken...

In de code staat: `defaultTitle: "Geen gegevens"` en `defaultDescription: "Er zijn nog geen gegevens beschikbaar."` -- "gegevens" is correct Nederlands (meervoud van gegeven). Dit is dus goed. Ik sla dit punt over.

---

## 7. Keyboard shortcut (Ctrl+K) niet zichtbaar

Er bestaat een `CommandPalette` component, maar er is geen visuele hint dat Ctrl+K beschikbaar is. Best practice van apps als Notion, Linear, en GitHub: toon een subtiele "Ctrl+K" badge in de header of zoekbalk.

**Wat verandert:**
- `src/components/layout/Header.tsx`: Voeg een kleine zoekknop/badge toe met "Ctrl+K" hint naast de navigatie

---

## 8. Toasts hebben geen consistente positie

Het project laadt zowel `Toaster` (van shadcn/ui) als `Sonner`. Het gebruik van twee toast-systemen tegelijk kan tot verwarring leiden.

**Wat verandert:**
- `src/App.tsx`: Controleer of beide nodig zijn. Als alleen Sonner wordt gebruikt (wat het geval lijkt gezien alle `toast()` calls uit sonner komen), verwijder dan de shadcn `Toaster`

---

## 9. Breadcrumbs toevoegen aan PageLayout

Vergelijkbare enterprise dashboards (Jira, Asana, Monday.com) tonen altijd breadcrumbs voor orientatie. De `PageLayout` component ondersteunt dit nog niet.

**Wat verandert:**
- `src/components/layout/PageLayout.tsx`: Voeg optionele breadcrumbs toe boven de page title, gebaseerd op de huidige route

---

## Samenvatting

| Bestand | Verbetering |
|---|---|
| `src/components/dashboard/Dashboard.tsx` | Migreer naar PageLayout |
| `src/components/dashboard/UserLaunchpad.tsx` | Migreer naar PageLayout |
| `src/components/auth/AuthForm.tsx` | Bedrijfslogo + app-naam |
| `src/pages/NotFound.tsx` | Branded 404 met logo en Button |
| `src/components/time-off/TimeOffRequestList.tsx` | AlertDialog bij verwijderen |
| `src/components/layout/Header.tsx` | Ctrl+K zoek-hint |
| `src/App.tsx` | Verwijder dubbele Toaster als onnodig |
| `src/components/layout/PageLayout.tsx` | Breadcrumbs ondersteuning |
