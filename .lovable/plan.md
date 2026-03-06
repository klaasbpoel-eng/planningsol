

## Plan: SOL Excel data koppelen aan PGS Register

### Wat
De SOL Excel importfunctie (die al cilinders aggregeert en gewichten berekent) uitbreiden zodat de berekende gewichten automatisch de `current_stock_kg` velden in het PGS Register updaten. Hierdoor worden de "Huidig (kg)" kolom en bezettingspercentages automatisch gevuld.

### Hoe

**1. Matching-logica toevoegen aan SOLInventoryImportDialog**
Na het aggregeren van de Excel data, de geïmporteerde gastypen matchen met `pgs_substances` records:
- Match op gasnaam: de `ContentDescription` uit Excel (bijv. "Zuurstof", "Argon", "Stikstof") vergelijken met de `gas_type_name` van PGS substances
- Per gematchte substance: de totale gewichten (`totalWeightKg`) van alle gematchte productrijen optellen
- Database update: `pgs_substances.current_stock_kg` updaten via Supabase voor de juiste locatie

**2. Extra stap in het importproces**
Na de bestaande preview een "PGS Register bijwerken" optie tonen:
- Tabel met per PGS-substance: gasnaam, berekend gewicht uit Excel, huidige waarde in database, max toegestaan
- Gebruiker kan bevestigen voordat de update wordt doorgevoerd

**3. Aanpassingen aan bestanden**
- `SOLInventoryImportDialog.tsx`: Na import, optioneel PGS substances updaten op basis van geaggregeerde gewichten per gastype + locatie
- `PGSRegistry.tsx`: Een "SOL Import" knop toevoegen in de header die de `SOLInventoryImportDialog` opent met een callback om na import de substances te herladen

### Matching-strategie
De gasnaam uit de Excel `ContentDescription` wordt genormaliseerd (lowercase, zuiverheidsgraden strippen) en vergeleken met de `gas_type_name` van de PGS substances. Gewichten worden per gastype gesommeerd over alle cilindergroottes, zodat bijv. alle Zuurstof-cilinders (5L, 10L, 50L) opgeteld de `current_stock_kg` voor "Zuurstof" vormen.

