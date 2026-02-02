# Plan: Fix Cylinder Size Import Bug

## Status: ✅ GEÏMPLEMENTEERD

De cylinder size import bug is opgelost. De volgende wijzigingen zijn doorgevoerd:

### Wijzigingen in `ExcelImportDialog.tsx`

1. **Nieuwe state voor cylinder sizes**
   - `cylinderSizes` state toegevoegd voor dynamische matching
   - `fetchCylinderSizes()` functie haalt actieve sizes op uit de database

2. **Verbeterde `parseCylinderSize` functie**
   - Accepteert nu `cylinderSizes` parameter voor database matching
   - Ondersteuning voor komma-decimalen (bijv. "0,5 liter")
   - Uitgebreide Dewar matching met variabele groottes
   - Uitgebreide PP bundel matching (bijv. "PP 16 X 50L")
   - Exacte liter matching met database validatie
   - Druk-extractie verbeterd (300 bar, 4 bar voor Dewars)

3. **Uitgebreide kolomdetectie**
   - Toegevoegd: "formaat", "size", "grootte", "inhoud"
   - Prioriteit-gebaseerde matching (eerste match wint)

4. **Fallback naar notes kolom**
   - Als de size kolom leeg is, wordt de notes/omschrijving kolom gebruikt
   - Dit vangt gevallen op waar de cilindergrootte in de omschrijving staat

### Verwacht Resultaat
- Cilindergroottes worden correct gedetecteerd uit de juiste Excel-kolom
- Als de size kolom leeg is, wordt de omschrijving/notes kolom gebruikt
- Formaten zoals "10 liter cilinder", "PP 16 X 50L", "Dewar 240L" worden correct geparsed
- De rapportages tonen nu correcte data per cilindergrootte
