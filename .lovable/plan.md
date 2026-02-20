

# Fix: Gewichtsberekening Receptenmaker Gasmengsels

## Probleem

De huidige berekening bepaalt de compressiefactor (Z) per gas afzonderlijk bij de **partiaaldruk**. Voor CO2 bij 63 bar en 15 graden C ligt dit dicht bij het kritische punt, waardoor de Peng-Robinson vergelijking een **vloeistof-Z** (0.14) geeft in plaats van een gas-Z. Hierdoor wordt het CO2-gewicht circa 7x te hoog berekend.

In werkelijkheid is CO2 in een gasmengsel geen vloeistof -- het gedraagt zich als onderdeel van de gasfase van het mengsel. De berekening moet daarom op mengselniveau plaatsvinden.

## Oplossing

Vervang de per-component partiaaldruk-methode door een **mengsel-Z benadering** met van der Waals mengregels:

1. Bereken mengsel-parameters `a_mix` en `b_mix` met lineaire/kwadratische mengregels op basis van de moolfracties
2. Los de PR-kubische vergelijking op voor het **mengsel** bij de **totale druk**
3. Selecteer altijd de gaswortel (grootste Z)
4. Bereken het totaal aantal mol: `n_total = (P_total x V) / (Z_mix x R x T)`
5. Verdeel massa per component: `m_i = n_total x x_i x M_i`

Dit komt overeen met de machine-berekening en geeft correcte resultaten, ook voor CO2-houdende mengsels.

## Verwachte resultaten na fix (210 bar, 50L)

- CO2 (30%): circa 5.200 - 5.800 g (was 40.249 g)
- O2 (70%): circa 9.000 - 9.500 g (was 10.785 g)
- Totaal: circa 14.500 - 15.300 g (was 51.034 g)

---

## Technische details

### Bestand: `src/components/production/GasMixtureRecipemaker.tsx`

**Stap 1 -- Nieuwe mengsel-Z functie**

Vervang de huidige `calculateZFactor` (pure component, partiaaldruk) door een `calculateMixtureZFactor` die:
- Molfracties en kritische eigenschappen van alle actieve componenten ontvangt
- `a_mix = SUM_i SUM_j (x_i * x_j * sqrt(a_i * a_j))` berekent (zonder binaire interactieparameters, k_ij = 0)
- `b_mix = SUM_i (x_i * b_i)` berekent
- De kubische vergelijking oplost bij de **totale druk**
- Altijd de grootste (gas-fase) wortel retourneert

**Stap 2 -- Aanpassing `fillingSteps` berekening (regel 167-192)**

- Bereken `Z_mix` eenmalig voor het gehele mengsel bij totale druk
- Bereken `n_total = (P_total * V) / (Z_mix * R * T)` (in SI-eenheden)
- Bereken massa per component: `m_i = n_total * (x_i) * M_i`
- Toon Z_mix in de tabel in plaats van individuele Z-waarden

**Stap 3 -- UI aanpassingen**

- De Z-kolom toont nu de mengsel-Z (identiek voor alle componenten)
- De methode-tekst onderin wordt bijgewerkt om "mengsel-compressiefactor" te vermelden

