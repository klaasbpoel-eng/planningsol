
# Plan: Fix Gastype Matching in Excel Import

## Probleem Analyse

De Excel import voor vulorders matcht gastypes incorrect. In de database staan nu 47.645 records met "40%He in Zuurstof" terwijl er slechts 140.258 totale records zijn - dit is 34% van alle orders en onrealistisch hoog.

### Oorzaak
De `matchGasTypeId` functie in `ExcelImportDialog.tsx` heeft een logische fout:

```typescript
const match = gasTypes.find(gt => {
  // Probleem 1: Exacte match wordt eerst gecontroleerd, maar...
  if (gtName === name) return true;
  
  // Probleem 2: Partiële matches zijn te generiek
  if (name.includes(gtName) || gtName.includes(name)) return true;
  
  // Probleem 3: Generieke keyword matching matcht te veel
  if (name.includes("zuurstof") && gtName.includes("zuurstof")) return true; // ❌
  if (name.includes("helium") && gtName.includes("helium")) return true;     // ❌
  // ... etc
});
```

`.find()` retourneert de EERSTE match in de array. Wanneer de gastypes alfabetisch gesorteerd zijn, komt "40%He in Zuurstof" voor andere "zuurstof" gastypes. Daardoor wordt:
- "Zuurstof" → gematcht naar "40%He in Zuurstof" ✗
- "Zuurstof 5.0" → gematcht naar "40%He in Zuurstof" ✗
- "AliSOL Zuurstof" → gematcht naar "40%He in Zuurstof" ✗

---

## Oplossing

### Nieuwe Matching Strategie

Implementeer een **prioriteit-gebaseerde matching** met 4 niveaus:

1. **Exacte match** (hoogste prioriteit)
2. **Genormaliseerde exacte match** (spaties/case negeren)  
3. **Bevat volledige naam** (één naam bevat de andere volledig)
4. **Geen match** (null retourneren in plaats van foute match)

### Technische Wijzigingen

**Bestand: `src/components/production/ExcelImportDialog.tsx`**

Vervang de huidige `matchGasTypeId` functie (regels 73-96) met:

```typescript
const matchGasTypeId = (gasName: string): string | null => {
  const normalize = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
  const normalizedInput = normalize(gasName);
  
  // Prioriteit 1: Exacte match
  const exactMatch = gasTypes.find(gt => normalize(gt.name) === normalizedInput);
  if (exactMatch) return exactMatch.id;
  
  // Prioriteit 2: Één bevat de andere volledig (kies de kortste match)
  const containsMatches = gasTypes.filter(gt => {
    const gtNorm = normalize(gt.name);
    return normalizedInput.includes(gtNorm) || gtNorm.includes(normalizedInput);
  });
  
  if (containsMatches.length > 0) {
    // Sorteer op lengte-verschil (kleinste verschil = beste match)
    containsMatches.sort((a, b) => {
      const diffA = Math.abs(normalize(a.name).length - normalizedInput.length);
      const diffB = Math.abs(normalize(b.name).length - normalizedInput.length);
      return diffA - diffB;
    });
    return containsMatches[0].id;
  }
  
  // Geen match gevonden
  return null;
};
```

### Waarom dit werkt

| Excel waarde | Huidige match | Nieuwe match |
|--------------|---------------|--------------|
| "Zuurstof" | 40%He in Zuurstof ❌ | Zuurstof ✓ |
| "Zuurstof 5.0" | 40%He in Zuurstof ❌ | Zuurstof 5.0 ✓ |
| "40%He in Zuurstof" | 40%He in Zuurstof ✓ | 40%He in Zuurstof ✓ |
| "AliSOL Stikstof" | 40%He in Zuurstof ❌ | AliSOL Stikstof ✓ |

De nieuwe logica:
1. Zoekt eerst een exacte match
2. Bij partiële matches kiest het de **kortste** match (kleinste lengte-verschil)
3. Verwijdert de generieke keyword-matching die het probleem veroorzaakte

---

## Bestaande Data Corrigeren

De 47.645 foutief gematchte records moeten worden gecorrigeerd. Dit kan door:

1. **Optie A**: Alle orders verwijderen en opnieuw importeren
2. **Optie B**: Een correctie-query uitvoeren (complex, vereist originele gassoort namen)

Aangezien de originele gassoort naam niet bewaard is in de database (alleen de `gas_type_id`), is **Optie A** de aanbevolen aanpak. De gebruiker kan de bestaande orders verwijderen via de "Alle orders verwijderen" functie en opnieuw importeren na de fix.

---

## Samenvatting Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/production/ExcelImportDialog.tsx` | Vervang `matchGasTypeId` functie met prioriteit-gebaseerde matching |

## Na Implementatie

1. Verwijder de huidige (foutieve) orders via de admin functie
2. Importeer de Excel opnieuw
3. Verifieer dat de gastypes correct zijn gematcht
