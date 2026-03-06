

## Plan: GHS/ADR pictogram keuze voor gebruiker

### Wat verandert er
Een toggle bovenaan het PGS Register waarmee de gebruiker kan kiezen welke pictogrammen getoond worden: **GHS**, **ADR**, of **Beide**. De keuze wordt opgeslagen in `localStorage` zodat deze behouden blijft.

### Aanpak

**1. ADR SVG-bestanden toevoegen** (`public/adr/`)
Officiële ADR-labels als SVG downloaden van Wikimedia Commons:
- `ADR_2.1.svg` — Brandbare gassen
- `ADR_2.2.svg` — Niet-brandbare, niet-giftige gassen
- `ADR_2.3.svg` — Giftige gassen
- `ADR_3.svg` — Brandbare vloeistoffen
- `ADR_5.1.svg` — Oxiderende stoffen
- `ADR_6.1.svg` — Giftige stoffen
- `ADR_8.svg` — Bijtende stoffen
- `ADR_9.svg` — Diverse gevaarlijke stoffen

**2. ADR_CONFIG mapping toevoegen**
Naast de bestaande `GHS_CONFIG` een `ADR_CONFIG` object aanmaken, plus een mapping-tabel `GHS_TO_ADR` die de vertaling maakt (bijv. `GHS04` → `ADR 2.2`, `GHS03` → `ADR 5.1`).

**3. ToggleGroup selector toevoegen**
Een `ToggleGroup` (single select) met drie opties: "GHS", "ADR", "Beide". Wordt geplaatst naast de bestaande filters bovenaan het register. State wordt opgeslagen via `localStorage`.

**4. Pictogram-rendercomponent aanpassen**
De huidige `GHSDiamond` component wordt vervangen door een `HazardPictogram` component die op basis van de toggle-keuze:
- **GHS**: het GHS-pictogram toont (huidige gedrag)
- **ADR**: het bijbehorende ADR-label toont via de mapping
- **Beide**: beide pictogrammen naast elkaar toont

**5. Export aanpassen**
De Excel/PDF export past de kolomnaam en waarden aan op basis van de huidige selectie.

### Bestanden
- `public/adr/*.svg` — nieuwe ADR SVG-assets (8 bestanden)
- `src/components/production/PGSRegistry.tsx` — toggle + aangepaste pictogramcomponent

### Geen database-wijzigingen nodig
De `hazard_symbols` kolom blijft GHS-codes bevatten. De ADR-weergave is puur een UI-vertaling.

