
# Officiële gaskleuren toepassen in diagrammen en bolletjes

## Probleem
De gekleurde bolletjes naast gastypen en de kleuren in diagrammen gebruiken momenteel de kleur die in de database is opgeslagen (`gas_types.color`), in plaats van de officiële NEN-EN 1089-3 kleurcodering die al gedefinieerd is in `src/constants/gasColors.ts`.

## Oplossing
De `getGasTypeColor` functies in de plannings- en dialoogcomponenten aanpassen zodat ze de standaard `getGasColor()` functie gebruiken. Deze functie matcht op gasnaam en geeft de juiste kleur terug (bijv. Zuurstof = lichtblauw, Stikstof = donkergrijs, Argon = donkergroen, etc.).

## Bestanden die worden aangepast

### 1. `src/components/production/GasCylinderPlanning.tsx`
- `getGasTypeColor()` functie aanpassen om `getGasColor()` te gebruiken op basis van de gasnaam (via `getGasTypeLabel`)
- Import van `getGasColor` toevoegen

### 2. `src/components/production/GasCylinderOrderDialog.tsx`
- Zelfde aanpassing: `getGasTypeColor()` laten werken via `getGasColor()` op basis van gasnaam

### 3. `src/components/production/MobileOrderCard.tsx`
- Controleren of hier ook database-kleuren worden gebruikt en zo ja, aanpassen

## Technische details

De aangepaste `getGasTypeColor` functie wordt:

```typescript
import { getGasColor } from "@/constants/gasColors";

const getGasTypeColor = (order: GasCylinderOrder): string => {
  const label = getGasTypeLabel(order);
  return getGasColor(label, order.gas_type_ref?.color || "#6b7280");
};
```

Dit zorgt ervoor dat:
- Eerst wordt gematcht op de weergavenaam via de bestaande `getGasColor` lookup (exact, case-insensitive, en partieel)
- Als er geen match is, wordt de database-kleur als fallback gebruikt
- Alle bolletjes en diagrammen dezelfde kleur tonen per gastype
