

## Gastype chips volledig leesbaar maken

### Probleem
De gastype-chips in het bestelformulier knippen lange namen af (bijv. "Zuurstof Medicinaal ...") door een `max-w-[120px]` beperking met `truncate`.

### Oplossing
De `max-w-[120px]` en `truncate` classes worden verwijderd van de gastype chip tekst, zodat de volledige naam altijd zichtbaar is. De chips wrappen al via `flex-wrap`, dus langere namen passen automatisch in de layout.

### Technische details

**Bestand:** `src/components/production/CreateGasCylinderOrderDialog.tsx`

**Regel 366** wordt aangepast:
- Huidig: `<span className="truncate max-w-[120px]">{type.name}</span>`
- Nieuw: `<span>{type.name}</span>`

Dit is een wijziging van 1 regel. Geen andere bestanden betrokken.

