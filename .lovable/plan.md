

# Plan: Export hele gas_cylinder_orders tabel naar Excel

## Probleem

De tabel bevat ~140.000 records. De Supabase API heeft een standaard limiet van 1.000 rijen per query. Alles via de frontend ophalen (zelfs met weekly chunking) zou tientallen requests vereisen en traag/onbetrouwbaar zijn.

## Aanpak

Een **backend functie** die server-side alle data ophaalt en een CSV bestand genereert. CSV wordt gekozen boven .xlsx omdat:
- Het server-side geen zware libraries nodig heeft (xlsx is ~2MB)
- CSV opent prima in Excel
- Het is veel sneller te genereren bij 140k rijen

## Wijzigingen

| Bestand | Wijziging |
|---------|-----------|
| `supabase/functions/export-gas-cylinder-orders/index.ts` | Nieuwe backend functie die alle orders ophaalt en als CSV retourneert |
| `src/components/production/GasCylinderPlanning.tsx` | Export knop toevoegen die de backend functie aanroept en het CSV bestand download |

## Technische Details

### 1. Backend functie (`supabase/functions/export-gas-cylinder-orders/index.ts`)

- Gebruikt de Supabase service role key (server-side, geen RLS limiet)
- Haalt alle records op uit `gas_cylinder_orders` met een JOIN op `gas_types` voor de gastype naam
- Paginatie server-side: haalt data op in batches van 10.000 rijen via `.range()`
- Genereert een CSV string met de kolommen: Locatie, Ordernummer, Klant, Gastype, Kwaliteit, Aantal Cilinders, Cilindergrootte, Druk (bar), Datum, Status, Opmerkingen
- Vertaalt technische waarden naar Nederlandse labels (bijv. `sol_emmen` -> `SOL Emmen`, `completed` -> `Voltooid`)
- Retourneert het CSV bestand met juiste headers (`Content-Type: text/csv`, `Content-Disposition: attachment`)
- Beveiligd: controleert of de gebruiker is ingelogd via de Authorization header

### 2. Export knop (`GasCylinderPlanning.tsx`)

- Voegt een "Excel export" knop toe in de header (naast bestaande knoppen)
- Knop roept de backend functie aan via `fetch()` met de auth token
- Download het resultaat als `.csv` bestand (opent direct in Excel)
- Toont een loading state en foutmeldingen via toast
- Bestandsnaam: `gascilinder-orders-export-YYYY-MM-DD.csv`

### Data Flow

```text
[Knop klik] -> [Backend Functie]
                   |
                   v
            [Supabase DB query]
            (batches van 10.000)
                   |
                   v
            [CSV generatie]
                   |
                   v
            [Download in browser]
```

