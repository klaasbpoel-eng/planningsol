

## Voorraad Import Aanpassen aan Excel Formaat

De huidige importfunctie herkent de kolomnamen uit het Excel-bestand niet correct. Het bestand gebruikt specifieke headers die niet overeenkomen met de huidige detectielogica.

### Het probleem

De Excel headers zijn:
- `SubCode` -- artikelcode
- `SubCodeDescription` -- omschrijving
- `GemVanQty` -- gemiddeld verbruik
- `AantalVanBarcode` -- voorraad (aantal op voorraad)
- `Verscil` -- verschil (let op: typfout in origineel, geen "h")

De huidige code zoekt naar woorden als "omschrijving", "voorraad", "gem verbr" -- die niet in deze headers voorkomen.

### Wat wordt er aangepast

**Bestand: `src/components/production/StockExcelImportDialog.tsx`**

De header-detectielogica wordt uitgebreid zodat de exacte kolomnamen uit het Excel-bestand worden herkend:

1. **Header-rij detectie** (regel 86-90): Voeg de nieuwe patronen toe zodat de rij herkend wordt:
   - `subcodeDescription` of `gemvanqty` of `aantalvanbarcode`

2. **Kolom-mapping** (regel 92-109): Voeg per kolom de exacte headers toe:
   - `subCode`: ook matchen op `subcode` (staat er al, werkt)
   - `description`: ook matchen op `subcodedescription`
   - `averageConsumption`: ook matchen op `gemvanqty`
   - `numberOnStock`: ook matchen op `aantalvanbarcode`
   - `difference`: ook matchen op `verscil` (zonder h)

### Technische details

De wijzigingen zitten alleen in de `handleFileSelect` callback:

**Header-rij herkenning** -- de conditie wordt verruimd:
```
// Bestaand: zoekt "omschrijving" EN "voorraad"
// Nieuw: ook matchen als "subcodedescription" EN "gemvanqty" aanwezig zijn
```

**Kolom-mapping** -- per kolom extra patronen:
```
description: + "subcodedescription"
averageConsumption: + "gemvanqty"  
numberOnStock: + "aantalvanbarcode"
difference: + "verscil"
```

Geen andere bestanden hoeven te worden aangepast.
