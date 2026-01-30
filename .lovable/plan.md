

# Plan: Sorteerbare Kolommen in Vulwachtrij

## Samenvatting
De vulwachtrij tabel in de Gascilinders sectie krijgt sorteerbare kolommen. Gebruikers kunnen op elke kolomheader klikken om de data oplopend of aflopend te sorteren, met duidelijke visuele indicatoren.

## Huidige Situatie
- De vulwachtrij toont gascilinder orders in een tabel met 7 kolommen
- Er is geen mogelijkheid om de tabel te sorteren op andere kolommen dan de standaard datum-volgorde
- Bestaande sorteer-implementaties zijn al aanwezig in `GasTypeManager` en `CylinderSizeManager`

## Voorgestelde Aanpak

### Sorteerbare Kolommen
De volgende kolommen worden sorteerbaar gemaakt:

| Kolom | Sorteerveld | Type |
|-------|-------------|------|
| Order | `order_number` | Tekst |
| Klant | `customer_name` | Tekst |
| Gastype | `gas_type` | Tekst |
| Aantal | `cylinder_count` | Numeriek |
| Druk | `pressure` | Numeriek |
| Datum | `scheduled_date` | Datum |
| Status | `status` | Tekst |

### Visuele Feedback
- Kolomheaders krijgen hover-effect en cursor-pointer
- Actieve sorteerkolom toont pijl omhoog of omlaag
- Inactieve sorteerbare kolommen tonen subtiele up/down pijlen

### Standaard Sortering
De tabel opent standaard gesorteerd op datum (oplopend), zoals nu ook het geval is.

---

## Technische Details

### Wijzigingen in `GasCylinderPlanning.tsx`

**1. Type Definities**
```typescript
type SortColumn = "order_number" | "customer_name" | "gas_type" | "cylinder_count" | "pressure" | "scheduled_date" | "status";
type SortDirection = "asc" | "desc";
```

**2. State Toevoegingen**
```typescript
const [sortColumn, setSortColumn] = useState<SortColumn>("scheduled_date");
const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
```

**3. Sorteer Handler**
```typescript
const handleSort = (column: SortColumn) => {
  if (sortColumn === column) {
    setSortDirection(sortDirection === "asc" ? "desc" : "asc");
  } else {
    setSortColumn(column);
    setSortDirection("asc");
  }
};
```

**4. SortIcon Component**
```typescript
const SortIcon = ({ column }: { column: SortColumn }) => {
  if (sortColumn !== column) {
    return <ArrowUpDown className="h-4 w-4 ml-1 opacity-50" />;
  }
  return sortDirection === "asc" 
    ? <ArrowUp className="h-4 w-4 ml-1" />
    : <ArrowDown className="h-4 w-4 ml-1" />;
};
```

**5. Sorteerlogica (client-side)**
```typescript
const sortedOrders = [...filteredOrders].sort((a, b) => {
  let comparison = 0;
  switch (sortColumn) {
    case "order_number":
    case "customer_name":
    case "gas_type":
    case "status":
      comparison = a[sortColumn].localeCompare(b[sortColumn]);
      break;
    case "cylinder_count":
    case "pressure":
      comparison = a[sortColumn] - b[sortColumn];
      break;
    case "scheduled_date":
      comparison = new Date(a.scheduled_date).getTime() - new Date(b.scheduled_date).getTime();
      break;
  }
  return sortDirection === "asc" ? comparison : -comparison;
});
```

**6. Tabelheader Updates**
Elke TableHead wordt klikbaar gemaakt:
```typescript
<TableHead 
  className="cursor-pointer hover:bg-muted/50 select-none"
  onClick={() => handleSort("order_number")}
>
  <div className="flex items-center">
    Order
    <SortIcon column="order_number" />
  </div>
</TableHead>
```

**7. Import Toevoegingen**
```typescript
import { ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react";
```

### Flow
1. Gebruiker klikt op een kolomheader
2. `handleSort` bepaalt of richting moet wisselen of naar nieuwe kolom
3. State wordt bijgewerkt (`sortColumn`, `sortDirection`)
4. `sortedOrders` herberekent automatisch via React re-render
5. Tabel toont gesorteerde data met visuele indicator

