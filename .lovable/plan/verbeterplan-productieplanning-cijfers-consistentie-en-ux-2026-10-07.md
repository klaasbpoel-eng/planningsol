# Verbeterplan productieplanning: cijfers, consistentie en UX

## Doel

Eén controleerbare definitie maken voor productieaantallen, statussen, locaties, filters en vergelijkingsperioden, en de volledige Productie-omgeving overzichtelijker en betrouwbaarder maken op desktop en mobiel.

## Bevestigde bevindingen

1. **De cijfers komen niet overal uit dezelfde bron.** Vijftien productieonderdelen lezen rechtstreeks uit de legacy-bron `Productie`, terwijl andere schermen rekenen met gascilinder- en droogijsorders en rapportfuncties. In de huidige backend bestaat geen tabel of gesynchroniseerde dataset met de naam `Productie`; daardoor kunnen de getoonde legacy-cijfers nu niet volledig tegen de database worden afgestemd.
2. **De betekenis van “vorige periode” verschilt per onderdeel.** De bovenste kengetallen vergelijken met de direct voorafgaande periode van gelijke lengte; andere rapportages vergelijken met hetzelfde kalenderdeel van vorig jaar.
3. **Statussen worden niet gelijk behandeld.** Diverse totalen sluiten geannuleerde orders uit, terwijl minstens één maandrapportfunctie ze wel kan meetellen. Legacy-cilinderregels worden in een rapport bovendien als volledig geproduceerd behandeld, terwijl droogijs een echte status gebruikt.
4. **YTD is niet overal dezelfde afkapdatum.** De locatievergelijking telt de volledige huidige maand; andere onderdelen rekenen tot vandaag. Daardoor kunnen toekomstige dagen binnen de maand in het ene scherm wel en in het andere niet meetellen.
5. **Dagvergelijkingen kunnen verschuiven bij ontbrekende productiedagen.** Eén grafiek koppelt huidige en vorige dagen op positie in de gevonden dataset, niet op dezelfde kalenderdag.
6. **Locatie- en productfilters zijn versnipperd.** Onbekende locaties vallen op meerdere plekken automatisch onder Tilburg. Digitale producten worden deels via productnaam en deels via databasekenmerken bepaald. Sommige grafieken verversen hun data niet bij iedere filterwijziging.
7. **Globale en lokale filters spreken elkaar tegen.** De pagina heeft een algemene locatie- en periodekeuze, terwijl Gascilinders en Droogijs eigen jaar-, maand- en locatiekeuzes gebruiken.
8. **Routeplanning is zichtbaar maar toont geen inhoud.** De routeplanningsmodule bestaat, maar het tabblad is niet gekoppeld aan inhoud.
9. **Mobiel is niet consequent uitgewerkt.** Droogijs heeft taakgerichte kaarten; Gascilinders en PGS blijven brede tabellen met kleine filterbediening.
10. **Rekenkundige testdekking ontbreekt.** De bestaande productietests bewaken periodenlabels, maar niet totalen, statussen, locaties, YTD, trends, paginering of gelijkheid tussen dashboard en rapportages.

## Aanpak

### Fase 1 — Definities en broncontrole

- Leg één cijfercontract vast voor:
  - gepland, geproduceerd, geannuleerd en totaal;
  - cilinders versus orders versus kilogram droogijs;
  - YTD tot en met vandaag versus jaartotaal;
  - vergelijking met vorig jaar of met de direct voorafgaande periode;
  - Emmen, Tilburg en alle locaties;
  - digitale en externe productie.
- Bepaal welke bron leidend is voor gascilinders: de legacy-productiedataset of de ordertabellen. Controleer eerst waarom `Productie` niet beschikbaar is in de huidige backend en voorkom een migratie totdat die bronvraag is beantwoord.
- Maak onbekende locaties expliciet zichtbaar als “Onbekend” in plaats van ze stilzwijgend aan Tilburg toe te wijzen.
- Documenteer bij elk kengetal de eenheid en statusselectie, zodat “orders”, “cilinders” en “kg” niet onder één onduidelijk totaal vallen.

### Fase 2 — Eén centrale rekenlaag

- Verplaats datum-, locatie-, status-, digitaal- en externfiltering naar gedeelde rapportfuncties.
- Laat dashboardkaarten, KPI-dashboard, klanttotalen, locatievergelijking en rapportages dezelfde functies gebruiken.
- Gebruik voor alle YTD-weergaven exact dezelfde einddatum: vandaag, of de gekozen einddatum wanneer die eerder ligt.
- Koppel jaar-op-jaar dagpunten op kalenderdatum/-offset, ook wanneer productiedagen ontbreken.
- Sluit geannuleerde orders consequent uit van productievolumes en toon ze alleen in expliciete statusstatistieken.
- Vervang apparaatgebonden jaardoelen door gedeelde instellingen, zodat medewerkers dezelfde doelen zien.
- Zorg dat filterwijzigingen altijd de onderliggende reeks én de zichtbare selectie verversen.

### Fase 3 — Filter- en schermlogica vereenvoudigen

- Maak de algemene locatie en periode de zichtbare context voor alle relevante productietabbladen.
- Verwijder dubbele locatiekeuzes of geef lokale keuzes een duidelijk afgebakende functie.
- Laat “Filters wissen” werkelijk alles tonen; bied “Deze maand” als aparte snelkeuze.
- Gebruik overal dezelfde woorden voor YTD, jaartotaal, vergelijking en status.
- Koppel Routeplanning daadwerkelijk aan de bestaande module; verberg het tabblad totdat die koppeling compleet en getest is.
- Markeer Gascilinders duidelijk als alleen-lezen wanneer de gegevens uit een externe bron komen.
- Voeg bij Droogijs een consistente “Nieuwe order”-actie toe via dezelfde invoer als in de kalender.

### Fase 4 — Mobiele en toegankelijke bediening

- Geef Gascilinders en PGS een mobiele kaartweergave volgens het bestaande Droogijs-patroon.
- Verplaats mobiele filters uit tabelkoppen naar een goed bereikbare filterbalk of lade.
- Maak sortering toetsenbordbedienbaar en voeg zichtbare/schermlezerstatus toe.
- Gebruik echte keuzeknoppen voor locatie, met een herkenbare actieve en vergrendelde toestand.
- Vergroot aanraakvlakken en controleer dat lange aantallen, labels en locatiechips niet overlappen.
- Toon gedeelde, expliciete laad-, lege- en foutmeldingen; bronfouten mogen niet meer als een lege dataset verschijnen.

### Fase 5 — Automatische controles

- Voeg één vaste fixture-dataset toe met beide locaties, alle statussen, digitale/externe producten, ontbrekende dagen, toekomstige dagen in de huidige maand en meer dan 1.000 regels.
- Test per bedrijfsregel concrete uitkomsten voor dag, maand, jaar en YTD.
- Test dat hetzelfde filter exact hetzelfde totaal oplevert in bovenste kengetallen, KPI-dashboard, grafiek, tabel en export.
- Test locatie-afscherming per rol en laat rechten gesloten blijven zolang permissies nog laden.
- Test dat ieder zichtbaar productietabblad inhoud toont.
- Test filterreset, mobiel sorteren/filteren en exportkolommen met gerichte interactietests.

## Prioriteiten

| Prioriteit | Verbetering | Reden |
|---|---|---|
| 1 | Leidende gegevensbron en cijferdefinities vastleggen | Zonder dit kan een visueel consistente pagina nog steeds verschillende cijfers tonen |
| 2 | Status-, YTD-, locatie- en vergelijkingslogica centraliseren | Voorkomt inhoudelijke afwijkingen tussen kaarten, grafieken, tabellen en exports |
| 3 | Rekenkundige regressietests toevoegen | Maakt afwijkingen aantoonbaar voordat wijzigingen worden gepubliceerd |
| 4 | Dubbele filters en dode Routeplanning herstellen | Directe winst in begrijpelijkheid en vertrouwen |
| 5 | Mobiele kaarten en toegankelijke bediening | Verbetert dagelijks gebruik op vloer, tablet en telefoon |

## Acceptatiecriteria

- Voor dezelfde bron, locatie, periode en filters tonen alle productieonderdelen exact hetzelfde volume.
- Iedere waarde vermeldt of impliceert ondubbelzinnig de eenheid, statusselectie en vergelijkingsbasis.
- YTD stopt overal op dezelfde dag en bevat geen toekomstige productie.
- Geannuleerde orders beïnvloeden geen productievolume.
- Onbekende locaties worden nooit automatisch als Tilburg geteld.
- Een filterwijziging werkt direct door in kaart, grafiek, tabel en export.
- Iedere zichtbare sectie toont inhoud of een duidelijke fout/lege status.
- Kernhandelingen zijn bruikbaar op mobiel en met toetsenbord.
- Automatische tests bewaken bronpariteit, totalen, trends, YTD, rollen, paginering en exports.

## Afbakening

Dit plan verandert nog geen bedrijfscijfers. De eerste uitvoeringsstap is bron- en definitievalidatie; pas daarna worden berekeningen gecentraliseerd en schermen aangepast.
