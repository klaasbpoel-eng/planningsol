

# Dagelijks Overzicht - Alle verbeteringen

## 1. Klikbare items met detail-dialogen
Items in het overzicht worden klikbaar. Bij klikken opent de bestaande detail-dialoog:
- Droogijs orders -> `DryIceOrderDialog`
- Gascilinder orders -> `GasCylinderOrderDialog`
- Ambulance ritten -> `AmbulanceTripDialog`
- Taken -> `CalendarItemDialog` (of een nieuw compact detail-venster)
- Verlof -> toont naam + periode in een popover

Visuele feedback: hover-effect (`hover:bg-black/5 cursor-pointer rounded`) op elk item.

## 2. Compacte dagsamenvatting bovenaan
Per dag een kleine samenvatting-rij boven de kolommen:

```text
Ambulance: 1 | Gascilinders: 3 | Droogijs: 120 kg | Taken: 5 | Afwezig: 2
```

Getoond als kleine gekleurde badges/chips. Alleen in weekweergave (in dagweergave zijn de kolommen al direct zichtbaar).

## 3. Kleurcodering voor prioriteit/urgentie
- Taken met prioriteit "high" krijgen een subtiel rood accent (linkerborder of dot)
- Taken met prioriteit "low" krijgen een grijs accent
- Droogijs- en gasorders die "in_progress" zijn krijgen een blauw accent

## 4. Groepering per klant
In de gascilinder-kolom worden orders gegroepeerd per klant als een klant meerdere orders op dezelfde dag heeft. Toont klantnaam eenmalig met daaronder de individuele orders ingesprongen.

## 5. Print/PDF export knop
Een printknop in de header naast de dag/week-toggle. Gebruikt `window.print()` met een print-specifieke CSS media query die het overzicht netjes op papier zet (verberg navigatie, sidebar, etc.).

## 6. Realtime updates
Supabase realtime subscriptions op de relevante tabellen zodat wijzigingen (nieuwe orders, statusupdates) direct zichtbaar zijn zonder pagina-refresh.

---

## Technische aanpak

### Bestanden die gewijzigd worden:

**`src/components/dashboard/DailyOverview.tsx`** (hoofdbestand):
- Import bestaande dialoog-componenten
- State toevoegen voor geselecteerd item + dialoog open/dicht
- onClick handlers per item-type
- Dagsamenvatting component toevoegen (week-modus)
- Prioriteit-indicatoren bij taken
- Klant-groepering logica voor gascilinders
- Print-knop in header
- Supabase realtime channel subscription in useEffect
- Cleanup channel bij unmount

**`src/index.css`** (of nieuw print stylesheet):
- `@media print` regels voor nette afdruk

### Volgorde van implementatie:
1. Klikbare items + dialogen (grootste UX impact)
2. Prioriteit-kleuren en klant-groepering (visuele verbetering)
3. Dagsamenvatting in weekweergave
4. Print-functionaliteit
5. Realtime updates

