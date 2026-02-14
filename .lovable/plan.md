

## Gastypes zichtbaar houden in beheeroverzicht

### Probleem
De `api.gasTypes.getAll()` functie filtert op `is_active = true`. Wanneer je de toggle uitschakelt, wordt het gastype onzichtbaar in het beheeroverzicht omdat het niet meer door het filter komt.

### Oplossing
Een nieuwe API-methode toevoegen die alle gastypes ophaalt (inclusief inactieve) en deze gebruiken in het beheeroverzicht (GasTypeManager).

### Technische details

**1. `src/lib/api.ts`** - Nieuwe methode toevoegen:
- `getAllIncludingInactive()` die dezelfde query doet als `getAll()` maar zonder het `is_active = true` filter.

**2. `src/components/production/GasTypeManager.tsx`** - Aanpassen:
- `fetchGasTypes()` wijzigen om `api.gasTypes.getAllIncludingInactive()` te gebruiken in plaats van `api.gasTypes.getAll()`.

De bestaande `getAll()` methode met het `is_active` filter blijft ongewijzigd, zodat bestelformulieren alleen actieve gastypes tonen.
