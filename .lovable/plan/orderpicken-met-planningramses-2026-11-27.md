# Orderpicken met PlanningRamses

## Wat er nu in de tabel staat
73 regels met: Datum, Klant, Artikelnummer, Omschrijving, Aantal, Chauffeur. Er is nog geen plek om vast te leggen wat al gepickt is.

## Voorstel: nieuwe pagina "Orderpicken"
Bereikbaar voor operators (groep Planning) en beheerders, gemaakt voor een tablet of telefoon in het magazijn.

```text
[ Ma 30-11 ]  < >   Chauffeur: [Alle | Chauffeur 1 | Chauffeur 2]
Voortgang: ███████░░░  18 van 26 gepickt

Chauffeur 2 ─────────────────────────  8/12
  Thalens PPS                          1/2
   [✓] 1×  Pakket Argon (16X50L)   270300
   [ ] 1×  Acetyleen (40L / 7.4kg) 240700
  Wasse Metaal & Techniek              0/1
   [ ] 1×  Zuurstof (50L)          250100
```

1. Dagkeuze: standaard vandaag (of de eerstvolgende dag met planning), pijltjes voor vorige/volgende dag.
2. Filter per chauffeur, zodat een operator één wagen tegelijk klaarzet.
3. Groepering chauffeur → klant, met per groep "x van y gepickt".
4. Grote aantikbare regels: één tik = gepickt (groen, doorgestreept naar onderen), nog een tik = terugzetten. Aantal groot en vet vooraan.
5. Tweede weergave "Per artikel": totalen per artikel voor de dag (bijv. 14× Argon 4.8 (50L)), handig om in één loop uit het magazijn te halen.
6. Knop "Toon alleen nog te picken" en een voortgangsbalk bovenaan.
7. Wanneer een chauffeur helemaal klaar is: groene melding "Chauffeur 2 compleet".
8. Picklijst printen (A4, per chauffeur) voor wie liever op papier werkt.

## Wat jij moet doen
De pickstatus moet in de database van de app bewaard worden, zodat meerdere operators dezelfde stand zien. Ik lever een SQL-bestand voor een kleine extra tabel; dat voer je één keer uit in de SQL-editor. PlanningRamses zelf wordt niet aangepast.

## Technische details
- Nieuwe tabel `PlanningRamsesPicks` (planning_id uuid uniek → PlanningRamses.id, picked_by, picked_at), RLS: goedgekeurde gebruikers lezen; operator/supervisor/admin mogen invoegen/verwijderen (via `has_role`/`is_admin`, geen sublinks op profiles). Leesrecht op PlanningRamses voor ingelogde gebruikers controleren in hetzelfde bestand.
- Pagina `src/pages/OrderPickingPage.tsx`, route `/orderpicken`, toegevoegd aan `NAVIGATION_GROUPS` (Planning) zodat menu, mobiel en Ctrl+K gelijk blijven.
- `Aantal` is tekst: omzetten naar getal in een helper in `src/lib/orderPicking.ts` (groeperen, totalen per artikel, voortgang), met tests.
- Optimistische update bij aantikken, met terugdraaien bij fout; periodiek verversen (30 s) zodat collega's elkaars picks zien.
- SQL getest in pglite, aangeleverd in /mnt/documents.

## Optionele ideeën
- Scannen van artikelnummer/barcode met de camera om een regel af te vinken.
- Gedeeltelijk picken (bijv. 4 van 6) met een aantal-teller.
