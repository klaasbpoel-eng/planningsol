# Ramses-tabel afstemmen op de nieuwe tabelstructuur

## Wat ik zie
De kolommen worden al automatisch uit de database gelezen, dus nieuwe of verdwenen kolommen verschijnen vanzelf. Maar de kolommen **Klant** en **Debiteurnummer** bevatten nu een lijst (meerdere klanten per regel). Die lijst wordt nu ruw getoond, bijvoorbeeld `["UMCG","AZG Post Groningen 1"]`.

## Wat ik ga veranderen
1. **Lijsten netjes tonen**: elke klant en elk debiteurnummer als los label naast of onder elkaar, zonder haakjes en aanhalingstekens. Klant en bijbehorend debiteurnummer staan in dezelfde volgorde.
2. **Zoeken en filteren**: zoeken op een klantnaam of debiteurnummer vindt alle regels waar die in de lijst voorkomt. "Waarden aanvinken uit lijst" toont losse klanten in plaats van hele combinaties.
3. **Sorteren**: sorteert op de eerste klant in de lijst.
4. **CSV-export**: lijsten worden als `UMCG; AZG Post Groningen 1` geëxporteerd.
5. **Slimme zoekfunctie (AI)**: weet dat deze kolommen lijsten zijn, zodat "regels van UMCG" goed werkt.

## Technische details
- `src/lib/dataTable.ts`: nieuw kolomtype `list` (herkend aan arrays of JSON-tekst `[...]`), helpers `parseListValue`, weergave, CSV-join; filters via PostgREST `cs.{waarde}` voor array-kolommen (of `ilike` als het jsonb/tekst is), distinct-waarden uitvouwen.
- `RamsesCorrectionsPage.tsx`: cel-render met badges.
- `ramses-filter-ai` plan: kolomtype `list` doorgeven en `contains`-operator ondersteunen.
- Tests in `dataTable.test.ts` voor herkennen, filteren en export.
