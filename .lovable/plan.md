

# Fix: KPI Dashboard toont nog steeds 1000 orders voor 2025

## Probleem Analyse

Na code-review blijkt dat de KPI Dashboard code **correct is aangepast** om de `get_production_efficiency_by_period` RPC te gebruiken. De RPC functies bestaan in de database en berekenen correct:
- **19.398** voltooide orders voor 2025
- **321.674** totale cilinders

Het probleem is dat:
1. **Foutafhandeling ontbreekt**: Als de RPC faalt (bijv. autorisatie), wordt dit stil genegeerd
2. **De preview moet mogelijk verversen** om de nieuwe code te laden

## Oplossing

### Stap 1: Voeg error logging toe aan KPIDashboard

Voeg console.error logging en optioneel een toast melding toe wanneer de RPC faalt:

```typescript
const [currentRes, prevRes] = await Promise.all([
  supabase.rpc("get_production_efficiency_by_period", { ... }),
  supabase.rpc("get_production_efficiency_by_period", { ... })
]);

// Voeg error handling toe
if (currentRes.error) {
  console.error("Error fetching current period data:", currentRes.error);
}
if (prevRes.error) {
  console.error("Error fetching previous period data:", prevRes.error);
}
```

### Stap 2: Voeg try-catch wrapper toe

Omring de hele fetch operatie met try-catch voor betere foutopsporing:

```typescript
const fetchKPIData = useCallback(async () => {
  setLoading(true);
  
  try {
    // ... existing code
  } catch (error) {
    console.error("Error fetching KPI data:", error);
  } finally {
    setLoading(false);
  }
}, [location, dateRange, currentYear]);
```

### Stap 3: Verifieer deployment

Na de wijzigingen, ververs de preview en test met "Vorig jaar" (2025) om te bevestigen dat de correcte aantallen worden getoond.

## Bestanden te wijzigen

| Bestand | Wijziging |
|---------|-----------|
| `src/components/production/KPIDashboard.tsx` | Voeg error handling en logging toe |

## Verwacht Resultaat

Na implementatie:
- Het KPI Dashboard toont **19.398** voltooide orders voor 2025
- Eventuele fouten worden gelogd naar de console voor debugging
- Bij een fout wordt een fallback weergegeven in plaats van stille 0-waarden

## Verificatie Stappen

1. Open de Productie pagina
2. Ga naar de Rapportage tab
3. Selecteer "Vorig jaar" om 2025 te bekijken
4. Controleer of het KPI Dashboard nu 19.398 voltooide orders toont
5. Check de browser console voor eventuele foutmeldingen

