

## Alle items tonen in het kalenderoverzicht (geen "+X meer")

Het doel is om alle items in de kalendercellen volledig zichtbaar te maken, zonder afkapping via "+X meer". Om de layout beheersbaar te houden wanneer een dag veel items heeft, worden de cellen scrollbaar gemaakt met een maximale hoogte.

### Aanpassingen

**Bestand: `src/components/calendar/CalendarOverview.tsx`**

1. **Weekweergave (regel ~1946)**: Verwijder `.slice(0, 6)` zodat alle items worden gerenderd. Verwijder de "+X meer" indicator (regels 2040-2042). Voeg een `max-h-[300px] overflow-y-auto` toe aan de items-container zodat bij veel items gescrolld kan worden.

2. **Maandweergave (regel ~2121)**: Verwijder `.slice(0, 4)` zodat alle items worden gerenderd. Verwijder de "+X meer" indicator (regels 2159-2160). Voeg een `max-h-[120px] overflow-y-auto` toe (kleiner dan weekview vanwege beperkte celgrootte).

**Bestand: `src/components/admin/TeamCalendar.tsx`**

3. **TeamCalendar (regel ~193)**: Verwijder `.slice(0, 3)` en de "+X meer" tekst (regels 215-219). Voeg een `max-h-[80px] overflow-y-auto` container toe.

### Technisch detail

- De scrollbare container krijgt een subtiele scrollbar-styling via Tailwind (`scrollbar-thin`) of een `overscroll-contain` class
- De `min-h-[90px]` op de maandcellen blijft intact; alleen de items-lijst wordt gescrolld
- Weekcellen hebben meer ruimte en krijgen een hogere max-height

