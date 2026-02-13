
## "Vorige maand" filter toevoegen aan Rapportage

### Wat verandert er
Er wordt een "Vorige maand" knop toegevoegd aan de periode-filters in de rapportage toolbar, tussen "Deze maand" en "Kwartaal".

### Technische wijzigingen

**Bestand: `src/components/production/ProductionReports.tsx`**

1. **ToggleGroup UI (regel 422-426)** -- Een nieuwe `ToggleGroupItem` met value `"last-month"` en label "Vorige maand" toevoegen na "Deze maand"

2. **getActivePreset functie (regel 335)** -- Detectie toevoegen voor "last-month": controleren of de datumrange overeenkomt met de eerste en laatste dag van de vorige maand

De `setPresetRange` functie ondersteunt `"last-month"` al (regels 313-315), dus daar is geen aanpassing nodig.
