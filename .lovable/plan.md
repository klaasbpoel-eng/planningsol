## Doel
In de gastype-tabel onder de horizontale staafgrafiek wordt nu alleen een delta-kolom (Δ) getoond voor het **totaal** (huidig jaar vs. vorig jaar). De gebruiker wil de delta ook **per locatie** (Emmen en Tilburg) zien, zodat duidelijk wordt of een afwijking uit één locatie komt of uit beide.

## Aanpak
Bestand: `src/components/production/LocationComparisonReport.tsx` — alleen de gastype-tabel (regel ~937–1024). Geen wijzigingen in data/RPC; `emmen_prev` en `tilburg_prev` zijn al per gastype beschikbaar.

Wanneer de vergelijkingstoggle (`showComparison`) aanstaat:

1. **Per rij** een kleine delta-badge tonen direct onder of naast het getal voor Emmen en Tilburg, met dezelfde stijl als de bestaande totaal-Δ (groen ≥ 0, rood < 0, formaat `+12%` / `-8%`, `—` als vorige waarde 0).
2. **In de totalenrij** dezelfde locatie-delta tonen onder Emmen-totaal en Tilburg-totaal.
3. De bestaande totaal-Δ kolom blijft ongewijzigd, zodat de eindgebruiker de drie deltas (Emmen, Tilburg, Totaal) naast elkaar kan vergelijken.
4. Wanneer de toggle uit staat verandert er niets aan de tabel.

## Visueel voorstel
Compacte tweede regel onder het getal, kleiner lettertype (`text-[10px]`), zodat de tabelbreedte niet groeit:

```text
Emmen          Tilburg        2026 YTD   2025 YTD   Δ
1.036          965            2.001      1.848      +8%
 +5%            -2%
```

Alternatief: een extra Δ-kolom per locatie. Nadeel: tabel wordt veel breder en past slechter op smallere schermen. Voorstel: de inline-variant.

## Tests
Geen wijzigingen aan `periodLabels.ts` of bestaande snapshot-tests nodig — labels veranderen niet. Snapshot/unit-tests blijven groen.