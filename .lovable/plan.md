
# Plan: Voeg 'Dit jaar' knop toe aan Rapportageperiode

## Overzicht
Een simpele toevoeging van een "Dit jaar" knop bij de rapportageperiode presets om snel het huidige kalenderjaar te kunnen selecteren.

## Wijzigingen

### Bestand: `src/components/production/ProductionReports.tsx`

**1. Voeg nieuwe case toe aan `setPresetRange` functie (regel ~378):**

```typescript
case "this-year":
  setDateRange({ from: startOfYear(now), to: endOfYear(now) });
  break;
```

**2. Voeg nieuwe knop toe in de preset buttons sectie (regel ~584):**

```tsx
<Button variant="outline" size="sm" onClick={() => setPresetRange("this-year")}>
  Dit jaar
</Button>
```

## Volgorde van knoppen na wijziging

| Knop | Periode |
|------|---------|
| Deze week | Huidige week |
| Deze maand | Huidige maand |
| Vorige maand | Voorgaande maand |
| Laatste 3 maanden | Afgelopen kwartaal |
| **Dit jaar** | Huidig kalenderjaar (nieuw) |
| Vorig jaar | Voorgaand kalenderjaar |

## Benodigde imports
Alle benodigde date-fns functies (`startOfYear`, `endOfYear`) zijn al geïmporteerd op regel 40.
