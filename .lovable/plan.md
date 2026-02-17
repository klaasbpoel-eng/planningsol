

## Drukbereik-indicatie toevoegen aan Receptenmaker

### Wat er verandert
Onder het doeldruk-invoerveld verschijnt een compacte visuele indicatie die het acceptabele drukbereik toont op basis van een tolerantie van +/- 5%. Bijvoorbeeld: bij 200 bar wordt "190 - 210 bar bij 15 C" getoond.

Daarnaast wordt dezelfde informatie ook weergegeven in de recepttabel (bij het info-blok onderaan) zodat het bij het afdrukken zichtbaar is.

### Hoe het eruitziet

**Onder het doeldruk-veld:**
Een klein informatielabel in de stijl van een badge/melding:
```
Acceptabel bereik: 190 - 210 bar bij 15°C (± 5%)
```

**In het info-blok onderaan de recepttabel** (ook zichtbaar bij printen):
Een extra regel:
```
Einddruk: 200 bar ± 5% (190 - 210 bar bij 15°C)
```

### Technisch detail

**Bestand: `src/components/production/GasMixtureRecipemaker.tsx`**

1. **Berekende waarden** -- twee lokale variabelen toevoegen:
   - `pressureMin = targetPressure * 0.95` (afgerond op geheel getal)
   - `pressureMax = targetPressure * 1.05` (afgerond op geheel getal)

2. **Onder het doeldruk-invoerveld** (na de preset-knoppen, rond regel 383): een klein tekstelement toevoegen met het bereik in `text-xs text-muted-foreground` styling.

3. **Info-blok onderaan** (regel 540-544): de tekst bij "Vulvolgorde" corrigeren (deze zegt nu nog "Zwaarste component eerst" maar zou "Laagste percentage eerst" moeten zijn) en een extra `<p>` toevoegen met het drukbereik.

4. **Totaalregel in tabel** (regel 527): optioneel het drukbereik ook tonen achter de doeldruk.

Geen database-aanpassingen nodig. Alleen visuele toevoegingen.
