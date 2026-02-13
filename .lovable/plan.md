

## Receptenmaker voor Gasmengsels

### Wat wordt er gebouwd
Een nieuwe "Receptenmaker" tab in de Productieplanning waarmee gasmengsels geconfigureerd kunnen worden. De tool berekent op basis van de opgegeven samenstelling de vulgewichten per component, zodat cilinders gravimetrisch (op gewicht) gevuld kunnen worden met een referentiecilinder op de weegschaal.

### Functionaliteit

**Recept configureren:**
- Componenten: Stikstof (N2), CO2, Argon (Ar) en Zuurstof (O2)
- Per component een percentage instellen (sliders + invoerveld)
- Percentages moeten optellen tot 100%
- Validatie met visuele indicator (groen = 100%, rood = afwijking)

**Vulparameters:**
- Doeldruk: 200 of 300 bar (bij 15 graden C)
- Cilinderinhoud (watervolume in liters, bijv. 10L, 20L, 40L, 50L)

**Berekeningen (gravimetrische methode):**
- Partiaaldruk per component (percentage x totaaldruk)
- Massa per component via ideale gaswet: m = (P x V x M) / (R x T)
  - P = partiaaldruk in Pa, V = volume in m3, M = molmassa, R = 8.314, T = 288.15 K
- Vulvolgorde (zwaarste component eerst)
- Cumulatief gewicht per stap (wat de weegschaal moet tonen na elke stap)

**Weergave:**
- Overzichtelijke tabel met vulvolgorde, component, partiaaldruk, gewicht per stap, cumulatief gewicht
- Kleurcodering per gas (bestaande gasColors)
- Print/export mogelijkheid van het recept

### Technische wijzigingen

**Nieuw bestand: `src/components/production/GasMixtureRecipemaker.tsx`**
- Standalone React component met de volledige receptenmaker
- Gebruikt bestaande UI componenten (Card, Slider, Input, Select, Table, Button)
- Gasconstanten: molmassa N2=28.014, CO2=44.01, Ar=39.948, O2=31.998 g/mol
- Gaskleur via bestaande `getGasColor` uit `@/constants/gasColors`
- Printfunctie via `window.print()` met print-specifieke styling

**Bestand: `src/components/production/ProductionPlanning.tsx`**
- Nieuwe tab "Recepten" toevoegen aan de TabsList (met Beaker/FlaskConical icoon)
- Lazy-load van de GasMixtureRecipemaker component
- Beschikbaar voor alle gebruikers met productieplanning-toegang

### Voorbeeld berekening
Mengsel: 5% CO2, 20% O2, 75% Ar in een 50L cilinder op 200 bar bij 15 graden C:
- CO2: 10 bar partiaaldruk -> m = (10e5 x 0.050 x 44.01) / (8.314 x 288.15) = ~91.8 g
- O2: 40 bar -> m = (40e5 x 0.050 x 31.998) / (8.314 x 288.15) = ~266.5 g  
- Ar: 150 bar -> m = (150e5 x 0.050 x 39.948) / (8.314 x 288.15) = ~1250.4 g
- Vulvolgorde: Ar (zwaarst) -> O2 -> CO2
- Weegschaal toont cumulatief: 1250.4g -> 1516.9g -> 1608.7g

