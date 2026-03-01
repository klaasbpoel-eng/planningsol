

# Klikbare statusbadge in Dagelijks Overzicht

## Wat verandert er

1. **Klikbare StatusBadge**: De statusbadge op elk item wordt een klikbaar element dat de status doorschakelt: Gepland -> Bezig -> Voltooid -> Gepland (cyclisch). Een klik op de badge stopt event propagation zodat het detail-dialoog niet opent.

2. **Items altijd zichtbaar**: De database-queries filteren momenteel geannuleerde orders en voltooide gascilinders weg. Deze filters worden verwijderd zodat alle items altijd zichtbaar blijven, ongeacht hun status.

3. **Context-menu's blijven**: De bestaande rechtermuisklik context-menu's blijven beschikbaar als alternatief (bijv. voor "Geannuleerd" instellen, wat niet in de klik-cyclus zit).

## Technische details

### Bestand: `src/components/dashboard/DailyOverview.tsx`

**StatusBadge component aanpassen (regels 899-911)**:
- Voegt een `onClick` prop toe die de volgende status in de cyclus selecteert
- Toont een cursor-pointer en hover-effect
- `e.stopPropagation()` voorkomt dat het detail-dialoog opent

**Query filters verwijderen (regels 164-198)**:
- Verwijder `.neq("status", "cancelled")` bij tasks, dry_ice_orders, ambulance_trips
- Verwijder `.neq("status", "completed")` bij gas_cylinder_orders
- Alle items worden nu altijd opgehaald en getoond

**Visuele indicatie voor geannuleerde items**:
- Geannuleerde items krijgen een doorgestreepte/vervaagde stijl (`opacity-50 line-through`) zodat ze visueel onderscheidbaar zijn maar toch zichtbaar blijven

