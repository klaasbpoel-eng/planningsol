

## Vrije vuldruk invoer in de Receptenmaker

### Wat er verandert
Het huidige dropdown-menu voor "Doeldruk" (beperkt tot 210 en 300 bar) wordt vervangen door een **vrij invoerveld** waarin je zelf een drukwaarde kunt typen. Alle berekeningen (massa, Z-factoren, partiaaldrukken) worden automatisch herberekend bij elke wijziging.

### Hoe het werkt
- Het dropdown-menu wordt vervangen door een numeriek invoerveld met "bar" als eenheid-label
- Minimale druk: 1 bar, maximale druk: 500 bar
- De standaardwaarde blijft 210 bar
- Snelkeuze-knoppen voor veelgebruikte drukken (150, 200, 210, 300 bar) worden als kleine knoppen onder het invoerveld geplaatst voor snel schakelen
- Alle vulrecept-berekeningen passen zich direct aan

### Technisch detail

**Bestand: `src/components/production/GasMixtureRecipemaker.tsx`**

1. De constante `PRESSURES = [210, 300]` wordt verwijderd (of omgezet naar preset-knoppen)
2. Het `Select`-component voor doeldruk (regels 353-361) wordt vervangen door een `Input type="number"` met min/max/step attributen en een "bar" suffix
3. Optioneel: een rij preset-knoppen (150, 200, 210, 300 bar) voor snelle selectie
4. De bestaande `targetPressure` state en berekeningen hoeven niet te veranderen -- die werken al met elke numerieke waarde

