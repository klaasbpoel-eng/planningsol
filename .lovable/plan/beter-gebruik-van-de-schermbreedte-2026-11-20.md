# Beter gebruik van de schermbreedte

## Wat er nu gebeurt
Alle pagina's zijn maximaal 1400 pixels breed. Op jouw scherm (ca. 1960 breed) blijft daardoor links en rechts ruim 250 pixels leeg, terwijl brede tabellen (zoals Ramses-correcties) moeten scrollen. De marges vergroten zou dit juist erger maken; de oplossing is de inhoud breder laten worden.

## Voorstel
1. **Ruimere standaardbreedte**: de inhoud groeit mee tot ca. 1800 pixels op grote schermen. Op laptops en telefoons verandert niets.
2. **Kantlijn die meeschaalt**: smal op telefoon, iets ruimer op laptop, ruim op grote monitors, zodat tekst nooit tegen de rand plakt.
3. **Knop "Volledige breedte"** in het gebruikersmenu (rechtsboven): wie wil, laat de inhoud de hele schermbreedte vullen. De keuze wordt per apparaat onthouden.
4. **Tabelpagina's altijd volle breedte**: Ramses-correcties en andere grote tabellen gebruiken automatisch de hele breedte.
5. Kop en menu balk worden even breed als de inhoud, zodat alles netjes in lijn staat.

Formulieren en dialoogvensters (zoals Vrijgaves) houden bewust hun smalle opmaak, omdat dat beter leest.

## Technische details
- `tailwind.config.ts`: container `2xl` naar 1800px, padding responsief (`1rem / sm 1.5rem / 2xl 2.5rem`).
- `PageLayout.tsx` + `Header.tsx`: dubbele `px-4` weghalen; nieuwe prop `fullWidth` en een gedeelde voorkeur (localStorage `layout-width`, hook `useLayoutWidth`) die `max-w-none` toepast.
- `RamsesCorrectionsPage` gebruikt `fullWidth`.
- Kleine test voor de breedtevoorkeur (standaard "normaal", onthouden na wisselen).
