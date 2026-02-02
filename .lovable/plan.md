
# Plan: Fix Cylinder Size Import Bug

## Probleem Analyse

### Huidige Situatie
Bij het importeren van Excel-bestanden wordt `cylinder_size` altijd als "50L" opgeslagen, ongeacht de werkelijke waarde in het Excel-bestand.

### Oorzaak Gevonden
Uit de database-analyse blijkt:
- **Alle 133.922 orders hebben `cylinder_size: 50L`**
- De daadwerkelijke cilindergrootte staat in de **`notes` kolom** (bijv. "10 liter cilinder", "PP 16 X 50L", "Dewar 240L")
- Dit bewijst dat de kolom-mapping niet correct werkt

De console log toont:
```
Column mapping: { date: 0, gasType: 1, size: 2, count: 3, grade: 4, location: 5, customer: 6, notes: 7, pressure: 8 }
```

Het probleem zit in de kolomdetectie (regels 251-252):
```typescript
if (cellStr.includes("type vulling") || cellStr.includes("vulling type") || 
    cellStr.includes("cilinderinhoud") || cellStr.includes("cilinder inhoud")) columnMap.size = idx;
```

De Excel-header bevat waarschijnlijk "Omschrijving" of iets anders dat niet matcht met bovenstaande zoektermen. Hierdoor wordt kolom 2 standaard gebruikt, die leeg of irrelevant is.

---

## Oplossing

### Strategie 1: Verbeterde Kolom Detectie
Uitbreiding van de kolomherkenning om meer variaties te ondersteunen:

```typescript
// Verbeterde size kolom detectie
if (cellStr.includes("type vulling") || cellStr.includes("vulling type") || 
    cellStr.includes("cilinderinhoud") || cellStr.includes("cilinder inhoud") ||
    cellStr.includes("omschrijving") || cellStr.includes("inhoud") ||
    cellStr.includes("type") || cellStr.includes("formaat") ||
    cellStr.includes("size") || cellStr.includes("grootte")) {
  columnMap.size = idx;
}
```

### Strategie 2: Fallback naar Notes Kolom
Als de size kolom leeg is of niet herkend wordt, probeer de cilindergrootte uit de notes/omschrijving kolom te extraheren:

```typescript
// In de row processing loop
let sizeStr = String(row[columnMap.size ?? 2] || "").trim();

// Fallback: als size leeg is, probeer notes kolom
if (!sizeStr && columnMap.notes !== undefined) {
  sizeStr = String(row[columnMap.notes] || "").trim();
}

// Of probeer omschrijving kolom als die bestaat
if (!sizeStr && columnMap.description !== undefined) {
  sizeStr = String(row[columnMap.description] || "").trim();
}
```

### Strategie 3: Verbeterde parseCylinderSize Functie
De parsing functie moet robuuster worden voor meer formaten:

```typescript
const parseCylinderSize = (sizeStr: string): { size: string; pressure: number } => {
  const str = sizeStr.toLowerCase().trim();
  if (!str) return { size: "50L", pressure: 200 };
  
  let pressure = 200;
  if (str.includes("300 bar")) pressure = 300;
  if (str.includes("4 bar")) pressure = 4; // Voor Dewars
  
  // Dewar patronen (uitgebreid)
  if (str.includes("dewar")) {
    const dewarMatch = str.match(/dewar\s*(\d+)/i);
    if (dewarMatch) return { size: `Dewar ${dewarMatch[1]}L`, pressure };
    return { size: "Dewar 240L", pressure };
  }
  
  // PP bundel patronen (uitgebreid)
  const ppMatch = str.match(/pp\s*(\d+)\s*x\s*(\d+)/i);
  if (ppMatch) {
    return { size: `PP ${ppMatch[1]} X ${ppMatch[2]}L`, pressure };
  }
  
  // Liter patroon met komma-ondersteuning (bijv. "0,5 liter")
  const literMatch = str.match(/(\d+[,.]?\d*)\s*l(?:iter)?/i);
  if (literMatch) {
    const liters = parseFloat(literMatch[1].replace(',', '.'));
    // Exacte match met database cylinder_sizes
    return { size: `${Math.round(liters)}L`, pressure };
  }
  
  // Fallback
  return { size: "50L", pressure };
};
```

---

## Technische Wijzigingen

### Bestand: `src/components/production/ExcelImportDialog.tsx`

#### 1. Verbeter kolomdetectie (regels 251-252)
Uitbreiding van de zoektermen voor de size kolom:

```typescript
// Oude code
if (cellStr.includes("type vulling") || cellStr.includes("vulling type") || 
    cellStr.includes("cilinderinhoud") || cellStr.includes("cilinder inhoud")) columnMap.size = idx;

// Nieuwe code  
if (cellStr.includes("type vulling") || cellStr.includes("vulling type") || 
    cellStr.includes("cilinderinhoud") || cellStr.includes("cilinder inhoud") ||
    cellStr.includes("omschrijving") || cellStr.includes("inhoud") ||
    cellStr === "type" || cellStr.includes("formaat") ||
    cellStr.includes("size") || cellStr.includes("grootte")) {
  // Alleen toewijzen als size nog niet is geset (prioriteit behouden)
  if (columnMap.size === undefined) {
    columnMap.size = idx;
  }
}
```

#### 2. Fallback naar notes/omschrijving kolom (regel 301)
Als de size kolom leeg is, gebruik de notes kolom:

```typescript
// Oude code
const sizeStr = String(row[columnMap.size ?? 2] || "").trim();

// Nieuwe code
let sizeStr = String(row[columnMap.size ?? 2] || "").trim();

// Fallback: als size leeg is, probeer notes/omschrijving kolom
if (!sizeStr && columnMap.notes !== undefined) {
  sizeStr = String(row[columnMap.notes] || "").trim();
}
```

#### 3. Verbeter parseCylinderSize functie (regels 115-144)
Robuustere parsing voor alle cilindergrootte formaten:

- Ondersteuning voor komma-decimalen (bijv. "0,5 liter")
- Uitgebreide Dewar matching met variabele groottes
- Uitgebreide PP bundel matching
- Exacte liter matching in plaats van ranges (bijv. "10 liter" -> "10L", niet "50L")

#### 4. Dynamische matching met cylinder_sizes tabel
Om te garanderen dat de geïmporteerde sizes overeenkomen met de database:

```typescript
// Fetch cylinder sizes bij file select
const [cylinderSizes, setCylinderSizes] = useState<string[]>([]);

const fetchCylinderSizes = async () => {
  const { data } = await supabase
    .from("cylinder_sizes")
    .select("name, capacity_liters")
    .eq("is_active", true);
  if (data) setCylinderSizes(data.map(s => s.name));
};

// In parseCylinderSize: probeer exacte match met database
const matchDbCylinderSize = (parsedSize: string): string => {
  const exactMatch = cylinderSizes.find(s => 
    s.toLowerCase() === parsedSize.toLowerCase()
  );
  if (exactMatch) return exactMatch;
  
  // Fuzzy match op basis van liters
  const liters = parseFloat(parsedSize.replace(/[^\d.,]/g, '').replace(',', '.'));
  if (!isNaN(liters)) {
    const sizeMatch = cylinderSizes.find(s => {
      const sLiters = parseFloat(s.replace(/[^\d.,]/g, '').replace(',', '.'));
      return Math.abs(sLiters - liters) < 0.5;
    });
    if (sizeMatch) return sizeMatch;
  }
  
  return parsedSize;
};
```

---

## Verwacht Resultaat
Na deze wijzigingen:
1. Cilindergroottes worden correct gedetecteerd uit de juiste Excel-kolom
2. Als de size kolom leeg is, wordt de omschrijving/notes kolom gebruikt
3. Formaten zoals "10 liter cilinder", "PP 16 X 50L", "Dewar 240L" worden correct geparsed
4. De rapportages tonen correcte data per cilindergrootte

---

## Bestandswijzigingen
| Bestand | Wijziging |
|---------|-----------|
| `src/components/production/ExcelImportDialog.tsx` | Verbeterde kolomdetectie, fallback logic, robuustere parsing |

