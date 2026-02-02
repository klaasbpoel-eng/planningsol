
# Plan: Cilindergrootte Rapportage Herstellen

## Probleem Geidentificeerd
De "Cilinders per grootte — jaarvergelijking" toont alleen 50L omdat **alle 133.922 gas cylinder orders** in de database de waarde "50L" hebben in de `cylinder_size` kolom. Dit is een data-probleem veroorzaakt door de Excel import functie.

### Oorzaak
De `parseCylinderSize` functie in `ExcelImportDialog.tsx` retourneert hardcoded waarden zoals "50L", "10L", etc. Deze komen niet overeen met de namen in de `cylinder_sizes` tabel ("50 liter cilinder", "10 liter cilinder", etc.).

```javascript
// Huidige code - retourneert "50L" als fallback
if (liters <= 40) return { size: "40L", pressure };
return { size: "50L", pressure };  // ALLES wordt 50L
```

---

## Oplossing: Twee Stappen

### Stap 1: ExcelImportDialog.tsx Aanpassen
De `parseCylinderSize` functie moet dynamisch matchen met de cilindergroottes uit de database in plaats van hardcoded waarden te retourneren.

**Wijzigingen:**
1. Cilindergroottes ophalen uit database bij bestand laden (al gedaan voor gasTypes)
2. Nieuwe functie `matchCylinderSize` maken die de beste match vindt
3. Match op basis van capacity_liters in plaats van exacte string matching

**Nieuwe logica:**
```typescript
const matchCylinderSize = (sizeStr: string, cylinderSizes: CylinderSize[]): string => {
  // Parse liter waarde uit input string
  const sizeMatch = sizeStr.match(/(\d+)\s*l/i);
  if (!sizeMatch) return cylinderSizes[0]?.name || "50 liter cilinder";
  
  const liters = parseInt(sizeMatch[1]);
  
  // Vind beste match op basis van capacity_liters
  const exactMatch = cylinderSizes.find(cs => cs.capacity_liters === liters);
  if (exactMatch) return exactMatch.name;
  
  // Vind dichtstbijzijnde match
  const closest = cylinderSizes.reduce((prev, curr) => 
    Math.abs((curr.capacity_liters || 0) - liters) < Math.abs((prev.capacity_liters || 0) - liters) 
      ? curr : prev
  );
  return closest?.name || "50 liter cilinder";
};
```

### Stap 2: Bestaande Data Migreren (Optioneel)
De 133.922 bestaande records met "50L" moeten worden gecorrigeerd. Dit is complex omdat de originele cilindergrootte niet meer beschikbaar is (Excel data is verloren).

**Opties:**
- **Optie A**: Bestaande data laten zoals het is en alleen nieuwe imports corrigeren
- **Optie B**: Alle "50L" records updaten naar "50 liter cilinder" (minimale fix)
- **Optie C**: Een data-heranalyse uitvoeren indien originele Excel bestanden beschikbaar zijn

---

## Technische Wijzigingen

### ExcelImportDialog.tsx

1. **State toevoegen voor cilindergroottes:**
```typescript
const [cylinderSizes, setCylinderSizes] = useState<{id: string; name: string; capacity_liters: number | null}[]>([]);
```

2. **Fetch cilindergroottes bij bestand selectie:**
```typescript
const fetchCylinderSizes = async () => {
  const { data } = await supabase
    .from("cylinder_sizes")
    .select("id, name, capacity_liters")
    .eq("is_active", true);
  if (data) setCylinderSizes(data);
};
```

3. **Nieuwe matching functie maken:**
Intelligent matchen van Excel cilindergrootte strings naar database waarden.

4. **Speciale gevallen afhandelen:**
   - "Dewar 240L" blijft "Dewar 240L"
   - "PP 16x50" blijft "PP 16 X 50L"
   - "50L" wordt "50 liter cilinder"

### CreateGasCylinderOrderDialog.tsx
Deze component werkt al correct - het haalt cilindergroottes uit de database en slaat de naam op. Geen wijzigingen nodig.

---

## Database Migratie (Optioneel)
Om bestaande "50L" records te corrigeren naar "50 liter cilinder":

```sql
UPDATE gas_cylinder_orders 
SET cylinder_size = '50 liter cilinder' 
WHERE cylinder_size = '50L';
```

**Let op:** Dit is een grote operatie met 133.922 records.

---

## Samenvatting Aanpak

| Stap | Actie | Impact |
|------|-------|--------|
| 1 | ExcelImportDialog.tsx fixen | Nieuwe imports krijgen correcte grootte |
| 2 | Database update (optioneel) | Bestaande "50L" wordt "50 liter cilinder" |
| 3 | Geen code wijzigingen in rapportages nodig | Werkt automatisch met correcte data |
