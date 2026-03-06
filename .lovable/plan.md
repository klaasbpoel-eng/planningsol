

## Plan: PGS Register aanvullen op basis van Excel gevaarlijke stoffen lijst

### Analyse Excel vs. huidige database

De Excel "GevStoffenLijst" bevat 15 stoffen voor locatie Emmen. Momenteel staan er slechts **4 stoffen** in `pgs_substances` (Argon, Stikstof, Zuurstof, Helium) en **5 bulktanks**. Er ontbreken 7 stoffen en 2 datavelden.

**Ontbrekende stoffen (pgs_substances):**
| Stof | UN | CAS | GHS | WMS | GEVI |
|---|---|---|---|---|---|
| Acetyleen | 1001 | 74-86-2 | GHS02, GHS04 | 4F | 239 |
| Freon 134A | 3159 | 811-97-2 | GHS04 | 2A | 20 |
| Kooldioxide (drukhouder) | 1013 | 124-38-9 | GHS04 | 2A | 20 |
| Lachgas (N₂O) | 1070 | 10024-97-2 | GHS03, GHS04 | 2O | 25 |
| Methaan | 1971 | 74-82-8 | GHS02, GHS04 | 1F | 23 |
| Propaan | 1978 | 74-98-6 | GHS02, GHS04 | 2F | 23 |
| Waterstof | 1049 | 1333-74-0 | GHS02, GHS04 | 1F | 23 |

**Ontbrekende kolommen:** GEVI-nummer en WMS-classificatie staan niet in het schema.

### Aanpak

**1. Database migratie** — Twee nieuwe kolommen toevoegen:
- `gevi_number` (text) aan `pgs_substances` en `bulk_storage_tanks`
- `wms_classification` (text) aan `pgs_substances` en `bulk_storage_tanks`

**2. Data invoegen** — 7 nieuwe pgs_substances records voor sol_emmen met volledige gegevens uit de Excel (UN, CAS, GHS-pictogrammen, H/P-zinnen, GEVI, WMS, max opslag, huidige voorraad).

**3. Bestaande data bijwerken** — De 4 bestaande records aanvullen:
- `max_allowed_kg` en `current_stock_kg` op basis van Excel
- GEVI-nummers en WMS-classificaties invullen
- Helium koppelen aan gas_type als die bestaat

**4. Bulktanks bijwerken** — Capaciteiten en GEVI/WMS-velden invullen op basis van de vloeibare entries in de Excel (Argon vloeibaar, N₂ vloeibaar, O₂ vloeibaar, CO₂ vloeibaar).

**5. UI aanpassen** — PGSRegistry.tsx uitbreiden:
- GEVI-nummer en WMS-classificatie tonen in de stoftabel
- Export (Excel/PDF) uitbreiden met de nieuwe kolommen
- Interfaces `PGSSubstance` en `BulkTank` uitbreiden

### Bestanden
- `supabase/migrations/` — schema migratie (2 kolommen)
- Data inserts/updates via insert tool
- `src/components/production/PGSRegistry.tsx` — UI + export aanpassingen

### Geen locatiebeheer
Alle data wordt ingevoerd voor `sol_emmen`. Locatiebeheer blijft bij de admin.

