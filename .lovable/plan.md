

# Plan: Fix kolom mapping voor Excel import

## Probleem geïdentificeerd
De Excel kolomstructuur in `Productie_2026.xlsx` is:
1. Datum (index 0)
2. Gastype (index 1)
3. Cilinderinhoud (index 2)
4. Aantal (index 3)
5. M/T (index 4)
6. **Locatie (index 5)** ← Wordt nu verkeerd gemapped naar `customer`
7. **Klant (index 6)** ← Wordt nu verkeerd gemapped naar `notes`
8. Omschrijving (index 7) ← Dit zou `notes` moeten zijn

De huidige header detectie zoekt naar "vulling tbv" voor customer, maar het Excel bestand gebruikt "Klant". Hierdoor matcht de header niet en valt de code terug naar verkeerde fallback indices.

---

## Oplossing

### Stap 1: Header detectie uitbreiden voor "Klant"
Voeg "klant" toe aan de zoektermen voor de customer kolom naast de bestaande "vulling tbv" en "tbv".

```text
if (cellStr.includes("vulling tbv") || cellStr.includes("tbv") || 
    cellStr.includes("klant") || cellStr.includes("customer")) {
  columnMap.customer = idx;
}
```

### Stap 2: Header detectie uitbreiden voor "Omschrijving" als notes
Voeg "omschrijving" toe aan de zoektermen voor notes:

```text
if (cellStr.includes("opmerkingen") || cellStr.includes("opmerking") ||
    cellStr.includes("omschrijving") || cellStr.includes("notes")) {
  columnMap.notes = idx;
}
```

### Stap 3: Fallback indices aanpassen
Update de fallback kolom mapping voor het geval headers niet gevonden worden, zodat deze overeenkomt met de huidige Excel structuur:

```text
columnMap = { 
  date: 0, 
  gasType: 1, 
  size: 2, 
  count: 3, 
  grade: 4, 
  location: 5,  // Nieuw
  customer: 6,  // Was 5, nu 6
  notes: 7      // Was 6, nu 7
};
```

---

## Technische wijzigingen

| Regel | Wijziging |
|-------|-----------|
| 244 | Header detectie: "datum" en "gassoort" → verbreden naar "gastype" |
| 251 | Cilinderinhoud toevoegen aan size detectie |
| 254 | "klant" en "customer" toevoegen aan customer detectie |
| 255 | "omschrijving" toevoegen aan notes detectie |
| 269 | Fallback indices aanpassen naar juiste volgorde |

---

## Verwacht resultaat
Na deze wijziging worden de Excel kolommen correct gemapped:
- Kolom "Locatie" (index 5) → `location` veld
- Kolom "Klant" (index 6) → `customer` veld  
- Kolom "Omschrijving" (index 7) → `notes` veld

Dit zorgt ervoor dat klantnamen correct worden geïmporteerd in het `customer_name` veld en locaties in het `location` veld.

