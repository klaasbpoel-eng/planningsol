

## Vulvolgorde aanpassen: laagste percentage eerst

### Wat er verandert
De vulvolgorde in de receptenmaker wordt aangepast zodat de gascomponent met het **laagste percentage** als eerste wordt gevuld, in plaats van de huidige sortering op massa (zwaarste eerst).

### Technisch detail

**Bestand: `src/components/production/GasMixtureRecipemaker.tsx`** -- regel 185

De huidige sortering:
```
.sort((a, b) => b.massGrams - a.massGrams)
```

Wordt vervangen door:
```
.sort((a, b) => a.percentage - b.percentage)
```

Dit zorgt ervoor dat het gas met het kleinste aandeel als eerste in de vulvolgorde verschijnt. De cumulatieve gewichten worden daarna automatisch correct opnieuw berekend, omdat die berekening na de sortering plaatsvindt.

Eén regel wijzigt, geen andere bestanden of database-aanpassingen nodig.

