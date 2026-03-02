
## Fullscreen modus voor Dagelijks Overzicht

### Wat verandert er
Er komt een fullscreen-knop in de header van het Dagelijks Overzicht. Wanneer ingeschakeld:
- Het overzicht vult het hele scherm (geen header, breadcrumbs, titel of padding)
- Een compacte toolbar blijft zichtbaar met de datum-navigatie en een knop om fullscreen te verlaten
- Escape-toets sluit fullscreen ook

### Aanpak

**`src/components/dashboard/DailyOverview.tsx`**
- Voeg een `isFullscreen` state toe
- Voeg een `Maximize2` / `Minimize2` toggle-knop toe naast de bestaande knoppen (print, etc.)
- Wanneer fullscreen actief is, wrap de hele component in een fixed overlay (`fixed inset-0 z-50 bg-background overflow-auto`) zonder extra padding
- Bind de `Escape`-toets om fullscreen te sluiten via een `useEffect`

**`src/pages/DailyOverviewPage.tsx`**
- Geen wijzigingen nodig; de fullscreen overlay wordt intern afgehandeld door DailyOverview

### Technische details

1. **State**: `const [isFullscreen, setIsFullscreen] = useState(false)`
2. **Wrapper**: Conditioneel een `div` met `fixed inset-0 z-50 bg-background overflow-auto p-4` om de bestaande content
3. **Toggle-knop**: Icoon `Maximize2` (aan) / `Minimize2` (uit) in de bestaande knoppenrij
4. **Escape-handler**: `useEffect` met `keydown` listener voor `Escape`
5. **Lucide icons**: `Maximize2` en `Minimize2` importeren (al beschikbaar in het project)

### Bestanden die worden aangepast
- `src/components/dashboard/DailyOverview.tsx`
