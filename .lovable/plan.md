

## Waarschuwingssysteem voor openstaande items

### Wat verandert er

1. **Automatisch afronden wordt verwijderd**: De edge function `complete-past-dry-ice-orders` die droogijs-orders automatisch op "afgerond" zet, wordt aangepast zodat deze alleen nog een waarschuwing genereert in plaats van de status te wijzigen.

2. **Visuele waarschuwing in het Dagelijks Overzicht**: Items die na 17:00 nog de status "gepland" of "in behandeling" hebben, krijgen een opvallende waarschuwingsindicator (oranje/rode rand en een waarschuwingsicoon).

3. **Waarschuwingsbanner**: Bovenaan het overzicht verschijnt een waarschuwingsbanner wanneer er openstaande items zijn van vandaag (na 17:00) of van eerdere dagen.

### Logica

- **Werkuren**: 08:00 - 17:00 (ma-vr)
- **Overdue-check**: Een item is "overdue" wanneer:
  - De geplande datum in het verleden ligt, OF
  - De geplande datum vandaag is en het huidige tijdstip na 17:00 valt
- **Uitgezonderd**: Items met status "completed" of "cancelled" worden niet als overdue beschouwd

### Technische details

**Bestand: `supabase/functions/complete-past-dry-ice-orders/index.ts`**
- Verwijder de `UPDATE` query die de status naar "completed" zet
- Vervang door een simpele `SELECT` query die het aantal openstaande orders telt en rapporteert (de functie blijft bestaan voor monitoring maar wijzigt geen data meer)

**Bestand: `src/components/dashboard/DailyOverview.tsx`**
- Nieuwe helper `isOverdue(scheduledDate: string, status: string)` die controleert of een item overdue is op basis van de datum en het huidige tijdstip (na 17:00)
- Waarschuwingsbanner component bovenaan de CardContent die het totaal aantal overdue items toont per categorie
- Per item-rij: overdue items krijgen een rode/oranje linkerborder en een `AlertTriangle` icoon
- Een `useEffect` met interval (elke minuut) die de overdue-status herberekent zodat om 17:00 de waarschuwingen live verschijnen

**Bestand: `src/index.css`**
- CSS-class `overdue-item` voor de visuele markering (rode linkerborder + lichte rode achtergrond)

### Bestanden die worden aangepast
- `supabase/functions/complete-past-dry-ice-orders/index.ts` - stop auto-completion
- `src/components/dashboard/DailyOverview.tsx` - overdue waarschuwingssysteem
- `src/index.css` - overdue styling

