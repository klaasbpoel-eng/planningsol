# Vulplanning: cijfers duidelijker en goed te interpreteren

Zelfde aanpak als bij Rapportages: de berekening blijft gelijk, alleen hoe de cijfers getoond en uitgelegd worden verandert.

## Wat er nu verwarrend is
- KPI's tellen cilinders en bundels samen op als "stuks" (bv. 991 te vullen), terwijl een bundel 12 cilinders bevat.
- "Verwachte vraag" (1.261) en "Totaal te vullen" (991) staan naast elkaar zonder uitleg waarom ze verschillen (bestaande voorraad dekt een deel).
- De kolom "Huidige voorraad" toont op elke dag de voorraad van vandaag; op do/vr lijkt het alsof die voorraad dan nog beschikbaar is.
- Dagknoppen tonen "+105" zonder eenheid of uitleg.
- Uitlegtekst noemt de technische bron ("uit Supabase") en is één lange zin.
- Capaciteit wisselt tussen "2 L" en "600 L" zonder dat duidelijk is of het om water­inhoud per cilinder of per bundel gaat.
- Vraag staat in oranje (lijkt een waarschuwing), bijvullen in blauw; kleuren dragen geen betekenis.
- Gekozen buffer en methode zijn niet terug te zien in de samenvatting.

## Verbeteringen
1. **KPI's per eenheid**: "Te vullen" en "Verwachte vraag" gesplitst in cilinders en bundels (bundels apart, met "= x cilinders" als hulptekst). Derde kaart: "Gedekt door voorraad" (vraag − te vullen) in plaats van alleen aantal producten; aantal producten met vulactie als subregel.
2. **Samenvattingsregel** boven de tabel: periode (bv. "ma 30 nov t/m vr 4 dec"), locatie, type, buffer en methode als badges.
3. **Leeswijzer** (inklapbaar, zelfde stijl als Rapportages): wat "verwachte vraag", "voorraad aan begin van de dag", "bufferdoel" en "bijvullen" betekenen, en dat het een voorspelling is.
4. **Dagtabel**: kolom "Huidige voorraad" wordt "Voorraad begin dag" (verwachte voorraad op die dag; op de eerste dag = actuele voorraad). Kolom "Tekort na vraag" toegevoegd zodat bijvullen te verklaren is. Rijen gesorteerd op bijvullen.
5. **Dagknoppen**: "+105 te vullen" met eenheid, en totaalregel onder de dagtabel.
6. **Per product**: totalen-kolom en -regel, nul-dagen gedempt weergegeven, eenheid per regel.
7. **Neutrale kleuren**: semantische kleuren (geen oranje voor gewone vraag), tabulaire cijfers, zebra-regels, Nederlandse getalnotatie overal (ook capaciteit).
8. **Uitlegtekst** ingekort per methode, zonder technische bronnamen.
9. **Excel en print** nemen dezelfde kolomnamen, eenheden en samenvatting over.

## Technische details
- Nieuwe helpers in `src/lib/fillPlanPresentation.ts`: `summarizeByUnit` (cilinders/bundels), `coveredByStock`, `dayRangeLabel`, `projectedStartStock` (afgeleid uit bestaande perDay-gegevens van `computeFillPlan`, geen wijziging in `src/lib/fillPlanning.ts`), met unit-tests.
- `FillPlanning.tsx` aangepast; leeswijzer hergebruikt patroon van `ReportReadingGuide`.
- Scoped CSS onder `.fill-planning` in `index.css`, `print-area` blijft.
- Componenttest met gemockte `useGasFlowPredictor`: KPI-splitsing en kolomkoppen.
- Controle in de browser met testgegevens op desktop en mobiel.
