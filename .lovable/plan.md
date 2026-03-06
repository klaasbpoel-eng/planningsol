

## Plan: Auto-snap naar grid bij drag-and-drop

**Probleem**: Bij het verslepen en swappen moeten elementen handmatig exact gepositioneerd worden. De gebruiker wil dat posities automatisch op een rechte lijn/grid uitlijnen.

**Oplossing**: Grid-snapping toevoegen zodat alle posities automatisch afronden naar het dichtstbijzijnde rasterpunt (bijv. 10px). Dit zorgt ervoor dat elementen altijd netjes uitgelijnd zijn.

### Aanpassingen in `InteractiveFloorPlan.tsx`

1. **Grid-snap constante** toevoegen (bijv. `GRID_SNAP = 10`)
2. **Snap-functie**: `const snap = (v: number) => Math.round(v / GRID_SNAP) * GRID_SNAP`
3. **Toepassen bij drag** (`handleSvgMouseMove`): alle nieuwe `x`, `y`, `cx`, `cy` waarden door `snap()` halen
4. **Toepassen bij swap**: swap-posities ook snappen
5. **Visueel grid** in edit-mode aanpassen naar dezelfde snap-grootte

Dit betekent dat tijdens het slepen het element "springt" naar het dichtstbijzijnde rasterpunt, waardoor alles automatisch recht en uitgelijnd staat zonder dat je pixel-perfect hoeft te positioneren.

