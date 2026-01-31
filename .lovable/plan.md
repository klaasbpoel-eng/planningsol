

# Plan: Fix Excel Import - Niet alle orders worden geimporteerd

## Probleem Geidentificeerd

Uit de console logs blijkt dat de import faalt door **duplicate key violations** op de `order_number` kolom:

```
"duplicate key value violates unique constraint \"gas_cylinder_orders_order_number_key\""
```

### Hoofdoorzaken

1. **Zwakke ordernummer-generatie**: De huidige functie `generateOrderNumber` gebruikt:
   - `Math.random() * 1000` = slechts 1000 mogelijke random waarden
   - Bij 6000+ records is collision vrijwel gegarandeerd (birthday paradox)
   
2. **Batch-level foutafhandeling**: Als 1 record in een batch van 50 faalt, wordt de hele batch overgeslagen

3. **Geen conflict-resolutie**: Er is geen retry-mechanisme voor gefaalde records

---

## Oplossing

### 1. Verbeterde ordernummer-generatie

Vervang de huidige methode door een gegarandeerd unieke combinatie:
- Datum + index + UUID-fragment (8 karakters)
- Format: `GC-IMP-{datum}-{index}-{uuid8}`

```typescript
const generateOrderNumber = (index: number) => {
  const date = format(new Date(), "yyyyMMdd");
  const uuid = crypto.randomUUID().replace(/-/g, "").slice(0, 8);
  return `GC-IMP-${date}-${index.toString().padStart(5, "0")}-${uuid}`;
};
```

### 2. Verbeterde foutafhandeling met retry

Bij een duplicate key error:
1. Detecteer welke specifieke records het probleem veroorzaken
2. Genereer nieuwe ordernummers voor die records
3. Probeer opnieuw

### 3. Conflict handling via upsert (optioneel)

Als alternatief kan de insert worden omgezet naar een upsert met `onConflict` handling.

---

## Technische Wijzigingen

### Bestand: `src/components/production/ExcelImportDialog.tsx`

**Wijziging 1 - Ordernummer generatie (regel 291-295)**:
- Vervang `Math.random()` door `crypto.randomUUID()`
- Vergroot de index padding van 4 naar 5 cijfers voor toekomstige groei

**Wijziging 2 - Batch insert met retry (regel 318-350)**:
- Voeg retry-logica toe voor batches die falen
- Bij duplicate key error: regenereer ordernummers en probeer opnieuw
- Fallback: individuele inserts voor problematische records

**Wijziging 3 - Gedetailleerdere foutrapportage**:
- Track welke specifieke records succesvol zijn
- Toon informatievere foutmeldingen aan de gebruiker

---

## Verwacht Resultaat

- **100% van de orders** wordt succesvol geimporteerd (mits data valide is)
- Geen duplicate key errors meer bij normale imports
- Robuuste foutafhandeling bij edge cases
- Duidelijke feedback over import-status

