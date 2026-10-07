# UI- en gebruiksvriendelijkheidsplan

## Doel

De applicatie als geheel overzichtelijker, consistenter en sneller bedienbaar maken voor medewerkers, planners en beheerders, zonder bedrijfslogica te wijzigen.

## Belangrijkste bevindingen

1. **Navigatie is versnipperd.** De bovenbalk, beheerzijbalk en startweergave gebruiken verschillende groepen en benamingen. Beheerders bewegen daardoor feitelijk tussen twee navigatiemodellen.
2. **Productie is te dicht.** Maximaal acht horizontale tabbladen, KPI’s, locatiekeuze en periodekeuze concurreren om aandacht. Op mobiel zijn verborgen tabbladen moeilijk te ontdekken.
3. **PGS-acties zijn niet geordend.** Aanmaken, beheer, toewijzen, uitbreiding, typefilter en vier exports staan als één lange rij boven de tabel.
4. **Filters en statussen verschillen per scherm.** Dezelfde handelingen zien er in planning, routes, rapportage en beheer anders uit.
5. **Mobiele bediening mist belangrijke snelwegen.** Zoeken en “vandaag” zijn alleen op desktop direct beschikbaar; brede tabellen verliezen soms cruciale kolommen.
6. **Visuele regels worden niet consequent gevolgd.** Er zijn honderden losse kleurtoepassingen naast de centrale stijlen, waardoor statuskleuren en donkere modus kunnen afwijken.
7. **Toegankelijkheid kan beter.** Actieve navigatie, sortering en diverse pictogramknoppen missen expliciete labels of status voor toetsenbord- en schermlezergebruik.
8. **Het inlogscherm is rustig en herkenbaar**, maar de tekst gaat alleen over verlof terwijl de applicatie inmiddels veel bredere planning, productie en veiligheid omvat.

## Aanpak

### Fase 1 — Navigatie en basispatronen

- Maak één centrale navigatie-indeling voor bovenbalk, mobiel menu en beheerweergave.
- Gebruik overal dezelfde namen, iconen, volgorde en actieve status.
- Geef beheer een eigen, rechtstreeks te openen adres met deelbare subpagina’s.
- Voeg zoeken en “vandaag” toe aan het mobiele menu.
- Toon kruimelpaden alleen bij echte verdiepingspagina’s; voorkom dubbele paginatitels.
- Maak focus, actieve pagina en pictogramknoppen duidelijk voor toetsenbord en schermlezer.

### Fase 2 — Productie en dagelijkse werkstromen

- Vervang de lange mobiele productietabrij door een compacte sectiekeuze; behoud tabbladen op breed scherm.
- Maak locatie en periode duidelijke, vaste context boven de inhoud.
- Beperk KPI’s standaard tot de belangrijkste signalen; plaats aanvullende cijfers achter “Meer inzicht”.
- Standaardiseer zoeken, filters, resetten en actieve-filteraanduidingen.
- Kies één patroon voor status, snelle statuswijziging en voortgang in dagoverzicht, orders en planning.
- Gebruik op mobiel taakgerichte kaarten waar brede tabellen belangrijke gegevens verbergen.

### Fase 3 — PGS en rapportage

- Verdeel de PGS-bovenbalk in drie herkenbare groepen:
  - **Registreren:** Nieuwe stof, Toewijzen
  - **Beheren:** Opslagplaatsen, Uitbreidingen
  - **Exporteren:** één exportmenu met PDF/Excel en per-opslagplaatsvarianten
- Zet locatie-, pictogram- en opslagplaatstypefilters direct bij zoeken en toon actieve filters als verwijderbare labels.
- Voeg “Filters wissen” toe en voorkom dat nul opslagplaatstypes geselecteerd kunnen zijn zonder uitleg.
- Houd kritieke bezetting visueel dominant; maak overige tabelinformatie rustiger en beter scanbaar.
- Laat exports expliciet samenvatten welke locatie, periode en opslagplaatstypes worden meegenomen.

### Fase 4 — Beheer, consistentie en vertrouwen

- Splits dagelijkse instellingen van geavanceerde data-, migratie- en implementatieacties.
- Werk aantallen bij zodra een aanvraag of medewerker wordt afgehandeld, zonder herladen.
- Gebruik één gedeelde lege-, laad- en foutweergave voor alle tabellen en lijsten.
- Breng statuskleuren, achtergronden, randen, hoeken en schaduwen terug naar centrale stijlen; begin bij schermen die donkere modus doorbreken.
- Actualiseer de inlogtekst naar de volledige functie van SOL Planner.

## Prioriteiten

| Prioriteit | Verbetering | Effect | Inspanning |
|---|---|---:|---:|
| 1 | Eén navigatiemodel + mobiele zoek/vandaag-acties | Hoog | Middel |
| 2 | Productietabs en schermhiërarchie vereenvoudigen | Hoog | Middel |
| 3 | PGS-acties groeperen en exporteren vereenvoudigen | Hoog | Laag-middel |
| 4 | Filters, statussen en lege/laadstatussen standaardiseren | Hoog | Middel |
| 5 | Mobiele tabelalternatieven voor kernwerkstromen | Hoog | Middel-hoog |
| 6 | Toegankelijkheidsronde op navigatie en tabellen | Middel-hoog | Middel |
| 7 | Centrale kleuren en donkere modus opschonen | Middel | Hoog |
| 8 | Beheerinstellingen scheiden in dagelijks/geavanceerd | Middel | Middel |

## Technische uitvoering

- Bouw gedeelde configuratie voor navigatie en herbruikbare patronen voor filters, statussen en schermtoestanden.
- Behoud bestaande rechten per rol en locatie; de herindeling verandert alleen presentatie en navigatie.
- Migreer scherm voor scherm naar centrale kleur- en vormstijlen, zodat visuele wijzigingen controleerbaar blijven.
- Voeg gerichte tests toe voor navigatie per rol, mobiele sectiekeuze, filterreset en exportselecties.
- Controleer elke fase op desktop en mobiel, in lichte en donkere modus, inclusief toetsenbordbediening.

## Acceptatiecriteria

- Iedere bestemming heeft overal dezelfde naam en positie binnen één herkenbare structuur.
- Alle productieonderdelen zijn op mobiel zichtbaar en bereikbaar zonder verborgen horizontale bediening.
- PGS-export is vanuit één plek begrijpelijk en toont vóór export de actieve selectie.
- Zoek-, filter-, status-, laad- en lege toestanden gedragen zich gelijk over de applicatie.
- Kernwerkstromen zijn volledig bruikbaar met toetsenbord en mobiele aanraakbediening.
- Lichte en donkere modus tonen geen onverwachte witte vlakken of afwijkende statuskleuren.
