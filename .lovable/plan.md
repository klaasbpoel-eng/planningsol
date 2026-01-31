
# Plan: Fix Diameter Matching in Dry Ice Excel Import

## Probleem

De huidige `matchProductTypeId` functie matcht diameters incorrect door een logische fout in de matching condities.

### Huidige Code (fout)
```typescript
if (diameterStr.includes("09") || diameterStr.includes("9 mm")) {
  return ptName.includes("9") || ptName.includes("pellet"); // ❌ "pellet" matcht BEIDE types!
}
if (diameterStr.includes("03") || diameterStr.includes("3 mm")) {
  return ptName.includes("3") || ptName.includes("pellet"); // ❌ "pellet" matcht BEIDE types!
}
```

### Het Probleem
- Excel bevat waarden zoals `"09 mm."` en `"03 mm."`
- Database product types: `"Pellets 3mm"` en `"Pellets 9mm"`
- De voorwaarde `ptName.includes("pellet")` matcht **beide** product types
- Resultaat: het **eerste** product type in de array wordt altijd teruggegeven, ongeacht de werkelijke diameter

---

## Oplossing

Vervang de huidige matching logica met een robuustere aanpak:

1. **Extract numerieke diameter**: Haal het getal uit de Excel waarde (bijv. "09 mm." → 9)
2. **Directe match op nummer**: Zoek product type dat dit nummer bevat
3. **Prioriteer exacte match**: Geef voorrang aan "9mm" match boven "pellet" match

### Nieuwe Code
```typescript
const matchProductTypeId = (diameter: string): string | null => {
  const diameterStr = diameter.toLowerCase().trim();
  
  // Extract numeric value (e.g., "09 mm." → "9", "03 mm." → "3")
  const numericMatch = diameterStr.match(/(\d+)/);
  if (!numericMatch) {
    return productTypes[0]?.id || null;
  }
  
  const numericValue = parseInt(numericMatch[1], 10).toString(); // "09" → "9"
  
  // Find product type containing this number
  const match = productTypes.find(pt => {
    const ptName = pt.name.toLowerCase();
    // Check for exact numeric match in product name
    return ptName.includes(numericValue + "mm") || 
           ptName.includes(numericValue + " mm") ||
           ptName.includes(numericValue);
  });
  
  return match?.id || productTypes[0]?.id || null;
};
```

---

## Technische Wijzigingen

### Bestand: `src/components/production/DryIceExcelImportDialog.tsx`

**Wijziging 1 - Nieuwe `matchProductTypeId` functie (regels 94-112)**:
- Verwijder de foutieve `|| ptName.includes("pellet")` condities
- Gebruik regex om numerieke diameter te extraheren
- Converteer leading zeros (bijv. "09" → "9")
- Match op specifiek nummer in product type naam

---

## Voorbeeld Matching

| Excel Waarde | Geëxtraheerd Nummer | Match Product Type |
|--------------|---------------------|-------------------|
| "09 mm."     | 9                   | "Pellets 9mm" ✓   |
| "03 mm."     | 3                   | "Pellets 3mm" ✓   |
| "9 mm"       | 9                   | "Pellets 9mm" ✓   |
| "3mm"        | 3                   | "Pellets 3mm" ✓   |

---

## Verwacht Resultaat

- **100% correcte diameter matching** bij import
- Robuust tegen verschillende invoerformaten (met/zonder leading zero, spaties, punten)
- Fallback naar eerste product type als geen match gevonden wordt
